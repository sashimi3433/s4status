# MEGA S4 Status(非公式)

[English version](README.md)

**[MEGA S4](https://mega.io/s4)**(S3互換オブジェクトストレージ)と IAM API の非公式ステータスモニタです。

**https://s4status.sessapps.com**

> 本プロジェクトは MEGA とは無関係であり、公式のステータス情報を代替するものではありません。

## 機能

- **総合ステータスヒーロー** — 正常時はソリッドグリーン。障害発生中はソリッドのレッド/アンバーに切り替わり、影響エンドポイント・継続時間・影響操作数がひと目で分かります
- **28エンドポイント監視** — 7都市(ルクセンブルク・アムステルダム・パリ・バルセロナ・モントリオール・バンクーバー・東京)× 2ゾーン × S3/IAM(`{s3|iam}.<region>.megas4.com`)。都市・サービスごとにグループ化し、当日の稼働率を表示
- **34操作を追跡** — MEGA S4 が対応する S3/IAM の全操作(バケット・オブジェクト・マルチパート・ポリシー等)を各エンドポイント**最短約15分間隔**でチェックし、**5分スロット**で記録。**7日分**の履歴
- **タイムライン** — 終日ビューと1時間ズーム、過去1週間の日付選択、ホバーで全行を貫くクロスヘア、「現在に戻る」ボタン
- **8言語対応** + ブラウザ言語の自動検知 — 日本語 / English / 中文 / 한국어 / Español / Français / Deutsch / Nederlands
- **ライト / ダーク / システム**テーマ
- **メール通知** — サービス(S3/IAM)とリージョンで絞り込み。再送信で設定更新、画面またはワンクリックリンクで配信停止

## 公開API

すべてのステータス情報をAPIから利用できます(認証不要、レートリミット: 1分間に100リクエスト/IP)。

- インタラクティブドキュメント(Scalar): **https://s4status.sessapps.com/docs**(ヘッダー/フッターの「API」リンクからも。日本語スペックあり)

| エンドポイント | 内容 |
|---|---|
| `GET /api/overview` | 全体ステータス + 全エンドポイントの現在状態 |
| `GET /api/endpoints` | 監視対象エンドポイント一覧 |
| `GET /api/operations` | 監視対象操作一覧(34) |
| `GET /api/timeline` | 操作別・5分スロットのステータス履歴(終日/1時間) |
| `POST /api/subscribe` | 通知の登録/更新(メールアドレス=ID) |
| `GET /api/subscriptions` ・ `DELETE` | 照会 / 配信停止(トークン認証) |
| `POST /api/unsubscribe` | メールアドレスによる配信停止 |

## リンク

- **ウェブサイト**: https://s4status.sessapps.com
- **APIドキュメント**: https://s4status.sessapps.com/docs
- **プライバシーポリシー**: https://s4status.sessapps.com/privacy
- **利用規約**: https://s4status.sessapps.com/terms
- **お問い合わせ**: [contact@sessapps.com](mailto:contact@sessapps.com)

## データソース

- エンドポイント一覧: [MEGA S4 endpoint URLs(公式ヘルプ)](https://help.mega.io/megas4/setup-guides/mega-s4-endpoint-urls)
- S3 / IAM API カバレッジ: [meganz/s4-specs](https://github.com/meganz/s4-specs)

## ライセンス

MIT
