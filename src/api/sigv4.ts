/** Minimal AWS Signature V4 signer for the S4 checker (WebCrypto). */

const encoder = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(data)));
}

async function importHmacKey(raw: BufferSource): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

/**
 * Derived SigV4 signing key, cached per (date, region, service). The key chain
 * (kDate → kRegion → kService → kSigning) is constant within a UTC day, but
 * re-deriving it per request costs 4 HMAC + 4 importKey calls — on the free
 * plan's 10 ms CPU limit that alone was enough to kill a full checker run
 * (outcome "exceededCpu"). Caching cuts ~13 WebCrypto calls per request to ~3.
 */
const signingKeys = new Map<string, Promise<CryptoKey>>();

function signingKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<CryptoKey> {
  const cacheKey = `${dateStamp}:${region}:${service}`;
  let p = signingKeys.get(cacheKey);
  if (!p) {
    p = (async () => {
      const kDate = await crypto.subtle.sign(
        "HMAC",
        await importHmacKey(encoder.encode(`AWS4${secretAccessKey}`)),
        encoder.encode(dateStamp),
      );
      const kRegion = await crypto.subtle.sign("HMAC", await importHmacKey(kDate), encoder.encode(region));
      const kService = await crypto.subtle.sign("HMAC", await importHmacKey(kRegion), encoder.encode(service));
      const kSigning = await crypto.subtle.sign("HMAC", await importHmacKey(kService), encoder.encode("aws4_request"));
      return importHmacKey(kSigning);
    })();
    signingKeys.set(cacheKey, p);
  }
  return p;
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

// RFC3986 unreserved chars (table lookup is much cheaper than a regex per char).
const UNRESERVED = new Uint8Array(128);
{
  const s = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  for (let i = 0; i < s.length; i++) UNRESERVED[s.charCodeAt(i)] = 1;
}

/** RFC3986 encode with unreserved chars kept, path segments slash-separated. */
function uriEncode(value: string, encodeSlash: boolean): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c < 128 && UNRESERVED[c]) out += value[i];
    else if (c === 0x2f /* / */) out += encodeSlash ? "%2F" : "/";
    else out += "%" + c.toString(16).toUpperCase().padStart(2, "0");
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

  const key = await signingKey(secretAccessKey, dateStamp, region, service);
  const signature = hex(await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign)));

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return headers;
}

/** SHA-256 hex of a body (for IAM POST requests). */
export function bodyHash(body: string): Promise<string> {
  return sha256Hex(body);
}
