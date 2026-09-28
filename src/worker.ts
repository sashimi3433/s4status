import { ENDPOINTS, REGIONS } from "./data/regions";
import { OPERATIONS } from "./data/operations";
import { SLOTS_PER_DAY, STATUS_OF, addDays, toDateStr } from "./data/mock";
import { openapiSpec } from "./api/openapi";
import { Db } from "./api/db";
import { ensureStatusSchema, runChecks, slotKey } from "./api/checker";

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
// Status read path (D1)
// ---------------------------------------------------------------------------

const ST_RANK = { operational: 0, degraded: 1, outage: 2 } as const;
const WORST_SQL = `CASE status WHEN 'operational' THEN 0 WHEN 'degraded' THEN 1 ELSE 2 END`;

/**
 * Latest check result per endpoint — each endpoint's own most recent slot
 * within the rotation window (not a single shared slot, since the rotation
 * checks different endpoints at different minutes).
 */
async function latestDataPerEndpoint(
  db: Db,
  now: Date,
): Promise<Map<string, { op: string; status: string }[]>> {
  await ensureStatusSchema(db);
  const since = slotKey(new Date(now.getTime() - 20 * 60_000));
  const results = await db.query<{ endpoint: string; op: string; status: string; slot: string }>(
    "SELECT endpoint, op, status, slot FROM status_slots WHERE slot >= $1 ORDER BY slot DESC",
    [since],
  );

  // Each endpoint's ops share the same slot (checked as one chain), so the
  // first slot seen per endpoint in DESC order is that endpoint's latest.
  const latestSlot = new Map<string, string>();
  for (const row of results) {
    if (!latestSlot.has(row.endpoint)) latestSlot.set(row.endpoint, row.slot);
  }

  const map = new Map<string, { op: string; status: string }[]>();
  for (const row of results) {
    if (latestSlot.get(row.endpoint) !== row.slot) continue;
    let list = map.get(row.endpoint);
    if (!list) {
      list = [];
      map.set(row.endpoint, list);
    }
    list.push({ op: row.op, status: row.status });
  }
  return map;
}

/** Worst status per endpoint from each endpoint's own latest check. */
async function currentStatusByEndpoint(
  db: Db,
  now: Date,
): Promise<Map<string, string>> {
  const perEp = await latestDataPerEndpoint(db, now);
  const map = new Map<string, string>();
  for (const [ep, ops] of perEp) {
    let worst: string = "operational";
    for (const { status } of ops) {
      if (ST_RANK[status as keyof typeof ST_RANK] > ST_RANK[worst as keyof typeof ST_RANK]) {
        worst = status;
      }
    }
    map.set(ep, worst);
  }
  return map;
}

async function uptimeByEndpointToday(db: Db, now: Date): Promise<Map<string, number | null>> {
  const start = slotKey(new Date(now.getTime() - 24 * 3600_000)); // trailing 24h
  const r = await db.query<{ endpoint: string; total: number; ok: number | null }>(
    "SELECT endpoint, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'operational') AS ok FROM status_slots WHERE slot >= $1 GROUP BY endpoint",
    [start],
  );
  return new Map(
    r.map((row) => [
      row.endpoint,
      row.total ? Math.round((Number(row.ok ?? 0) / row.total) * 10000) / 100 : null,
    ]),
  );
}

async function endpointList(db: Db, now: Date) {
  const [statusMap, upMap] = await Promise.all([
    currentStatusByEndpoint(db, now),
    uptimeByEndpointToday(db, now),
  ]);
  return ENDPOINTS.map((ep) => {
    const region = REGIONS.find((r) => r.id === ep.regionId)!;
    return {
      key: ep.key,
      service: ep.service,
      region: ep.regionId,
      city: region.city,
      zone: region.zone,
      url: ep.url,
      status: statusMap.get(ep.key) ?? "nodata",
      uptime24h: upMap.get(ep.key) ?? null,
    };
  });
}

async function handleOverview(db: Db, now: Date): Promise<Response> {
  const perEpData = await latestDataPerEndpoint(db, now);
  const statusMap = new Map<string, string>();
  for (const [ep, ops] of perEpData) {
    let worst: string = "operational";
    for (const { status } of ops) {
      if (ST_RANK[status as keyof typeof ST_RANK] > ST_RANK[worst as keyof typeof ST_RANK]) {
        worst = status;
      }
    }
    statusMap.set(ep, worst);
  }
  const upMap = await uptimeByEndpointToday(db, now);
  const endpoints = ENDPOINTS.map((ep) => {
    const region = REGIONS.find((r) => r.id === ep.regionId)!;
    return {
      key: ep.key,
      service: ep.service,
      region: ep.regionId,
      city: region.city,
      zone: region.zone,
      url: ep.url,
      status: statusMap.get(ep.key) ?? "nodata",
      uptime24h: upMap.get(ep.key) ?? null,
    };
  });

  const affected = endpoints.filter((e) => e.status === "degraded" || e.status === "outage");
  const overall = affected.some((e) => e.status === "outage")
    ? "outage"
    : affected.length > 0
      ? "degraded"
      : statusMap.size > 0
        ? "operational"
        : "nodata";

  // Longest contiguous non-operational tail (up to 24h back) per affected endpoint
  let incidentMinutes = 0;
  const since = `${addDays(toDateStr(now), -1)} 00:00`;
  for (const e of affected) {
    const r = await db.query<{ slot: string; worst: number }>(
      `SELECT slot, MIN(${WORST_SQL}) AS worst FROM status_slots WHERE endpoint = $1 AND slot >= $2 GROUP BY slot ORDER BY slot DESC LIMIT 288`,
      [e.key, since],
    );
    let run = 0;
    for (const row of r) {
      if (row.worst > 0) run++;
      else break;
    }
    incidentMinutes = Math.max(incidentMinutes, run * 5);
  }
  const affectedOperations = (() => {
    const failing = new Set<string>();
    for (const [, ops] of perEpData) {
      for (const { op, status } of ops) {
        if (status !== "operational") failing.add(op);
      }
    }
    return failing.size;
  })();

  return json({
    generatedAt: now.toISOString(),
    overall,
    affectedEndpoints: affected.length,
    incidentMinutes,
    affectedOperations,
    slotMinutes: 15,
    historyDays: 7,
    operationCount: OPERATIONS.length,
    endpointCount: ENDPOINTS.length,
    endpoints,
  });
}

async function handleTimeline(url: URL, db: Db, now: Date): Promise<Response> {
  const todayStr = toDateStr(now);
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
    slotStart = h * 4;
    slotCount = 4;
  }

  // Viewer timezone offset (minutes east of UTC): the returned day window is
  // midnight-to-midnight in that offset. Data itself is always stored in UTC.
  const tzRaw = Number(url.searchParams.get("tz") ?? "0");
  const tzMin = Number.isFinite(tzRaw) ? Math.max(-840, Math.min(840, Math.round(tzRaw))) : 0;
  const startUtcMs = Date.parse(`${date}T00:00:00Z`) - tzMin * 60_000;
  const endUtcMs = startUtcMs + 86_400_000 - 1;

  await ensureStatusSchema(db);
  const fromSlot = slotKey(new Date(startUtcMs));
  const toSlot = slotKey(new Date(endUtcMs));
  const results =
    endpoint === "all"
      ? await db.query<{ slot: string; op: string; worst: number }>(
          `SELECT slot, op, MIN(${WORST_SQL}) AS worst FROM status_slots WHERE slot >= $1 AND slot <= $2 GROUP BY slot, op`,
          [fromSlot, toSlot],
        )
      : await db.query<{ slot: string; op: string; worst: number }>(
          `SELECT slot, op, MIN(${WORST_SQL}) AS worst FROM status_slots WHERE slot >= $1 AND slot <= $2 AND endpoint = $3 GROUP BY slot, op`,
          [fromSlot, toSlot, endpoint],
        );

  const byOp = new Map<string, Uint8Array>(
    OPERATIONS.map((op) => [op.id, new Uint8Array(SLOTS_PER_DAY).fill(3)]),
  );
  for (const row of results) {
    const utcMs = Date.parse(`${row.slot.replace(" ", "T")}Z`);
    const idx = Math.floor((utcMs - startUtcMs) / 900_000); // 15-min slots
    // worst across the 3 consecutive 5-min storage slots inside this 15-min slot
    const arr = byOp.get(row.op);
    if (arr && idx >= 0 && idx < SLOTS_PER_DAY) {
      arr[idx] = arr[idx] === 3 ? row.worst : Math.max(arr[idx]!, row.worst);
    }
  }

  const operations = OPERATIONS.map((op) => {
    const codes = byOp.get(op.id)!;
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
    slotMinutes: 15,
    slots: slotCount,
    firstSlotMinutes: slotStart * 5,
    generatedAt: now.toISOString(),
    operations,
  });
}

// ---------------------------------------------------------------------------
// Subscriptions. The (lowercased) email address is the record ID: POSTing
// again with the same address updates it in place. The token authenticates
// view/delete/unsubscribe links (used in the List-Unsubscribe header of
// notification emails).
// ---------------------------------------------------------------------------

interface Subscription {
  email: string;
  services: ("s3" | "iam")[];
  regions: string[]; // [] = all regions
  endpoints: string[]; // [] = all endpoints
  token: string;
  createdAt: string;
  updatedAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface SubRow {
  email: string;
  services: string;
  regions: string;
  endpoints: string;
  token: string;
  created_at: string;
  updated_at: string;
}

function rowToSub(r: SubRow): Subscription {
  return {
    email: r.email,
    services: JSON.parse(r.services) as ("s3" | "iam")[],
    regions: JSON.parse(r.regions) as string[],
    endpoints: JSON.parse(r.endpoints) as string[],
    token: r.token,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}


function tokenHex(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseSubscribeBody(
  body: unknown,
): { ok: true; data: Omit<Subscription, "token" | "createdAt" | "updatedAt"> } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return { ok: false, error: "invalid email address" };

  const services: ("s3" | "iam")[] = Array.isArray(b.services)
    ? [...new Set(b.services.filter((s): s is "s3" | "iam" => s === "s3" || s === "iam"))].sort()
    : ["s3", "iam"];
  if (services.length === 0) return { ok: false, error: "services must contain 's3' and/or 'iam'" };

  const wantsAll = (list: unknown) =>
    !Array.isArray(list) || list.length === 0 || (list as unknown[]).includes("all");
  const pickValid = (list: unknown, valid: (v: string) => boolean) =>
    wantsAll(list)
      ? []
      : [...new Set((list as unknown[]).filter((r): r is string => typeof r === "string" && valid(r)))];

  const regions = pickValid(b.regions, (r) => REGIONS.some((x) => x.id === r));
  if (!wantsAll(b.regions) && regions.length === 0) {
    return { ok: false, error: "invalid regions (see /api/endpoints for region IDs)" };
  }
  const endpoints = pickValid(b.endpoints, (k) => ENDPOINTS.some((e) => e.key === k));
  if (!wantsAll(b.endpoints) && endpoints.length === 0) {
    return { ok: false, error: "invalid endpoints (see /api/endpoints for endpoint keys)" };
  }
  return { ok: true, data: { email, services, regions, endpoints } };
}

function subscriptionView(s: Subscription, origin: string) {
  return {
    email: s.email,
    services: s.services,
    regions: s.regions.length ? s.regions : "all",
    endpoints: s.endpoints.length ? s.endpoints : "all",
    unsubscribeUrl: `${origin}/api/unsubscribe?email=${encodeURIComponent(s.email)}&token=${s.token}`,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

async function handleSubscribe(request: Request, db: Db): Promise<Response> {
  await ensureStatusSchema(db);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const parsed = parseSubscribeBody(body);
  if (!parsed.ok) return badRequest(parsed.error);
  const { email, services, regions, endpoints } = parsed.data;

  const origin = new URL(request.url).origin;
  const now = new Date().toISOString();
  const existingRows = await db.query<SubRow>(
    "SELECT * FROM subscriptions WHERE email = $1",
    [email],
  );
  const existing = existingRows[0];
  if (existing) {
    await db.query(
      "UPDATE subscriptions SET services = $1, regions = $2, endpoints = $3, updated_at = $4 WHERE email = $5",
      [JSON.stringify(services), JSON.stringify(regions), JSON.stringify(endpoints), now, email],
    );
    const sub: Subscription = {
      email,
      services,
      regions,
      endpoints,
      token: existing.token,
      createdAt: existing.created_at,
      updatedAt: now,
    };
    return json({ ok: true, updated: true, subscription: subscriptionView(sub, origin) }, 200);
  }
  const sub: Subscription = {
    email,
    services,
    regions,
    endpoints,
    token: tokenHex(),
    createdAt: now,
    updatedAt: now,
  };
  await db.query(
    "INSERT INTO subscriptions (email, services, regions, endpoints, token, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      email,
      JSON.stringify(services),
      JSON.stringify(regions),
      JSON.stringify(endpoints),
      sub.token,
      now,
      now,
    ],
  );
  return json({ ok: true, updated: false, subscription: subscriptionView(sub, origin) }, 201);
}

async function requireSubscription(url: URL, db: Db): Promise<Subscription | null> {
  await ensureStatusSchema(db);
  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("token") ?? "";
  if (!email || !token) return null;
  const rows = await db.query<SubRow>("SELECT * FROM subscriptions WHERE email = $1", [email]);
  const row = rows[0];
  return row && row.token === token ? rowToSub(row) : null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One-click unsubscribe landing page (linked from List-Unsubscribe headers). */
async function handleUnsubscribePage(url: URL, db: Db): Promise<Response> {
  const sub = await requireSubscription(url, db);
  const page = (title: string, body: string, status: number) =>
    new Response(
      `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — MEGA S4 Status</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
           background: #09090b; color: #fafafa;
           font-family: -apple-system, "Helvetica Neue", "Hiragino Sans", sans-serif; }
    main { text-align: center; padding: 2rem; }
    h1 { font-size: 1.4rem; margin: 0 0 .75rem; }
    p { color: #a1a1aa; margin: .25rem 0; }
    a { color: #34d399; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`,
      { status, headers: { "Content-Type": "text/html; charset=utf-8", ...CORS_HEADERS } },
    );

  if (!sub) {
    return page(
      "配信停止",
      "<h1>リンクが無効です</h1><p>この解除リンクは存在しないか、すでに使用されました。</p><p><a href=\"/\">MEGA S4 Status に戻る</a></p>",
      404,
    );
  }
  await db.query("DELETE FROM subscriptions WHERE email = $1", [sub.email]);
  return page(
    "配信停止",
    `<h1>通知配信を停止しました</h1><p>Unsubscribed: ${escapeHtml(sub.email)}</p><p><a href="/">MEGA S4 Status に戻る</a></p>`,
    200,
  );
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const now = new Date();

    if (url.pathname === "/docs") return docsPage(url.searchParams.get("lang"));
    if (url.pathname === "/robots.txt") {
      return new Response(
        "User-agent: *\nAllow: /\nAllow: /docs\nDisallow: /api/\n\nSitemap: https://s4status.sessapps.com/sitemap.xml\n",
        { headers: { "Content-Type": "text/plain" } },
      );
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
      const db = Db.fromEnv(env);

      if (
        request.method !== "GET" &&
        url.pathname !== "/api/subscribe" &&
        url.pathname !== "/api/subscriptions" &&
        url.pathname !== "/api/unsubscribe"
      ) {
        return json({ error: "method not allowed" }, 405, rate);
      }

      switch (url.pathname) {
        case "/api/overview":
          return handleOverview(db, now);
        case "/api/endpoints":
          return json({ count: ENDPOINTS.length, endpoints: await endpointList(db, now) }, 200, rate);
        case "/api/operations":
          return json({ count: OPERATIONS.length, operations: OPERATIONS }, 200, rate);
        case "/api/timeline":
          return handleTimeline(url, db, now);
        case "/api/subscribe":
          if (request.method !== "POST") return json({ error: "method not allowed" }, 405, rate);
          return handleSubscribe(request, db);
        case "/api/subscriptions":
          if (request.method !== "GET" && request.method !== "DELETE") {
            return json({ error: "method not allowed" }, 405, rate);
          }
          {
            const sub = await requireSubscription(url, db);
            if (!sub) return json({ error: "not found or invalid token" }, 404, rate);
            if (request.method === "DELETE") {
              await db.query("DELETE FROM subscriptions WHERE email = $1", [sub.email]);
              return json({ ok: true, unsubscribed: true, email: sub.email }, 200, rate);
            }
            return json(
              { subscription: subscriptionView(sub, url.origin) },
              200,
              rate,
            );
          }
        case "/api/unsubscribe":
          if (request.method === "POST") {
            // GUI unsubscribe: email-only, idempotent — always 200 {ok:true}.
            let body: unknown;
            try {
              body = await request.json();
            } catch {
              return badRequest("invalid JSON body");
            }
            const email =
              typeof (body as { email?: unknown })?.email === "string"
                ? ((body as { email: string }).email).trim().toLowerCase()
                : "";
            if (!EMAIL_RE.test(email)) return badRequest("invalid email address");
            await ensureStatusSchema(db);
            await db.query("DELETE FROM subscriptions WHERE email = $1", [email]);
            return json({ ok: true }, 200, rate);
          }
          return handleUnsubscribePage(url, db);
        default:
          return json({ error: "not found" }, 404, rate);
      }
    }

    // Any other path falls through to the static assets (SPA fallback via
    // not_found_handling, so deep links still serve index.html).
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const db = Db.fromEnv(env);
    ctx.waitUntil(
      (async () => {
        try {
          await ensureStatusSchema(db);
          await runChecks(env, db);
        } catch (e) {
          console.error("[checker] scheduled run failed:", e);
        }
      })(),
    );
  },
};
