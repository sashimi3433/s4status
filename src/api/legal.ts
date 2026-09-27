/** Legal pages (Japanese), served by the worker at /privacy and /terms.
 *  Follows the site theme (s4status-theme localStorage / ?theme= / system). */

// Same pre-paint theme resolution as index.html
const THEME_SCRIPT = `<script>
(() => {
  try {
    const q = new URLSearchParams(location.search).get("theme");
    const mode = q || localStorage.getItem("s4status-theme") || "system";
    const dark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch {}
})();
</script>`;

const CSS = `
  html { color-scheme: light; }
  html.dark { color-scheme: dark; }
  body {
    margin: 0; background: #fafafa; color: #27272a;
    font-family: -apple-system, "Helvetica Neue", "Hiragino Sans", "Noto Sans JP", sans-serif;
    line-height: 1.8; font-size: 15px;
  }
  a { color: #059669; }
  h1 { font-size: 1.6rem; color: #09090b; margin: 0 0 .25rem; }
  h2 { font-size: 1.05rem; color: #18181b; margin: 2rem 0 .5rem; }
  p { margin: .6rem 0; }
  .card { max-width: 46rem; margin: 2.5rem auto; padding: 2.5rem 1.75rem; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; }
  .meta { color: #71717a; font-size: .85rem; }
  nav.top { margin-bottom: 1.5rem; font-size: .85rem; }
  ul { padding-left: 1.2rem; margin: .5rem 0; }
  html.dark body { background: #09090b; color: #e4e4e7; }
  html.dark a { color: #34d399; }
  html.dark h1 { color: #fafafa; }
  html.dark h2 { color: #e4e4e7; }
  html.dark .card { background: #101014; border-color: #27272a; }
  html.dark .meta { color: #a1a1aa; }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — MEGA S4 Status (unofficial)</title>
  <meta name="description" content="${title} — MEGA S4 Status(非公式)" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  ${THEME_SCRIPT}
  <style>${CSS}</style>
</head>
<body>
<main class="card">
  <nav class="top"><a href="/">← MEGA S4 Status</a></nav>
  <h1>${title}</h1>
  <p class="meta">制定: 2026年9月28日 — MEGA S4 Status (unofficial)</p>
  ${body}
</main>
</body>
</html>`;
}

const PRIVACY_JA = `
  <h2>1. 取得する情報</h2>
  <p>本サービスは、以下の情報を取得します。</p>
  <ul>
    <li><strong>メールアドレス</strong> — 障害通知の登録時に、ご本人の入力により提供される情報です(任意)。</li>
    <li><strong>IPアドレス</strong> — APIレートリミット(1分間に100リクエスト)の適用のため、一時的に処理されます。永続的な保存対象ではありません。</li>
    <li><strong>表示設定(テーマ・言語)</strong> — ブラウザの localStorage に保存され、サーバーには送信されません。</li>
    <li><strong>アクセスログ</strong> — 本サイトは Cloudflare 上で運用されており、Cloudflare が標準的に記録するログ(IPアドレス、ユーザーエージェント、リクエスト時刻等)には本サイトへのアクセス情報が含まれます。詳細は Cloudflare のプライバシーポリシーをご確認ください。</li>
  </ul>
  <h2>2. 利用目的</h2>
  <ul>
    <li>障害通知メールの送付(登録いただいた場合)</li>
    <li>サービスの適正な運用(レートリミットの適用、不正利用の防止)</li>
  </ul>
  <h2>3. Cookie・ローカルストレージ</h2>
  <p>本サイトは、トラッキングや行動分析のための Cookie を使用しません。使用するのはテーマと言語の設定をブラウザ内に保持する localStorage のみで、いつでもブラウザ設定から削除できます。</p>
  <h2>4. 第三者への提供</h2>
  <p>法令に基づく場合を除き、登録いただいたメールアドレスを第三者に提供しません。なお、障害通知メールの送信業務を外部サービスに委託する場合には、送信に必要最小限の情報(メールアドレス)を当該事業者に取り扱わせる場合があります。</p>
  <h2>5. データの保管と削除</h2>
  <p>通知登録情報(メールアドレス・通知設定・管理トークン)は Cloudflare D1 データベースに保管されます。配信停止(サイト上のボタン、メールの解除リンク、または API)を実行した時点で該当レコードを削除します。</p>
  <h2>6. データ主体の権利</h2>
  <p>登録内容の照会・削除は、配信停止ページ、API(<code>/api/subscriptions</code>、<code>/api/unsubscribe</code>)、またはお問い合わせ(contact@sessapps.com)より行えます。</p>
  <h2>7. ポリシーの変更</h2>
  <p>本ポリシーは、必要に応じて変更することがあります。変更後の本ページへの掲載をもって効力が生じるものとします。</p>
  <h2>8. お問い合わせ</h2>
  <p>contact@sessapps.com</p>`;

const TERMS_JA = `
  <h2>1. サービスの内容</h2>
  <p>本サービスは、MEGA S4(S3互換オブジェクトストレージ)およびその IAM API の非公式ステータスモニタ(ウェブサイト・公開API・通知メール)です。</p>
  <h2>2. 非公式性</h2>
  <p>本サービスは MEGA(およびその関連会社)とは無関係であり、公式のステータス情報を代替・保証するものではありません。</p>
  <h2>3. 無保証</h2>
  <p>本サービスは「現状有姿」で提供され、表示されるステータス・稼働率等の正確性、完全性、可用性、特定目的への適合性について、いかなる保証も行いません。</p>
  <h2>4. 監視の限界</h2>
  <p>ステータスは5分間隔でチェックされるため、障害の発生から表示・通知までに時間差が生じるほか、検知できない事象も存在し得ます。</p>
  <h2>5. API の利用</h2>
  <p>公開APIは認証不要で利用できますが、レートリミット(1分間に100リクエスト/IP)を設けています。これを超える利用の制限、API仕様の変更、提供の終了を予告なく行う場合があります。</p>
  <h2>6. 通知メール</h2>
  <p>障害通知の遅延・欠落が発生する場合があります。重要な判断には公式情報の確認を行ってください。</p>
  <h2>7. 禁止事項</h2>
  <ul>
    <li>不正アクセス、またはそれを試みる行為</li>
    <li>レートリミットを回避する等の過度なリクエスト</li>
    <li>本サービスの運営を妨害する行為</li>
    <li>法令・公序良俗に反する利用</li>
  </ul>
  <h2>8. 責任の制限</h2>
  <p>本サービスの利用(または利用不能)によって生じたいかなる直接・間接の損害についても、運営者は責任を負いません。</p>
  <h2>9. サービスの変更・終了</h2>
  <p>本サービスは予告なく内容を変更し、または提供を終了する場合があります。</p>
  <h2>10. 準拠法</h2>
  <p>本規約は日本法に準拠します。</p>
  <h2>11. 規約の変更</h2>
  <p>本規約は必要に応じて変更します。変更後の本ページへの掲載をもって効力が生じるものとします。</p>
  <h2>12. お問い合わせ</h2>
  <p>contact@sessapps.com</p>`;

export function privacyPage(): string {
  return layout("プライバシーポリシー", PRIVACY_JA);
}

export function termsPage(): string {
  return layout("利用規約", TERMS_JA);
}
