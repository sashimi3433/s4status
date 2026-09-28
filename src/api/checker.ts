/**
 * Real-status checker: runs every monitored operation against every S4
 * endpoint (SigV4-signed) and stores per-slot results in D1.
 */
import { ENDPOINTS } from "../data/regions";
import { sigv4Headers, bodyHash } from "./sigv4";

/** Runtime configuration (set as Worker secrets / plain-text variables). */
declare global {
  interface Env {
    S4_ACCESS_KEY_ID?: string;
    S4_SECRET_ACCESS_KEY?: string;
    S4_PROBE_BUCKET?: string;
    S4_IAM_PROBE_USER?: string;
    S4_SIGV4_REGION?: string;
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
    await safe("DeleteObjects", async () => {
      const delBody = `<Delete><Object><Key>${PROBE_KEY2}</Key></Object></Delete>`;
      push("DeleteObjects", await s3Fetch(creds, host, "POST", `/${b}`, "delete=", {}, delBody));
    });
    await safe("DeleteObject", async () =>
      push("DeleteObject", await s3Fetch(creds, host, "DELETE", `/${b}/${PROBE_KEY}`, "")));

    // --- multipart chain ---
    let uploadId = "";
    let copyUploadId = "";
    await safe("CreateMultipartUpload", async () => {
      const r = await s3Fetch(creds, host, "POST", `/${b}/${MP_KEY}`, "uploads=");
      push("CreateMultipartUpload", r);
      uploadId = new DOMParser().parseFromString(r.text, "text/xml")
        .getElementsByTagName("UploadId")[0]?.textContent ?? "";
    });
    if (uploadId) {
      await safe("UploadPart", async () =>
        push(
          "UploadPart",
          await s3Fetch(creds, host, "PUT", `/${b}/${MP_KEY}`, `partNumber=1&uploadId=${encodeURIComponent(uploadId)}`, {}, "part"),
        ));
      await safe("ListParts", async () =>
        push("ListParts", await s3Fetch(creds, host, "GET", `/${b}/${MP_KEY}`, `uploadId=${encodeURIComponent(uploadId)}`)));
      await safe("UploadPartCopy", async () => {
        const create = await s3Fetch(creds, host, "POST", `/${b}/${MP_KEY2}`, "uploads=");
        copyUploadId = new DOMParser().parseFromString(create.text, "text/xml")
          .getElementsByTagName("UploadId")[0]?.textContent ?? "";
        if (!copyUploadId) throw new Error("no uploadId");
        const r = await s3Fetch(creds, host, "PUT", `/${b}/${MP_KEY2}`, `partNumber=1&uploadId=${encodeURIComponent(copyUploadId)}`, {
          "x-amz-copy-source": `/${b}/${PROBE_KEY}`,
        });
        push("UploadPartCopy", r);
      });
      await safe("CompleteMultipartUpload", async () => {
        const complete = `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>*</ETag></Part></CompleteMultipartUpload>`;
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
    let policyArn = "";
    await safe("ListPolicies", async () => {
      const r = await iamFetch(creds, host, "ListPolicies");
      push("ListPolicies", r);
      policyArn = /<Arn>([^<]+)<\/Arn>/.exec(r.text)?.[1] ?? "";
    });
    if (policyArn) {
      await safe("GetPolicy", async () =>
        push("GetPolicy", await iamFetch(creds, host, "GetPolicy", { PolicyArn: policyArn })));
      await safe("GetPolicyVersion", async () => {
        const g = await iamFetch(creds, host, "GetPolicy", { PolicyArn: policyArn });
        const versionId = /<DefaultVersionId>([^<]+)<\/DefaultVersionId>/.exec(g.text)?.[1] ?? "v1";
        push("GetPolicyVersion", await iamFetch(creds, host, "GetPolicyVersion", { PolicyArn: policyArn, VersionId: versionId }));
      });
    }
    if (creds.probeUser) {
      const u = creds.probeUser;
      await safe("ListAttachedUserPolicies", async () =>
        push("ListAttachedUserPolicies", await iamFetch(creds, host, "ListAttachedUserPolicies", { UserName: u })));
      await safe("ListAttachedGroupPolicies", async () =>
        push("ListAttachedGroupPolicies", await iamFetch(creds, host, "ListAttachedGroupPolicies", { GroupName: u })));
      if (policyArn) {
        await safe("AttachUserPolicy", async () =>
          push("AttachUserPolicy", await iamFetch(creds, host, "AttachUserPolicy", { PolicyArn: policyArn, UserName: u })));
        await safe("DetachUserPolicy", async () =>
          push("DetachUserPolicy", await iamFetch(creds, host, "DetachUserPolicy", { PolicyArn: policyArn, UserName: u })));
      }
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

export async function runChecks(env: Env): Promise<void> {
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
  const firstS3Host = ENDPOINTS.find((e) => e.service === "s3")!.url;
  const chains = ENDPOINTS.map((ep) => checkEndpoint(ep.key, ep.url, creds));
  chains.push(checkCanary(creds, firstS3Host));
  const settled = await Promise.allSettled(chains);

  const results: CheckResult[] = settled.flatMap((s) =>
    s.status === "fulfilled" ? s.value : [],
  );
  // Fill any missing op/endpoint cells as nodata-free (skip) — absent = nodata on read.

  const now = new Date();
  const slot = slotKey(now);
  const rows = results.map((r) => [slot, r.endpoint, r.op, r.status, r.latencyMs] as const);
  // D1 caps bound parameters per statement (~100): chunk rows.
  for (let i = 0; i < rows.length; i += 19) {
    const chunk = rows.slice(i, i + 19);
    const values = chunk.map(() => "(?,?,?,?,?)").join(",");
    const params = chunk.flat();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO status_slots (slot, endpoint, op, status, latency_ms) VALUES ${values}`,
    )
      .bind(...params)
      .run();
  }

  // 7-day retention (string compare on zero-padded keys)
  const cutoff = slotKey(new Date(now.getTime() - 7 * 24 * 3600 * 1000));
  await env.DB.prepare("DELETE FROM status_slots WHERE slot < ?").bind(cutoff).run();

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

export async function ensureStatusSchema(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS status_slots (
      slot TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      op TEXT NOT NULL,
      status TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      PRIMARY KEY (slot, endpoint, op)
    ) WITHOUT ROWID`,
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_status_slots_slot ON status_slots (slot)",
  ).run();
}
