import { ENDPOINTS, REGIONS } from "./data/regions";
import { OPERATIONS } from "./data/operations";
import {
  SLOTS_PER_DAY,
  STATUS_OF,
  addDays,
  currentSlotOf,
  dayStatusCodes,
  endpointWorstDay,
  toDateStr,
} from "./data/mock";
import { openapiSpec } from "./api/openapi";

// ---------------------------------------------------------------------------
// Rate limiting: 100 requests / minute / IP across all /api/* endpoints.
// In-memory fixed window (per isolate) — no external binding required.
// ---------------------------------------------------------------------------

const RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

interface RateResult {
  ok: boolean;
  remaining: number;
  resetSec: number;
}

function rateLimit(ip: string): RateResult {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt <= now) {
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: RATE_LIMIT - 1, resetSec: 60 };
  }
  const resetSec = Math.ceil((b.resetAt - now) / 1000);
  if (b.count >= RATE_LIMIT) return { ok: false, remaining: 0, resetSec };
  b.count++;
  return { ok: true, remaining: RATE_LIMIT - b.count, resetSec };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200, rate?: RateResult): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  };
  if (rate) {
    headers["X-RateLimit-Limit"] = String(RATE_LIMIT);
    headers["X-RateLimit-Remaining"] = String(rate.remaining);
    headers["X-RateLimit-Reset"] = String(rate.resetSec);
    if (status === 429) headers["Retry-After"] = String(rate.resetSec);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

const badRequest = (msg: string) => json({ error: msg }, 400);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function endpointList(now: Date) {
  const todayStr = toDateStr(now);
  const currentSlot = currentSlotOf(now);
  return ENDPOINTS.map((ep) => {
    const region = REGIONS.find((r) => r.id === ep.regionId)!;
    const codes = endpointWorstDay(ep.key, todayStr, todayStr, currentSlot);
    let measured = 0;
    let ok = 0;
    for (let s = 0; s <= currentSlot; s++) {
      const c = codes[s]!;
      if (c === 3) continue;
      measured++;
      if (c === 0) ok++;
    }
    return {
      key: ep.key,
      service: ep.service,
      region: ep.regionId,
      city: region.city,
      zone: region.zone,
      url: ep.url,
      status: STATUS_OF[codes[currentSlot]!]!,
      uptime24h: measured === 0 ? null : Math.round((ok / measured) * 10000) / 100,
    };
  });
}

function handleOverview(now: Date): Response {
  const endpoints = endpointList(now);
  const overall = endpoints.reduce<string>((acc, ep) => {
    if (ep.status === "outage") return "outage";
    return ep.status === "degraded" && acc !== "outage" ? "degraded" : acc;
  }, "operational");
  const rank = { operational: 0, degraded: 1, outage: 2, nodata: 0 } as const;
  const affected = endpoints.filter((ep) => rank[ep.status as keyof typeof rank] > 0).length;
  return json({
    generatedAt: now.toISOString(),
    overall,
    affectedEndpoints: affected,
    slotMinutes: 5,
    historyDays: 7,
    operationCount: OPERATIONS.length,
    endpointCount: ENDPOINTS.length,
    endpoints,
  });
}

function handleTimeline(url: URL, now: Date): Response {
  const todayStr = toDateStr(now);
  const currentSlot = currentSlotOf(now);
  const minDate = addDays(todayStr, -6);

  let date = url.searchParams.get("date") ?? todayStr;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return badRequest("invalid date: expected YYYY-MM-DD");
  }
  if (date > todayStr) date = todayStr;
  if (date < minDate) date = minDate;

  const endpoint = url.searchParams.get("endpoint") ?? "all";
  if (endpoint !== "all" && !ENDPOINTS.some((e) => e.key === endpoint)) {
    return badRequest(`unknown endpoint '${endpoint}'; use 'all' or a key from /api/endpoints`);
  }

  const hourParam = url.searchParams.get("hour");
  let slotStart = 0;
  let slotCount = SLOTS_PER_DAY;
  let hour: number | null = null;
  if (hourParam !== null && hourParam !== "all") {
    const h = Number(hourParam);
    if (!Number.isInteger(h) || h < 0 || h > 23) {
      return badRequest("invalid hour: expected 0-23 or 'all'");
    }
    hour = h;
    slotStart = h * 12;
    slotCount = 12;
  }

  const operations = OPERATIONS.map((op) => {
    const codes = dayStatusCodes(op.id, endpoint, date, todayStr, currentSlot);
    const slice = codes.subarray(slotStart, slotStart + slotCount);
    const statuses: string[] = [];
    let measured = 0;
    let ok = 0;
    for (let i = 0; i < slice.length; i++) {
      const st = STATUS_OF[slice[i]!]!;
      statuses.push(st);
      if (st !== "nodata") {
        measured++;
        if (st === "operational") ok++;
      }
    }
    return {
      id: op.id,
      api: op.api,
      group: op.group,
      uptime: measured === 0 ? null : Math.round((ok / measured) * 10000) / 100,
      statuses,
    };
  });

  return json({
    date,
    endpoint,
    view: hour === null ? "day" : "hour",
    hour,
    slotMinutes: 5,
    slots: slotCount,
    firstSlotMinutes: slotStart * 5,
    generatedAt: now.toISOString(),
    operations,
  });
}

const subscriptions = new Set<string>();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function handleSubscribe(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const b = body as { email?: unknown; services?: unknown };
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (!EMAIL_RE.test(email)) return badRequest("invalid email address");

  const services = Array.isArray(b.services)
    ? [...new Set(b.services.filter((s): s is "s3" | "iam" => s === "s3" || s === "iam"))].sort()
    : ["s3", "iam"];
  if (services.length === 0) return badRequest("services must contain 's3' and/or 'iam'");

  subscriptions.add(`${email}|${services.join(",")}`);
  return json({ ok: true, email, services }, 201);
}

/** Scalar API reference (loads the OpenAPI spec from /api/openapi.json,
 *  with a Japanese spec when ?lang=ja is given). */
function docsPage(lang: string | null): Response {
  const specUrl = lang === "ja" ? "/api/openapi.json?lang=ja" : "/api/openapi.json";
  const html = `<!doctype html>
<html lang="${lang === "ja" ? "ja" : "en"}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MEGA S4 Status API — Scalar</title>
  <meta name="description" content="API reference for the MEGA S4 Status API (unofficial)" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="MEGA S4 Status" />
  <meta property="og:title" content="MEGA S4 Status API (unofficial)" />
  <meta property="og:description" content="Public status API for MEGA S4 and its IAM API — no auth, 100 requests/minute. Interactive documentation." />
  <meta property="og:url" content="https://s4status.sessapps.com/docs" />
  <meta property="og:image" content="https://s4status.sessapps.com/ogp.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="MEGA S4 Status API (unofficial)" />
  <meta name="twitter:description" content="Public status API for MEGA S4 and its IAM API — no auth, 100 requests/minute." />
  <meta name="twitter:image" content="https://s4status.sessapps.com/ogp.png" />
  <style>body { margin: 0; }</style>
</head>
<body>
  <script id="api-reference" data-url="${specUrl}"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: { ASSETS: { fetch: (req: Request) => Promise<Response> } }): Promise<Response> {
    const url = new URL(request.url);
    const now = new Date();

    if (url.pathname === "/docs") return docsPage(url.searchParams.get("lang"));
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", { headers: { "Content-Type": "text/plain" } });
    }

    if (url.pathname.startsWith("/api/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const rate = rateLimit(ip);

      if (url.pathname === "/api/openapi.json") {
        return json(openapiSpec(url.searchParams.get("lang")), 200, rate);
      }
      if (!rate.ok) {
        return json({ error: "rate limit exceeded (100 requests/minute)" }, 429, rate);
      }

      if (request.method !== "GET" && url.pathname !== "/api/subscribe") {
        return json({ error: "method not allowed" }, 405, rate);
      }

      switch (url.pathname) {
        case "/api/overview":
          return handleOverview(now);
        case "/api/endpoints":
          return json({ count: ENDPOINTS.length, endpoints: endpointList(now) }, 200, rate);
        case "/api/operations":
          return json({ count: OPERATIONS.length, operations: OPERATIONS }, 200, rate);
        case "/api/timeline":
          return handleTimeline(url, now);
        case "/api/subscribe":
          if (request.method !== "POST") return json({ error: "method not allowed" }, 405, rate);
          return handleSubscribe(request);
        default:
          return json({ error: "not found" }, 404, rate);
      }
    }

    // Any other path falls through to the static assets (SPA fallback via
    // not_found_handling, so deep links still serve index.html).
    return env.ASSETS.fetch(request);
  },
};
