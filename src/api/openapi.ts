/** OpenAPI 3.1 specification for the S4Status public API. */
export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "MEGA S4 Status API (unofficial)",
    version: "1.0.0",
    description:
      "Status API for MEGA S4 (S3-compatible object storage) and its IAM API, " +
      "served by https://s4status.sessapps.workers.dev .\n\n" +
      "- **No authentication required** — all endpoints are public.\n" +
      "- **Rate limit: 100 requests / minute / IP** across all `/api/*` endpoints. " +
      "Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and " +
      "`X-RateLimit-Reset` headers; exceeding the limit returns `429` with `Retry-After`.\n" +
      "- Statuses are recorded in **5-minute slots**; history covers **7 days** including today.\n" +
      "- `status` enum: `operational` (正常) / `degraded` (低下) / `outage` (障害) / `nodata` (データなし).",
    contact: { name: "S4Status", url: "https://github.com/sashimi3433/s4status", email: "contact@sessapps.com" },
  },
  servers: [{ url: "/", description: "This deployment" }],
  tags: [
    { name: "status", description: "Current status" },
    { name: "timeline", description: "Per-operation slot history" },
    { name: "reference", description: "Monitored endpoints and operations" },
    { name: "notifications", description: "Incident email notifications" },
  ],
  paths: {
    "/api/overview": {
      get: {
        tags: ["status"],
        summary: "Overall status + current status of every endpoint",
        description:
          "The same information as the top of the status page: overall status, " +
          "number of affected endpoints, and per-endpoint current status with today's uptime.",
        responses: {
          200: {
            description: "OK",
            headers: rateHeaders(),
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Overview" } },
            },
          },
          429: tooManyRequests(),
        },
      },
    },
    "/api/endpoints": {
      get: {
        tags: ["reference"],
        summary: "List of monitored endpoints (28)",
        description:
          "7 cities × 2 zones = 14 regions, each with an S3 and an IAM endpoint " +
          "(`{s3|iam}.<region>.megas4.com`). Includes the current status of each.",
        responses: {
          200: {
            description: "OK",
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "integer", example: 28 },
                    endpoints: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Endpoint" },
                    },
                  },
                },
              },
            },
          },
          429: tooManyRequests(),
        },
      },
    },
    "/api/operations": {
      get: {
        tags: ["reference"],
        summary: "List of monitored API operations (34)",
        description:
          "25 S3 API operations (buckets / objects / multipart / policies) and " +
          "9 IAM API operations (policies), as covered by MEGA S4.",
        responses: {
          200: {
            description: "OK",
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "integer", example: 34 },
                    operations: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Operation" },
                    },
                  },
                },
              },
            },
          },
          429: tooManyRequests(),
        },
      },
    },
    "/api/timeline": {
      get: {
        tags: ["timeline"],
        summary: "Per-operation status slots for one day (or one hour)",
        description:
          "5-minute status slots for every monitored operation — the data behind the " +
          "timeline chart. Day view returns 288 slots per operation; hour view returns 12. " +
          "`uptime` is the operational share of the measured slots in the returned window.",
        parameters: [
          {
            name: "date",
            in: "query",
            description: "Date to inspect (YYYY-MM-DD). Default: today. Range: last 7 days including today.",
            schema: { type: "string", format: "date", example: "2026-09-28" },
          },
          {
            name: "endpoint",
            in: "query",
            description:
              "`all` (default) aggregates the worst status across every endpoint, " +
              "or a specific endpoint key such as `s3:ap-tokyo-1` / `iam:eu-paris-2` (see /api/endpoints).",
            schema: { type: "string", default: "all", example: "s3:ap-tokyo-1" },
          },
          {
            name: "hour",
            in: "query",
            description:
              "Omit (or `all`) for the full 24h day view; `0`–`23` zooms into that hour (12 slots).",
            schema: { type: "string", default: "all", example: "14" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            headers: rateHeaders(),
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Timeline" } },
            },
          },
          400: badRequest(),
          429: tooManyRequests(),
        },
      },
    },
    "/api/subscribe": {
      post: {
        tags: ["notifications"],
        summary: "Subscribe an email address to incident notifications",
        description:
          "Registers an email address for MEGA S4 / IAM incident notifications. " +
          "Choose one or both services.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email", example: "you@example.com" },
                  services: {
                    type: "array",
                    items: { type: "string", enum: ["s3", "iam"] },
                    default: ["s3", "iam"],
                    example: ["s3", "iam"],
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Subscription accepted",
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    email: { type: "string", example: "you@example.com" },
                    services: { type: "array", items: { type: "string", enum: ["s3", "iam"] } },
                  },
                },
              },
            },
          },
          400: badRequest(),
          429: tooManyRequests(),
        },
      },
    },
  },
  components: {
    schemas: {
      Status: {
        type: "string",
        enum: ["operational", "degraded", "outage", "nodata"],
      },
      Endpoint: {
        type: "object",
        properties: {
          key: { type: "string", example: "s3:ap-tokyo-1" },
          service: { type: "string", enum: ["s3", "iam"] },
          region: { type: "string", example: "ap-tokyo-1" },
          city: { type: "string", example: "Tokyo" },
          zone: { type: "integer", enum: [1, 2] },
          url: { type: "string", example: "s3.ap-tokyo-1.megas4.com" },
          status: { $ref: "#/components/schemas/Status" },
          uptime24h: { type: "number", nullable: true, example: 99.98 },
        },
      },
      Operation: {
        type: "object",
        properties: {
          id: { type: "string", example: "ListBuckets" },
          api: { type: "string", enum: ["s3", "iam"] },
          group: {
            type: "string",
            enum: ["buckets", "objects", "multipart", "policies", "iam-policies"],
          },
        },
      },
      TimelineRow: {
        type: "object",
        properties: {
          id: { type: "string", example: "ListBuckets" },
          api: { type: "string", enum: ["s3", "iam"] },
          group: { type: "string" },
          uptime: { type: "number", nullable: true, example: 100 },
          statuses: {
            type: "array",
            items: { $ref: "#/components/schemas/Status" },
            description: "One entry per 5-minute slot, in chronological order.",
          },
        },
      },
      Timeline: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          endpoint: { type: "string", example: "all" },
          view: { type: "string", enum: ["day", "hour"] },
          hour: { type: "integer", nullable: true, example: 14 },
          slotMinutes: { type: "integer", example: 5 },
          slots: { type: "integer", example: 288 },
          firstSlotMinutes: { type: "integer", example: 0, description: "Minutes from 00:00 to the first returned slot." },
          generatedAt: { type: "string", format: "date-time" },
          operations: { type: "array", items: { $ref: "#/components/schemas/TimelineRow" } },
        },
      },
      Overview: {
        type: "object",
        properties: {
          generatedAt: { type: "string", format: "date-time" },
          overall: { $ref: "#/components/schemas/Status" },
          affectedEndpoints: { type: "integer", example: 2 },
          slotMinutes: { type: "integer", example: 5 },
          historyDays: { type: "integer", example: 7 },
          operationCount: { type: "integer", example: 34 },
          endpointCount: { type: "integer", example: 28 },
          endpoints: { type: "array", items: { $ref: "#/components/schemas/Endpoint" } },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "invalid parameter" },
        },
      },
    },
  },
} as const;

function rateHeaders() {
  return {
    "X-RateLimit-Limit": { description: "Requests allowed per minute", schema: { type: "integer", example: 100 } },
    "X-RateLimit-Remaining": { description: "Requests remaining in the current window", schema: { type: "integer" } },
    "X-RateLimit-Reset": { description: "Seconds until the window resets", schema: { type: "integer" } },
  };
}

function badRequest() {
  return {
    description: "Invalid parameter or body",
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
}

function tooManyRequests() {
  return {
    description: "Rate limit exceeded (100 requests/minute/IP)",
    headers: {
      "Retry-After": { description: "Seconds until the window resets", schema: { type: "integer" } },
    },
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
}
