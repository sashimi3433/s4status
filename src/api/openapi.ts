/**
 * OpenAPI 3.1 specification for the S4Status public API.
 * Built from a localized string table: English (default) + Japanese (?lang=ja).
 */

interface SpecStrings {
  title: string;
  description: string;
  tagStatus: string;
  tagTimeline: string;
  tagReference: string;
  tagNotifications: string;
  overviewSummary: string;
  overviewDesc: string;
  endpointsSummary: string;
  endpointsDesc: string;
  operationsSummary: string;
  operationsDesc: string;
  timelineSummary: string;
  timelineDesc: string;
  subscribeSummary: string;
  subscribeDesc: string;
  reqRegions: string;
  reqEndpoints: string;
  respUpdated: string;
  subGetSummary: string;
  subGetDesc: string;
  subDeleteSummary: string;
  subDeleteDesc: string;
  unsubSummary: string;
  unsubDesc: string;
  unsubPostSummary: string;
  unsubPostDesc: string;
  paramEmail: string;
  paramToken: string;
  resp404: string;
  paramDate: string;
  paramEndpoint: string;
  paramHour: string;
  paramTz: string;
  emailDesc: string;
  servicesDesc: string;
  resp200: string;
  resp201: string;
  resp400: string;
  resp429: string;
  hdrLimit: string;
  hdrRemaining: string;
  hdrReset: string;
  retryAfter: string;
  statusesDesc: string;
  firstSlotDesc: string;
}

const EN: SpecStrings = {
  title: "MEGA S4 Status API (unofficial)",
  description:
    "Status API for MEGA S4 (S3-compatible object storage) and its IAM API, " +
    "served by https://s4status.sessapps.com .\n\n" +
    "- **No authentication required** — all endpoints are public.\n" +
    "- **Rate limit: 100 requests / minute / IP** across all `/api/*` endpoints. " +
    "Responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and " +
    "`X-RateLimit-Reset` headers; exceeding the limit returns `429` with `Retry-After`.\n" +
    "- Every endpoint is checked **at least every 15 minutes**; statuses are recorded in **5-minute slots**; history covers **7 days** including today.\n" +
    "- `status` enum: `operational` / `degraded` / `outage` / `nodata`.",
  tagStatus: "Current status",
  tagTimeline: "Per-operation slot history",
  tagReference: "Monitored endpoints and operations",
  tagNotifications: "Incident email notifications",
  overviewSummary: "Overall status + current status of every endpoint",
  overviewDesc:
    "The same information as the top of the status page: overall status, " +
    "number of affected endpoints, and per-endpoint current status with today's uptime.",
  endpointsSummary: "List of monitored endpoints (28)",
  endpointsDesc:
    "7 cities × 2 zones = 14 regions, each with an S3 and an IAM endpoint " +
    "(`{s3|iam}.<region>.megas4.com`). Includes the current status of each.",
  operationsSummary: "List of monitored API operations (34)",
  operationsDesc:
    "25 S3 API operations (buckets / objects / multipart / policies) and " +
    "9 IAM API operations (policies), as covered by MEGA S4.",
  timelineSummary: "Per-operation status slots for one day (or one hour)",
  timelineDesc:
    "5-minute status slots for every monitored operation — the data behind the " +
    "timeline chart. Day view returns 288 slots per operation; hour view returns 12. " +
    "`uptime` is the operational share of the measured slots in the returned window.",
  subscribeSummary: "Subscribe an email address to incident notifications",
  subscribeDesc:
    "Creates a subscription, or **updates it when the same email address is submitted again** " +
    "(the email address is the record ID). Filter notifications by `services` and/or " +
    "`regions` / `endpoints` (omit or `all` for everything). " +
    "Notification emails carry RFC 2369 `List-Unsubscribe` (and `List-Unsubscribe-Post: One-Click`) " +
    "headers pointing to `subscription.unsubscribeUrl`.",
  reqRegions: "Region IDs to notify (e.g. `ap-tokyo-1`); omit or `all` for every region.",
  reqEndpoints: "Endpoint keys to notify (e.g. `s3:ap-tokyo-1`); omit or `all` for every endpoint.",
  respUpdated: "Existing subscription updated",
  subGetSummary: "Get a subscription",
  subGetDesc:
    "Returns the current settings of a subscription. Requires the subscription token " +
    "issued when subscribing.",
  subDeleteSummary: "Unsubscribe (delete a subscription)",
  subDeleteDesc: "Deletes the subscription for the email address. Requires the subscription token.",
  unsubSummary: "One-click unsubscribe page",
  unsubDesc:
    "Landing page linked from the `List-Unsubscribe` header of notification emails. " +
    "Deletes the subscription and renders a confirmation page. Requires email + token.",
  unsubPostSummary: "Unsubscribe by email address",
  unsubPostDesc:
    "Deletes the subscription for the given email address, if it exists. " +
    "Idempotent — always returns `200 {\"ok\": true}` (used by the website's unsubscribe button). " +
    "For programmatic use, the token-authenticated `DELETE /api/subscriptions` is preferred.",
  paramEmail: "Subscribed email address (the subscription ID).",
  paramToken: "Subscription token issued on subscribe.",
  resp404: "Not found or invalid token",
  paramDate: "Date to inspect (YYYY-MM-DD). Default: today. Range: last 7 days including today.",
  paramEndpoint:
    "`all` (default) aggregates the worst status across every endpoint, " +
    "or a specific endpoint key such as `s3:ap-tokyo-1` / `iam:eu-paris-2` (see /api/endpoints).",
  paramHour: "Omit (or `all`) for the full 24h day view; `0`–`23` zooms into that hour (12 slots).",
  paramTz: "Viewer timezone offset in minutes east of UTC (e.g. 540 for Asia/Tokyo). The returned day window is midnight-to-midnight in this offset; data is stored in UTC. Default 0.",
  emailDesc: "Email address to notify.",
  servicesDesc: "Services to subscribe to.",
  resp200: "OK",
  resp201: "Subscription accepted",
  resp400: "Invalid parameter or body",
  resp429: "Rate limit exceeded (100 requests/minute/IP)",
  hdrLimit: "Requests allowed per minute",
  hdrRemaining: "Requests remaining in the current window",
  hdrReset: "Seconds until the window resets",
  retryAfter: "Seconds until the window resets",
  statusesDesc: "One entry per 5-minute slot, in chronological order.",
  firstSlotDesc: "Minutes from 00:00 to the first returned slot.",
};

const JA: SpecStrings = {
  title: "MEGA S4 Status API(非公式)",
  description:
    "MEGA S4(S3互換オブジェクトストレージ)と IAM API のステータスAPI。 " +
    "https://s4status.sessapps.com で提供されています。\n\n" +
    "- **認証不要** — すべてのエンドポイントが公開されています。\n" +
    "- **レートリミット: 100リクエスト / 分 / IP**(`/api/*` 全体で共通)。 " +
    "応答には `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` ヘッダーが付き、" +
    "制限超過時は `Retry-After` 付きの `429` を返します。\n" +
    "- 各エンドポイントは**最短約15分間隔**でチェックされます。ステータスは**5分スロット**で記録され、履歴は当日を含む**7日分**です。\n" +
    "- `status` 列挙値: `operational`(正常)/ `degraded`(低下)/ `outage`(障害)/ `nodata`(データなし)。",
  tagStatus: "現在のステータス",
  tagTimeline: "操作別スロット履歴",
  tagReference: "監視対象のエンドポイントと操作",
  tagNotifications: "障害通知メール",
  overviewSummary: "全体ステータス + 全エンドポイントの現在状態",
  overviewDesc:
    "ステータスページ上部と同じ情報:全体ステータス、影響を受けているエンドポイント数、" +
    "各エンドポイントの現在ステータスと当日の稼働率。",
  endpointsSummary: "監視対象エンドポイント一覧(28)",
  endpointsDesc:
    "7都市 × 2ゾーン = 14リージョンに S3 / IAM の各エンドポイント" +
    "(`{s3|iam}.<region>.megas4.com`)。現在のステータス付き。",
  operationsSummary: "監視対象API操作一覧(34)",
  operationsDesc:
    "MEGA S4 が対応する S3 API 25操作(バケット / オブジェクト / マルチパート / ポリシー)と " +
    "IAM API 9操作(ポリシー)。",
  timelineSummary: "1日(または1時間)分の操作別ステータススロット",
  timelineDesc:
    "タイムラインチャートの元データ。全監視操作の5分スロットのステータス。 " +
    "終日ビューは操作あたり288スロット、時間ビューは12スロット。 " +
    "`uptime` は返却ウィンドウ内の測定スロット中 `operational` の割合です。",
  subscribeSummary: "障害通知メールの登録",
  subscribeDesc:
    "サブスクリプションを作成、または**同じメールアドレスを再送信した場合は設定を更新**します" +
    "(メールアドレスがレコードID)。`services` や `regions` / `endpoints` で通知対象を絞り込めます" +
    "(省略時または `all` はすべて)。 " +
    "障害通知メールには RFC 2369 の `List-Unsubscribe`(および `List-Unsubscribe-Post: One-Click`)ヘッダーに " +
    "`subscription.unsubscribeUrl` を指定して送信されます。",
  reqRegions: "通知するリージョンID(例: `ap-tokyo-1`)。省略時または `all` はすべてのリージョン。",
  reqEndpoints: "通知するエンドポイントキー(例: `s3:ap-tokyo-1`)。省略時または `all` はすべてのエンドポイント。",
  respUpdated: "既存の登録を更新しました",
  subGetSummary: "サブスクリプションの取得",
  subGetDesc: "サブスクリプションの現在の設定を返します。購読時に発行されるトークンが必要です。",
  subDeleteSummary: "配信停止(サブスクリプションの削除)",
  subDeleteDesc: "指定したメールアドレスのサブスクリプションを削除します。トークンが必要です。",
  unsubSummary: "ワンクリック配信停止ページ",
  unsubDesc:
    "通知メールの `List-Unsubscribe` ヘッダーからリンクされる解除ページ。サブスクリプションを削除して確認ページを表示します。email + token が必要です。",
  unsubPostSummary: "メールアドレスによる配信停止",
  unsubPostDesc:
    "指定したメールアドレスのサブスクリプションを削除します(存在しなければ何もしません)。 " +
    "冪等で、常に `200 {\"ok\": true}` を返します(ウェブサイトの配信停止ボタンから使用)。 " +
    "プログラムからの利用には、トークン認証付きの `DELETE /api/subscriptions` を推奨します。",
  paramEmail: "購読したメールアドレス(サブスクリプションID)。",
  paramToken: "購読時に発行されるトークン。",
  resp404: "存在しないか、トークンが不正です",
  paramDate: "確認する日付(YYYY-MM-DD)。デフォルトは当日。範囲は当日を含む過去7日。",
  paramEndpoint:
    "`all`(デフォルト)は全エンドポイントの最悪ステータス集約。" +
    "または特定エンドポイントキー(`s3:ap-tokyo-1` / `iam:eu-paris-2` など。/api/endpoints 参照)。",
  paramHour: "省略(または `all`)で24時間の終日ビュー。`0`〜`23` でその時間にズーム(12スロット)。",
  paramTz: "表示タイムゾーンのUTCからのオフセット(分)(例: Asia/Tokyo は 540)。このオフセットでの0時〜24時の窓で返します。データ自体はUTCで保存されています。デフォルト 0。",
  emailDesc: "通知先メールアドレス。",
  servicesDesc: "通知対象サービス。",
  resp200: "OK",
  resp201: "登録を受け付けました",
  resp400: "不正なパラメータまたはボディ",
  resp429: "レートリミット超過(100リクエスト/分/IP)",
  hdrLimit: "1分あたりの許容リクエスト数",
  hdrRemaining: "現在のウィンドウの残りリクエスト数",
  hdrReset: "ウィンドウがリセットされるまでの秒数",
  retryAfter: "ウィンドウがリセットされるまでの秒数",
  statusesDesc: "5分スロットごとに時系列で1エントリ。",
  firstSlotDesc: "00:00 から最初の返却スロットまでの分数。",
};

export function openapiSpec(lang: string | null): Record<string, unknown> {
  const s = lang === "ja" ? JA : EN;
  const rateHeaders = () => ({
    "X-RateLimit-Limit": { description: s.hdrLimit, schema: { type: "integer", example: 100 } },
    "X-RateLimit-Remaining": { description: s.hdrRemaining, schema: { type: "integer" } },
    "X-RateLimit-Reset": { description: s.hdrReset, schema: { type: "integer" } },
  });
  const badRequest = () => ({
    description: s.resp400,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  });
  const tooManyRequests = () => ({
    description: s.resp429,
    headers: {
      "Retry-After": { description: s.retryAfter, schema: { type: "integer" } },
    },
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  });
  const emailParam = (st: SpecStrings) => ({
    name: "email",
    in: "query",
    required: true,
    description: st.paramEmail,
    schema: { type: "string", format: "email", example: "you@example.com" },
  });
  const tokenParam = (st: SpecStrings) => ({
    name: "token",
    in: "query",
    required: true,
    description: st.paramToken,
    schema: { type: "string" },
  });
  const notFound = (st: SpecStrings) => ({
    description: st.resp404,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  });

  return {
    openapi: "3.1.0",
    info: {
      title: s.title,
      version: "1.0.0",
      description: s.description,
      contact: {
        name: "S4Status",
        url: "https://github.com/sashimi3433/s4status",
        email: "contact@sessapps.com",
      },
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "status", description: s.tagStatus },
      { name: "timeline", description: s.tagTimeline },
      { name: "reference", description: s.tagReference },
      { name: "notifications", description: s.tagNotifications },
    ],
    paths: {
      "/api/overview": {
        get: {
          tags: ["status"],
          summary: s.overviewSummary,
          description: s.overviewDesc,
          responses: {
            200: {
              description: s.resp200,
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
          summary: s.endpointsSummary,
          description: s.endpointsDesc,
          responses: {
            200: {
              description: s.resp200,
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
          summary: s.operationsSummary,
          description: s.operationsDesc,
          responses: {
            200: {
              description: s.resp200,
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
          summary: s.timelineSummary,
          description: s.timelineDesc,
          parameters: [
            {
              name: "date",
              in: "query",
              description: s.paramDate,
              schema: { type: "string", format: "date", example: "2026-09-28" },
            },
            {
              name: "endpoint",
              in: "query",
              description: s.paramEndpoint,
              schema: { type: "string", default: "all", example: "s3:ap-tokyo-1" },
            },
            {
              name: "hour",
              in: "query",
              description: s.paramHour,
              schema: { type: "string", default: "all", example: "14" },
            },
            {
              name: "tz",
              in: "query",
              description: s.paramTz,
              schema: { type: "integer", default: 0, example: 540 },
            },
          ],
          responses: {
            200: {
              description: s.resp200,
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
          summary: s.subscribeSummary,
          description: s.subscribeDesc,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    description: s.emailDesc,
                    example: "you@example.com",
                  },
                  services: {
                    type: "array",
                    items: { type: "string", enum: ["s3", "iam"] },
                    description: s.servicesDesc,
                    default: ["s3", "iam"],
                    example: ["s3", "iam"],
                  },
                  regions: {
                    type: "array",
                    items: { type: "string", example: "ap-tokyo-1" },
                    description: s.reqRegions,
                  },
                  endpoints: {
                    type: "array",
                    items: { type: "string", example: "s3:ap-tokyo-1" },
                    description: s.reqEndpoints,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: s.resp201,
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    updated: { type: "boolean", example: false },
                    subscription: { $ref: "#/components/schemas/Subscription" },
                  },
                },
              },
            },
          },
          200: {
            description: s.respUpdated,
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    updated: { type: "boolean", example: true },
                    subscription: { $ref: "#/components/schemas/Subscription" },
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
    "/api/subscriptions": {
      get: {
        tags: ["notifications"],
        summary: s.subGetSummary,
        description: s.subGetDesc,
        parameters: [emailParam(s), tokenParam(s)],
        responses: {
          200: {
            description: s.resp200,
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    subscription: { $ref: "#/components/schemas/Subscription" },
                  },
                },
              },
            },
          },
          404: notFound(s),
          429: tooManyRequests(),
        },
      },
      delete: {
        tags: ["notifications"],
        summary: s.subDeleteSummary,
        description: s.subDeleteDesc,
        parameters: [emailParam(s), tokenParam(s)],
        responses: {
          200: {
            description: s.resp200,
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    unsubscribed: { type: "boolean", example: true },
                    email: { type: "string", example: "you@example.com" },
                  },
                },
              },
            },
          },
          404: notFound(s),
          429: tooManyRequests(),
        },
      },
    },
    "/api/unsubscribe": {
      get: {
        tags: ["notifications"],
        summary: s.unsubSummary,
        description: s.unsubDesc,
        parameters: [emailParam(s), tokenParam(s)],
        responses: {
          200: {
            description: s.resp200,
            content: { "text/html": { schema: { type: "string" } } },
          },
          404: notFound(s),
          429: tooManyRequests(),
        },
      },
      post: {
        tags: ["notifications"],
        summary: s.unsubPostSummary,
        description: s.unsubPostDesc,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    description: s.paramEmail,
                    example: "you@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: s.resp200,
            headers: rateHeaders(),
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { ok: { type: "boolean", example: true } },
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
            uptime24h: { type: "number", nullable: true, example: 99.98, description: "Trailing 24 hours from now." },
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
              description: s.statusesDesc,
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
            firstSlotMinutes: { type: "integer", example: 0, description: s.firstSlotDesc },
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
        Subscription: {
          type: "object",
          description: s.subGetDesc,
          properties: {
            email: { type: "string", format: "email", example: "you@example.com" },
            services: { type: "array", items: { type: "string", enum: ["s3", "iam"] } },
            regions: {
              oneOf: [
                { type: "string", enum: ["all"] },
                { type: "array", items: { type: "string", example: "ap-tokyo-1" } },
              ],
            },
            endpoints: {
              oneOf: [
                { type: "string", enum: ["all"] },
                { type: "array", items: { type: "string", example: "s3:ap-tokyo-1" } },
              ],
            },
            unsubscribeUrl: {
              type: "string",
              description: s.unsubDesc,
              example: "https://s4status.sessapps.com/api/unsubscribe?email=you%40example.com&token=...",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
