import { useEffect, type ReactNode } from "react";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — MEGA S4 Status (unofficial)`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <article className="anim-fade-up mx-auto w-full max-w-3xl px-4 pt-10">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        制定: 2026年9月28日 — MEGA S4 Status (unofficial)
      </p>
      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        {children}
      </div>
    </article>
  );
}

export function Privacy() {
  return (
    <LegalPage title="プライバシーポリシー">
      <Section title="1. 取得する情報">
        <p>本サービスは、以下の情報を取得します。</p>
        <Bullets
          items={[
            <>
              <strong>メールアドレス</strong> — 障害通知の登録時に、ご本人の入力により提供される情報です(任意)。
            </>,
            <>
              <strong>IPアドレス</strong> — APIレートリミット(1分間に100リクエスト)の適用のため、一時的に処理されます。永続的な保存対象ではありません。
            </>,
            <>
              <strong>表示設定(テーマ・言語)</strong> — ブラウザの localStorage に保存され、サーバーには送信されません。
            </>,
            <>
              <strong>アクセスログ</strong> — 本サイトは Cloudflare 上で運用されており、Cloudflare が標準的に記録するログ(IPアドレス、ユーザーエージェント、リクエスト時刻等)には本サイトへのアクセス情報が含まれます。詳細は Cloudflare のプライバシーポリシーをご確認ください。
            </>,
          ]}
        />
      </Section>
      <Section title="2. 利用目的">
        <Bullets
          items={[
            "障害通知メールの送付(登録いただいた場合)",
            "サービスの適正な運用(レートリミットの適用、不正利用の防止)",
          ]}
        />
      </Section>
      <Section title="3. Cookie・ローカルストレージ">
        <p>
          本サイトは、トラッキングや行動分析のための Cookie
          を使用しません。使用するのはテーマと言語の設定をブラウザ内に保持する localStorage
          のみで、いつでもブラウザ設定から削除できます。
        </p>
      </Section>
      <Section title="4. 第三者への提供">
        <p>
          法令に基づく場合を除き、登録いただいたメールアドレスを第三者に提供しません。なお、障害通知メールの送信業務を外部サービスに委託する場合には、送信に必要最小限の情報(メールアドレス)を当該事業者に取り扱わせる場合があります。
        </p>
      </Section>
      <Section title="5. データの保管と削除">
        <p>
          通知登録情報(メールアドレス・通知設定・管理トークン)は Cloudflare D1
          データベースに保管されます。配信停止(サイト上のボタン、メールの解除リンク、または
          API)を実行した時点で該当レコードを削除します。
        </p>
      </Section>
      <Section title="6. データ主体の権利">
        <p>
          登録内容の照会・削除は、配信停止ページ、API(
          <code className="rounded bg-zinc-100 px-1 py-px font-mono text-xs dark:bg-zinc-800">
            /api/subscriptions
          </code>
          、
          <code className="rounded bg-zinc-100 px-1 py-px font-mono text-xs dark:bg-zinc-800">
            /api/unsubscribe
          </code>
          )、またはお問い合わせ(contact@sessapps.com)より行えます。
        </p>
      </Section>
      <Section title="7. ポリシーの変更">
        <p>
          本ポリシーは、必要に応じて変更することがあります。変更後の本ページへの掲載をもって効力が生じるものとします。
        </p>
      </Section>
      <Section title="8. お問い合わせ">
        <p>contact@sessapps.com</p>
      </Section>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="利用規約">
      <Section title="1. サービスの内容">
        <p>
          本サービスは、MEGA S4(S3互換オブジェクトストレージ)およびその IAM API
          の非公式ステータスモニタ(ウェブサイト・公開API・通知メール)です。
        </p>
      </Section>
      <Section title="2. 非公式性">
        <p>
          本サービスは MEGA(およびその関連会社)とは無関係であり、公式のステータス情報を代替・保証するものではありません。
        </p>
      </Section>
      <Section title="3. 無保証">
        <p>
          本サービスは「現状有姿」で提供され、表示されるステータス・稼働率等の正確性、完全性、可用性、特定目的への適合性について、いかなる保証も行いません。
        </p>
      </Section>
      <Section title="4. 監視の限界">
        <p>
          ステータスは5分間隔でチェックされるため、障害の発生から表示・通知までに時間差が生じるほか、検知できない事象も存在し得ます。
        </p>
      </Section>
      <Section title="5. API の利用">
        <p>
          公開APIは認証不要で利用できますが、レートリミット(1分間に100リクエスト/IP)を設けています。これを超える利用の制限、API仕様の変更、提供の終了を予告なく行う場合があります。
        </p>
      </Section>
      <Section title="6. 通知メール">
        <p>
          障害通知の遅延・欠落が発生する場合があります。重要な判断には公式情報の確認を行ってください。
        </p>
      </Section>
      <Section title="7. 禁止事項">
        <Bullets
          items={[
            "不正アクセス、またはそれを試みる行為",
            "レートリミットを回避する等の過度なリクエスト",
            "本サービスの運営を妨害する行為",
            "法令・公序良俗に反する利用",
          ]}
        />
      </Section>
      <Section title="8. 責任の制限">
        <p>
          本サービスの利用(または利用不能)によって生じたいかなる直接・間接の損害についても、運営者は責任を負いません。
        </p>
      </Section>
      <Section title="9. サービスの変更・終了">
        <p>本サービスは予告なく内容を変更し、または提供を終了する場合があります。</p>
      </Section>
      <Section title="10. 準拠法">
        <p>本規約は日本法に準拠します。</p>
      </Section>
      <Section title="11. 規約の変更">
        <p>
          本規約は必要に応じて変更します。変更後の本ページへの掲載をもって効力が生じるものとします。
        </p>
      </Section>
      <Section title="12. お問い合わせ">
        <p>contact@sessapps.com</p>
      </Section>
    </LegalPage>
  );
}
