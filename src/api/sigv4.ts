/** Minimal AWS Signature V4 signer for the S4 checker (WebCrypto). */

const encoder = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(data)));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

export interface SigV4Params {
  method: string;
  /** Full URL (query params included). */
  url: URL;
  service: "s3" | "iam";
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Extra headers to include in signing (e.g. x-amz-copy-source, content-type). */
  headers?: Record<string, string>;
  /** Precomputed payload hash; S3 requests use UNSIGNED-PAYLOAD by default. */
  payloadHash?: string;
}

/** RFC3986 encode with unreserved chars kept, path segments slash-separated. */
function uriEncode(value: string, encodeSlash: boolean): string {
  let out = "";
  for (const ch of value) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) out += ch;
    else if (ch === "/") out += encodeSlash ? "%2F" : "/";
    else out += "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

export async function sigv4Headers(params: SigV4Params): Promise<Record<string, string>> {
  const { method, url, service, accessKeyId, secretAccessKey, region } = params;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = params.payloadHash ?? "UNSIGNED-PAYLOAD";

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...Object.fromEntries(
      Object.entries(params.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
    ),
  };
  if (method === "POST" && !headers["content-type"]) {
    headers["content-type"] = "application/x-www-form-urlencoded";
  }

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]!.trim()}\n`).join("");
  const signedHeaders = sortedKeys.join(";");

  const canonicalUri = url.pathname
    .split("/")
    .map((seg) => uriEncode(seg, true))
    .join("/");
  const canonicalQuery = [...url.searchParams.entries()]
    .map(([k, v]) => [uriEncode(k, true), uriEncode(v, true)] as const)
    .sort(([ak, av], [bk, bv]) => (ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk)))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = await hmacHex(encoder.encode(`AWS4${secretAccessKey}`).slice().buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmacHex(kDate, region);
  const kService = await hmacHex(kRegion, service);
  const kSigning = await hmacHex(kService, "aws4_request");
  const signature = hex(await hmacHex(kSigning, stringToSign));

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

/** SHA-256 hex of a body (for IAM POST requests). */
export function bodyHash(body: string): Promise<string> {
  return sha256Hex(body);
}
