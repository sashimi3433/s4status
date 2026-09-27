# S4Status — MEGA S4 Status (unofficial)

[MEGA S4](https://mega.io/s4)(S3互換オブジェクトストレージ)と IAM API の**非公式**ステータスページ。
Vite + React + Tailwind CSS v4 の SPA を Cloudflare Workers で配信。

- 公開ページ: Cloudflare Workers でホスト(`npm run deploy`)
- ソースコード: https://github.com/sashimi3433/s4status

## 機能

- **ダーク / ライト / システム**テーマ切替(ヘッダーの太陽/月/モニターアイコンでサイクル、`localStorage` に保存)
- **i18n(8言語)** — 日本語 / English / 中文 / 한국어 / Español / Français / Deutsch / Nederlands。ヘッダーの言語セレクタで切替。初回アクセス時はブラウザ言語(`navigator.languages`)を自動検知し、選択は `localStorage` に保存。URLパラメータ `?lang=fr` 等での指定も可能
- **統計情報** — 全エンドポイント(7都市 × 2ゾーン = 14リージョン × S3/IAM の28エンドポイント)を都市 → サービス(S3/IAM) → zone 1/2 の階層でグループ化してカード表示。障害中は赤、低下中は黄、正常は緑。都市ヘッダーにはその都市の総合ステータスドットを表示。カードをクリックするとタイムラインがそのエンドポイントに絞り込まれる
- **操作別タイムライン** — S3 API 25操作 + IAM API 9操作の合計34操作を、5分粒度バーで表示
  - 日付ピッカー(+ 前後矢印)で当日を含む過去7日分を選択可能
  - 時間ピッカーで1時間単位にズーム(初期値は現在の時間、`?hour=14` / `?hour=all` での指定も可能)
  - エンドポイントセレクタで全エンドポイント集約(worst-case)または特定エンドポイントを表示
  - バーにホバーすると操作名・時刻・ステータスのツールチップ + 全行を貫くクロスヘアを表示
  - 「現在に戻る」ボタンで現在時刻のビューに一発復帰
  - スクロールで画面に入るとカスケードアニメーションが再生(リビール → 1本ずつポップ → 光のシーン)
- **FAQ** — アコーディオン形式(クリック位置は固定)
- **障害通知メールフォーム** — S3 / IAM の購読対象選択付き

## データソース(エンドポイント・操作の定義)

- エンドポイント一覧: https://help.mega.io/megas4/setup-guides/mega-s4-endpoint-urls
- S3 / IAM API カバレッジ: https://github.com/meganz/s4-specs

監視データは `src/data/mock.ts` が供給する。Worker 側の定期チェック(Cron Trigger)を有効化した後は、
`/api/status` からの実測データに差し替える構成(下記「本番データとの接続」)。

## 開発

```sh
npm install
npm run dev        # Vite dev server (http://localhost:5173)
```

## ビルド / デプロイ

```sh
npm run build      # 型チェック + 本番ビルド → dist/
npm run deploy     # ビルドして wrangler deploy (Cloudflare Workers)
npx wrangler dev   # Workers ランタイムでのローカル配信確認 (dist/)
```

`wrangler.jsonc` は SPA + Worker の構成(`@cloudflare/vite-plugin` が `dist/client` を配信し、`src/worker.ts` が `/api/*` を処理)。

## 公開API(認証不要 / レートリミット100req/分/IP)

インタラクティブなドキュメント(Scalar): **/docs** — OpenAPI 3.1 スペックは `/api/openapi.json`

| エンドポイント | 内容 |
|---|---|
| `GET /api/overview` | 全体ステータス + 全28エンドポイントの現在ステータス/稼働率 |
| `GET /api/endpoints` | 監視対象エンドポイント一覧 |
| `GET /api/operations` | 監視対象34操作一覧 |
| `GET /api/timeline?date=&endpoint=&hour=` | 操作×5分スロットのステータス履歴(日=288/時間=12スロット) |
| `POST /api/subscribe` | 障害通知メールの登録 `{email, services[]}` |

すべての `/api/*` 応答には `X-RateLimit-Limit` / `X-RateLimit-Remaining` / `X-RateLimit-Reset` ヘッダーが付き、制限超過時は `429` + `Retry-After` を返します。CORSは全許可。

## 本番データとの接続(ワーカー側の実装メモ)

Workers の GUI(Settings → Variables and Secrets)に以下を設定する:

| 種類 | 名前 | 内容 |
|---|---|---|
| Secret | `S4_ACCESS_KEY_ID` | 監視用IAMユーザーのアクセスキーID |
| Secret | `S4_SECRET_ACCESS_KEY` | シークレットキー |
| Plain | `S4_PROBE_BUCKET` | 監視用バケット名 |
| Plain | `S4_IAM_PROBE_USER` | Attach/Detach検証用IAMユーザー名 |

実装ステップ:

1. **定期チェック** — `triggers.cron` で `*/5 * * * *`。SigV4 署名で各エンドポイント × 各操作を実行し、成否・レイテンシを D1 に保存(7日分)
2. **API** — Worker に `/api/status?date=YYYY-MM-DD&endpoint=...` を実装し、フロントの `src/data/mock.ts` を差し替え
3. **メール通知** — フォームの送信先を Worker エンドポイントに。Turnstile で bot 対策 + 外部メールサービスで送信

監視には専用のIAMユーザー・バケット・検証用ユーザーを使用(全34操作の実行権限が必要。S4はAPI課金なし)。

## ディレクトリ

```
src/
├── App.tsx                 # ページ組み立て・状態管理
├── components/
│   ├── Header.tsx          # タイトル / MEGA S4・GitHubリンク / テーマ・言語切替
│   ├── OverallStats.tsx    # 総合バナー + 都市×サービス別エンドポイントカード
│   ├── Timeline.tsx        # DatePicker / 時間・エンドポイント選択 / 5分バー / クロスヘア
│   ├── Faq.tsx             # アコーディオン(クリック位置固定)
│   ├── SubscribeForm.tsx   # メール通知フォーム
│   └── Footer.tsx
├── data/
│   ├── regions.ts          # 14リージョン × S3/IAM = 28エンドポイント定義
│   ├── operations.ts       # S3 25 + IAM 9 操作の定義
│   └── mock.ts             # ステータス供給層(実データ化時に差し替え)
└── lib/
    ├── i18n.tsx            # プロバイダ・言語自動検知・日付フォーマット
    ├── translations.ts     # 8言語分の辞書・FAQ本文
    ├── theme.tsx           # light/dark/system テーマ管理
    └── statusStyles.ts     # ステータス色の共通クラス
```
