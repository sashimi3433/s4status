/**
 * Real-status checker: runs every monitored operation against every S4
 * endpoint (SigV4-signed) and stores per-slot results in D1.
 */
import { ENDPOINTS } from "../data/regions";
import { sigv4Headers, bodyHash } from "./sigv4";
import { Db, ensureSchema } from "./db";

/** Runtime configuration (set as Worker secrets / plain-text variables). */
declare global {
  interface Env {
    S4_ACCESS_KEY_ID?: string;
    S4_SECRET_ACCESS_KEY?: string;
    S4_PROBE_BUCKET?: string;
    S4_IAM_PROBE_USER?: string;
    S4_SIGV4_REGION?: string;
    S4_FULL_SCAN?: string;
  }
}

export interface CheckResult {
  endpoint: string; // endpoint key
  op: string; // operation id
  status: "operational" | "degraded" | "outage";
  latencyMs: number;
}

const PROBE_KEY = "s4status-probe.txt";
const PROBE_KEY2 = "s4status-probe-copy.txt";
const MP_KEY = "s4status-mp.txt";
const MP_KEY2 = "s4status-mp-copy.txt";
const CANARY_BUCKET = "s4status-canary";
const DEGRADED_MS = 4000;

/** CRC32 + base64 for x-amz-checksum-crc32 (Workers has no MD5). */
const CRC_TABLE = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32Base64(text: string): string {
  let crc = 0xffffffff;
  const bytes = new TextEncoder().encode(text);
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  const value = (crc ^ 0xffffffff) >>> 0;
  const be = [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  return btoa(String.fromCharCode(...be));
}

interface Creds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  probeUser: string | null;
}

const diagSamples: string[] = [];

/** A response counts as "service healthy" unless it is an auth or server error. */
function classify(status: number, latencyMs: number, okStatuses = (s: number) => s < 400): CheckResult["status"] {
  const networkOk = status > 0 && status < 500 && status !== 403;
  if (!networkOk || !okStatuses(status)) return "outage";
  if (latencyMs > DEGRADED_MS) return "degraded";
  return "operational";
}

async function s3Fetch(
  creds: Creds,
  host: string,
  method: string,
  path: string,
  query: string,
  extraHeaders: Record<string, string> = {},
  body?: string,
): Promise<{ status: number; latencyMs: number; text: string; headers: Headers }> {
  const url = new URL(`https://${host}${path}${query ? `?${query}` : ""}`);
  const headers = await sigv4Headers({
    method,
    url,
    service: "s3",
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: creds.region,
    headers: extraHeaders,
    ...(body !== undefined ? { payloadHash: await bodyHash(body) } : {}),
  });
  const start = Date.now();
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  return { status: res.status, latencyMs: Date.now() - start, text, headers: res.headers };
}

async function iamFetch(
  creds: Creds,
  host: string,
  action: string,
  params: Record<string, string> = {},
): Promise<{ status: number; latencyMs: number; text: string }> {
  const body = new URLSearchParams({ Action: action, Version: "2010-05-08", ...params }).toString();
  const url = new URL(`https://${host}/`);
  const headers = await sigv4Headers({
    method: "POST",
    url,
    service: "iam",
    accessKeyId: creds.accessKeyId,
    secretAccessKey: creds.secretAccessKey,
    region: creds.region,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payloadHash: await bodyHash(body),
  });
  const start = Date.now();
  const res = await fetch(url, { method: "POST", headers, body });
  return { status: res.status, latencyMs: Date.now() - start, text: await res.text() };
}

/** Run one endpoint's full probe chain and emit per-op results. */
async function checkEndpoint(endpointKey: string, host: string, creds: Creds): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const b = creds.bucket;
  const push = (op: string, r: { status: number; latencyMs: number; text?: string }, okStatuses?: (s: number) => boolean) => {
    const status = classify(r.status, r.latencyMs, okStatuses);
    if (status === "outage" && diagSamples.length < 6) {
      diagSamples.push(`${endpointKey} ${op} -> HTTP ${r.status}: ${(r.text ?? "").slice(0, 180)}`);
    }
    out.push({ endpoint: endpointKey, op, status, latencyMs: r.latencyMs });
  };
  const safe = async (op: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      if (diagSamples.length < 6) diagSamples.push(`${endpointKey} ${op} THREW: ${String(e).slice(0, 180)}`);
      out.push({ endpoint: endpointKey, op, status: "outage", latencyMs: 0 });
    }
  };

  if (endpointKey.startsWith("s3:")) {
    // --- bucket services ---
    await safe("ListBuckets", async () => push("ListBuckets", await s3Fetch(creds, host, "GET", "/", "")));
    await safe("HeadBucket", async () => push("HeadBucket", await s3Fetch(creds, host, "HEAD", `/${b}`, "")));
    await safe("GetBucketLocation", async () =>
      push("GetBucketLocation", await s3Fetch(creds, host, "GET", `/${b}`, "location")));
    await safe("GetBucketAcl", async () => push("GetBucketAcl", await s3Fetch(creds, host, "GET", `/${b}`, "acl")));
    await safe("ListObjectsV2", async () =>
      push("ListObjectsV2", await s3Fetch(creds, host, "GET", `/${b}`, "list-type=2&max-keys=1")));
    await safe("ListObjects", async () =>
      push("ListObjects", await s3Fetch(creds, host, "GET", `/${b}`, "max-keys=1")));

    // --- object chain (sequential: later steps use earlier objects) ---
    await safe("PutObject", async () =>
      push("PutObject", await s3Fetch(creds, host, "PUT", `/${b}/${PROBE_KEY}`, "", {}, "s4status")));
    await safe("HeadObject", async () =>
      push("HeadObject", await s3Fetch(creds, host, "HEAD", `/${b}/${PROBE_KEY}`, "")));
    await safe("GetObject", async () =>
      push("GetObject", await s3Fetch(creds, host, "GET", `/${b}/${PROBE_KEY}`, "")));
    await safe("GetObjectAcl", async () =>
      push("GetObjectAcl", await s3Fetch(creds, host, "GET", `/${b}/${PROBE_KEY}`, "acl")));
    await safe("CopyObject", async () =>
      push(
        "CopyObject",
        await s3Fetch(creds, host, "PUT", `/${b}/${PROBE_KEY2}`, "", {
          "x-amz-copy-source": `/${b}/${PROBE_KEY}`,
        }),
      ));
    // --- multipart chain (runs before the deletes: UploadPartCopy needs
    //     PROBE_KEY as its copy source) ---
    let uploadId = "";
    let copyUploadId = "";
    let partEtag = "";
    await safe("CreateMultipartUpload", async () => {
      const r = await s3Fetch(creds, host, "POST", `/${b}/${MP_KEY}`, "uploads=");
      push("CreateMultipartUpload", r);
      uploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(r.text)?.[1] ?? "";
    });
    if (uploadId) {
      await safe("UploadPart", async () => {
        const r = await s3Fetch(creds, host, "PUT", `/${b}/${MP_KEY}`, `partNumber=1&uploadId=${encodeURIComponent(uploadId)}`, {}, "part");
        partEtag = r.headers.get("etag") ?? "";
        push("UploadPart", r);
      });
      await safe("ListParts", async () =>
        push("ListParts", await s3Fetch(creds, host, "GET", `/${b}/${MP_KEY}`, `uploadId=${encodeURIComponent(uploadId)}`)));
      await safe("UploadPartCopy", async () => {
        const create = await s3Fetch(creds, host, "POST", `/${b}/${MP_KEY2}`, "uploads=");
        copyUploadId = /<UploadId>([^<]+)<\/UploadId>/.exec(create.text)?.[1] ?? "";
        if (!copyUploadId) throw new Error("no uploadId");
        const r = await s3Fetch(creds, host, "PUT", `/${b}/${MP_KEY2}`, `partNumber=1&uploadId=${encodeURIComponent(copyUploadId)}`, {
          "x-amz-copy-source": `/${b}/${PROBE_KEY}`,
        });
        push("UploadPartCopy", r);
      });
      await safe("CompleteMultipartUpload", async () => {
        const complete = `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>${partEtag || "*"}</ETag></Part></CompleteMultipartUpload>`;
        push(
          "CompleteMultipartUpload",
          await s3Fetch(creds, host, "POST", `/${b}/${MP_KEY}`, `uploadId=${encodeURIComponent(uploadId)}`, {}, complete),
        );
      });
    }
    await safe("ListMultipartUploads", async () =>
      push("ListMultipartUploads", await s3Fetch(creds, host, "GET", `/${b}`, "uploads=")));
    if (copyUploadId) {
      await safe("AbortMultipartUpload", async () =>
        push("AbortMultipartUpload", await s3Fetch(creds, host, "DELETE", `/${b}/${MP_KEY2}`, `uploadId=${encodeURIComponent(copyUploadId)}`)));
    }

    // --- deletes last (PROBE_KEY is the multipart copy source) ---
    await safe("DeleteObjects", async () => {
      const delBody = `<Delete><Object><Key>${PROBE_KEY2}</Key></Object></Delete>`;
      push(
        "DeleteObjects",
        await s3Fetch(creds, host, "POST", `/${b}`, "delete=", {
          "x-amz-checksum-crc32": crc32Base64(delBody),
        }, delBody),
      );
    });
    await safe("DeleteObject", async () =>
      push("DeleteObject", await s3Fetch(creds, host, "DELETE", `/${b}/${PROBE_KEY}`, "")));

    // --- bucket policy cycle ---
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Principal: "*", Action: "s3:GetObject", Resource: `arn:aws:s3:::${b}/*` }],
    });
    await safe("PutBucketPolicy", async () =>
      push("PutBucketPolicy", await s3Fetch(creds, host, "PUT", `/${b}`, "policy=", {}, policy)));
    await safe("GetBucketPolicy", async () =>
      push("GetBucketPolicy", await s3Fetch(creds, host, "GET", `/${b}`, "policy=")));
    await safe("DeleteBucketPolicy", async () =>
      push("DeleteBucketPolicy", await s3Fetch(creds, host, "DELETE", `/${b}`, "policy=")));
  } else {
    // --- IAM policy services ---
    // Any non-403/non-5xx HTTP response = API operational (the service
    // processed our signed request; a 404 "NoSuchEntity" proves it works).
    // The IAM service is "operational" when it processes our signed request
    // and answers with a protocol-level response — including NoSuchEntity
    // (target user/policy doesn't exist) and EntityAlreadyExists. Those are
    // 403/404 with distinct error codes. Only AccessDenied-on-policy (the
    // checker's credentials lack the action), throttling, or 5xx mean trouble.
    const iamOkText = (s: number, text: string) => {
      if (s < 500 && s !== 403) return true;
      const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1] ?? "";
      return /NoSuch/i.test(code) || /Already/i.test(code);
    };
    const pushIam = (op: string, r: { status: number; latencyMs: number; text?: string }) => {
      const status = r.status === 429 ? "degraded" : iamOkText(r.status, r.text ?? "") ? classify(r.status, r.latencyMs, () => true) : "outage";
      if (status === "outage" && diagSamples.length < 6) {
        diagSamples.push(`${endpointKey} ${op} -> HTTP ${r.status}: ${(r.text ?? "").slice(0, 160)}`);
      }
      out.push({ endpoint: endpointKey, op, status, latencyMs: r.latencyMs });
    };

    let policyArn = "";
    await safe("ListPolicies", async () => {
      const r = await iamFetch(creds, host, "ListPolicies");
      pushIam("ListPolicies", r);
      policyArn = /<Arn>([^<]+)<\/Arn>/.exec(r.text)?.[1] ?? "";
    });
    if (policyArn) {
      await safe("GetPolicy", async () => {
        const g = await iamFetch(creds, host, "GetPolicy", { PolicyArn: policyArn });
        pushIam("GetPolicy", g);
        const versionId = /<DefaultVersionId>([^<]+)<\/DefaultVersionId>/.exec(g.text)?.[1] ?? "v1";
        await safe("GetPolicyVersion", async () =>
          pushIam("GetPolicyVersion", await iamFetch(creds, host, "GetPolicyVersion", { PolicyArn: policyArn, VersionId: versionId })));
      });
    }
    // User policy operations. SAFETY: never target the admin user itself —
    // with the fallback name the checker once detached AdministratorAccess
    // from its own credentials ("policy keeps disappearing"). The probe
    // user/group are dedicated, no-permission targets for attach/detach.
    const userName = creds.probeUser || "s4status-probe-user";
    const groupName = "s4status-probe";
    const safeTargets =
      userName !== "s4status-probe" && !userName.includes("admin");
    await safe("ListAttachedUserPolicies", async () =>
      pushIam("ListAttachedUserPolicies", await iamFetch(creds, host, "ListAttachedUserPolicies", { UserName: userName })));
    await safe("ListAttachedGroupPolicies", async () =>
      pushIam("ListAttachedGroupPolicies", await iamFetch(creds, host, "ListAttachedGroupPolicies", { GroupName: groupName })));
    if (policyArn && safeTargets) {
      await safe("AttachUserPolicy", async () =>
        pushIam("AttachUserPolicy", await iamFetch(creds, host, "AttachUserPolicy", { PolicyArn: policyArn, UserName: userName })));
      await safe("AttachGroupPolicy", async () =>
        pushIam("AttachGroupPolicy", await iamFetch(creds, host, "AttachGroupPolicy", { PolicyArn: policyArn, GroupName: groupName })));
      await safe("DetachUserPolicy", async () =>
        pushIam("DetachUserPolicy", await iamFetch(creds, host, "DetachUserPolicy", { PolicyArn: policyArn, UserName: userName })));
      await safe("DetachGroupPolicy", async () =>
        pushIam("DetachGroupPolicy", await iamFetch(creds, host, "DetachGroupPolicy", { PolicyArn: policyArn, GroupName: groupName })));
    }
  }
  return out;
}

/** CreateBucket/DeleteBucket canary: bucket namespace is account-global in S4,
 *  so one create/delete cycle per run covers every S3 endpoint. */
async function checkCanary(creds: Creds, firstS3Host: string): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const s3Keys = ENDPOINTS.filter((e) => e.service === "s3").map((e) => e.key);
  try {
    const create = await s3Fetch(creds, firstS3Host, "PUT", `/${CANARY_BUCKET}`, "");
    const del = await s3Fetch(creds, firstS3Host, "DELETE", `/${CANARY_BUCKET}`, "");
    for (const key of s3Keys) {
      out.push({ endpoint: key, op: "CreateBucket", status: classify(create.status, create.latencyMs), latencyMs: create.latencyMs });
      out.push({ endpoint: key, op: "DeleteBucket", status: classify(del.status, del.latencyMs), latencyMs: del.latencyMs });
    }
  } catch {
    for (const key of s3Keys) {
      for (const op of ["CreateBucket", "DeleteBucket"]) out.push({ endpoint: key, op, status: "outage", latencyMs: 0 });
    }
  }
  return out;
}

export async function runChecks(env: Env, db: Db): Promise<void> {
  const accessKeyId = env.S4_ACCESS_KEY_ID;
  const secretAccessKey = env.S4_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    console.warn("[checker] S4 credentials not configured; skipping run");
    return;
  }
  const creds: Creds = {
    accessKeyId,
    secretAccessKey,
    region: env.S4_SIGV4_REGION || "us-east-1",
    bucket: env.S4_PROBE_BUCKET || "s4status-probe",
    probeUser: env.S4_IAM_PROBE_USER || null,
  };

  diagSamples.length = 0;
  // The free plan caps a Worker invocation at ~50 subrequests, so each run
  // checks a rotating slice (1 S3 chain ≈ 24 requests + 2 IAM chains ≈ 16)
  // instead of the whole matrix. With a */5 cron the full 28-endpoint cycle
  // takes ~70 min; with a per-minute cron ~14 min. Set S4_FULL_SCAN=1 on a
  // paid plan (1000 subrequests) to check everything in one run.
  const fullScan = env.S4_FULL_SCAN === "1";
  const s3List = ENDPOINTS.filter((e) => e.service === "s3");
  const iamList = ENDPOINTS.filter((e) => e.service === "iam");

  const slice: typeof ENDPOINTS = [];
  let includeCanary = false;
  if (fullScan) {
    slice.push(...ENDPOINTS);
    includeCanary = true;
  } else {
    const metaRows = await db.query<{ key: string; value: string }>(
      "SELECT key, value FROM meta WHERE key IN ('s3cursor', 'iamcursor')",
    );
    const read = (k: string, len: number) =>
      Number(metaRows.find((r) => r.key === k)?.value ?? 0) % len;
    const s3Cursor = read("s3cursor", s3List.length);
    const iamCursor = read("iamcursor", iamList.length);
    slice.push(s3List[s3Cursor]!);
    slice.push(iamList[iamCursor]!, iamList[(iamCursor + 1) % iamList.length]!);
    includeCanary = s3Cursor === 0;
    await db.query(
      "INSERT INTO meta (key, value) VALUES ($1, $2), ($3, $4) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      [
        "s3cursor",
        String((s3Cursor + 1) % s3List.length),
        "iamcursor",
        String((iamCursor + 2) % iamList.length),
      ],
    );
  }

  const results: CheckResult[] = [];
  for (const ep of slice) {
    try {
      results.push(...(await checkEndpoint(ep.key, ep.url, creds)));
    } catch (e) {
      if (diagSamples.length < 6) diagSamples.push(`${ep.key} CHAIN THREW: ${String(e).slice(0, 180)}`);
    }
  }
  if (includeCanary) {
    try {
      results.push(...(await checkCanary(creds, ENDPOINTS.find((e) => e.service === "s3")!.url)));
    } catch {
      /* diag already covers */
    }
  }
  // Fill any missing op/endpoint cells as nodata-free (skip) — absent = nodata on read.

  const now = new Date();
  const slot = slotKey(now);
  const rows = results.map((r) => [slot, r.endpoint, r.op, r.status, r.latencyMs]);
  // Single batched INSERT (bridge subrequests count toward the Workers limit)
  if (rows.length > 0) {
    const valuesSql = rows.map((_, i) => {
      const b = i * 5;
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
    });
    const params = rows.flat();
    await db.query(
      `INSERT INTO status_slots (slot, endpoint, op, status, latency_ms) VALUES ${valuesSql.join(",")}
       ON CONFLICT (slot, endpoint, op) DO UPDATE SET status = EXCLUDED.status, latency_ms = EXCLUDED.latency_ms`,
      params,
    );
  }

  // 7-day retention (string compare on zero-padded keys)
  const cutoff = slotKey(new Date(now.getTime() - 7 * 24 * 3600 * 1000));
  await db.query("DELETE FROM status_slots WHERE slot < $1", [cutoff]);

  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`[checker] ${slot}: ${results.length} rows —`, JSON.stringify(counts));
  for (const s of diagSamples) console.log(`[checker][diag] ${s}`);
}

/** Zero-padded UTC slot key, e.g. "2026-09-28 05:05" (slot start). */
export function slotKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const minutes = Math.floor(d.getUTCMinutes() / 5) * 5;
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(minutes)}`;
}

export async function ensureStatusSchema(db: Db): Promise<void> {
  await ensureSchema(db);
}
