# MEGA S4 Status (unofficial)

[日本語版はこちら](README.ja.md)

Unofficial status monitor for **[MEGA S4](https://mega.io/s4)** — S3-compatible object storage — and its IAM API.

**https://s4status.sessapps.com**

> This project is not affiliated with MEGA. It does not replace official status information.

## Features

- **Overall status hero** — solid green when everything is healthy; on incidents it turns solid red/amber and shows affected endpoints, how long the incident has been ongoing, and how many operations are affected, at a glance
- **28 endpoints monitored** — 7 cities (Luxembourg, Amsterdam, Paris, Barcelona, Montreal, Vancouver, Tokyo) × 2 zones × S3 / IAM (`{s3|iam}.<region>.megas4.com`), grouped by city and service with today's uptime
- **34 API operations tracked** — every S3 and IAM operation covered by MEGA S4 (buckets, objects, multipart uploads, policies…), each endpoint re-checked **at least every 15 minutes**, recorded in **5-minute slots** with **7 days** of history
- **Timeline** — day view and hour zoom, date picker for the past week, hover crosshair across all rows, "back to now" button
- **8 languages** with automatic browser-language detection — 日本語 / English / 中文 / 한국어 / Español / Français / Deutsch / Nederlands
- **Light / dark / system** theme
- **Email notifications** — filter by service (S3/IAM) and region; update or unsubscribe anytime, with one-click unsubscribe links in every email

## Public API

All status data is available through a public API — no authentication, rate limited to 100 requests/minute/IP.

- Interactive documentation (Scalar): **https://s4status.sessapps.com/docs** (also linked as "API" in the header and footer; Japanese spec available)

| Endpoint | Description |
|---|---|
| `GET /api/overview` | Overall status + current status of every endpoint |
| `GET /api/endpoints` | Monitored endpoint list |
| `GET /api/operations` | Monitored operation list (34) |
| `GET /api/timeline` | Per-operation 5-minute status history (day or hour window) |
| `POST /api/subscribe` | Register/update incident notifications (email = ID) |
| `GET /api/subscriptions` · `DELETE` | View / unsubscribe (token authenticated) |
| `POST /api/unsubscribe` | Unsubscribe by email |

## Links

- **Website**: https://s4status.sessapps.com
- **API docs**: https://s4status.sessapps.com/docs
- **Privacy Policy**: https://s4status.sessapps.com/privacy (Japanese)
- **Terms of Service**: https://s4status.sessapps.com/terms (Japanese)
- **Contact**: [contact@sessapps.com](mailto:contact@sessapps.com)

## Data sources

- Endpoint list: [MEGA S4 endpoint URLs (official help)](https://help.mega.io/megas4/setup-guides/mega-s4-endpoint-urls)
- S3 / IAM API coverage: [meganz/s4-specs](https://github.com/meganz/s4-specs)

## License

MIT
