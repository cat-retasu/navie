// app/terms/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 | NAVIÉ",
  description:
    "NAVIÉ（night-navie.jp）の利用規約です。サービス利用条件、禁止事項、免責、退会等について定めます。",
  robots: { index: true, follow: true },
};

const UPDATED_AT = "2026年2月16日";
const SUPPORT_EMAIL = "support@night-navie.jp";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="nomi-card p-6 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-[rgba(95,96,107,1)]">
              TERMS OF SERVICE
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
              利用規約
            </h1>
            <p className="mt-2 text-sm text-[rgba(95,96,107,1)]">
              最終更新日：{UPDATED_AT}
            </p>
          </div>

          <Link
            href="/"
            className="shrink-0 rounded-full border border-[rgba(15,15,18,0.10)] bg-white/70 px-4 py-2 text-[12px] font-semibold text-[rgba(15,15,18,0.88)] hover:bg-white"
          >
            トップへ
          </Link>
        </div>

        <div className="mt-8 space-y-8 text-[15px] leading-7 text-[rgba(15,15,18,0.90)]">
          <section className="space-y-3">
            <p>
              本利用規約（以下「本規約」）は、NAVIÉ（以下「本サービス」）の提供条件および本サービスの利用に関する
              事項を定めるものです。ユーザーは、本規約に同意のうえ本サービスを利用するものとします。
            </p>
          </section>

          <hr className="border-[rgba(15,15,18,0.10)]" />

          <section className="space-y-3" id="section-1">
            <h2 className="text-lg font-semibold">第1条（定義）</h2>
            <p>本規約において使用する用語は、以下の意味を有します。</p>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>「ユーザー」：本サービスを利用するすべての方</li>
              <li>「コンテンツ」：文章、画像、メッセージ等、ユーザーが送信または表示される情報</li>
              <li>「運営」：本サービスを管理・運営する者</li>
            </ul>
          </section>

          <section className="space-y-3" id="section-2">
            <h2 className="text-lg font-semibold">第2条（本サービスの概要）</h2>
            <p>
              本サービスは、ユーザーの相談・連絡等を目的としたチャット機能等を提供します。
              本サービス上の情報は、参考情報として提供されるものであり、特定の結果を保証するものではありません。
            </p>
          </section>

          <section className="space-y-3" id="section-3">
            <h2 className="text-lg font-semibold">第3条（アカウント）</h2>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>ユーザーは、登録情報を真実かつ正確に入力するものとします。</li>
              <li>ユーザーは、自己の責任においてアカウント情報を管理し、第三者に利用させないものとします。</li>
              <li>運営は、合理的に必要と判断した場合、ユーザーに対し本人確認等を求めることがあります。</li>
            </ul>
          </section>

          <section className="space-y-3" id="section-4">
            <h2 className="text-lg font-semibold">第4条（利用条件）</h2>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>ユーザーは、法令および本規約を遵守して本サービスを利用するものとします。</li>
              <li>未成年の方は、必要に応じて保護者等の同意を得たうえで利用してください。</li>
              <li>本サービスの利用に必要な通信環境・端末等は、ユーザーの費用と責任で用意するものとします。</li>
            </ul>
          </section>

          <section className="space-y-3" id="section-5">
            <h2 className="text-lg font-semibold">第5条（禁止事項）</h2>
            <p>ユーザーは、以下の行為をしてはなりません。</p>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>法令または公序良俗に反する行為</li>
              <li>第三者の権利（著作権、商標権、プライバシー等）を侵害する行為</li>
              <li>虚偽の情報を登録・送信する行為</li>
              <li>嫌がらせ、脅迫、差別、誹謗中傷等、他者に不利益・不快感を与える行為</li>
              <li>わいせつ・過度に暴力的・反社会的な内容の送信または掲載</li>
              <li>本サービスの運営を妨害する行為、または不正アクセス</li>
              <li>アカウントの売買、貸与、共有</li>
              <li>その他、運営が不適切と判断する行為</li>
            </ul>
          </section>

          <section className="space-y-3" id="section-6">
            <h2 className="text-lg font-semibold">第6条（コンテンツの取扱い）</h2>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>ユーザーは、自ら送信するコンテンツについて責任を負うものとします。</li>
              <li>
                運営は、法令遵守・安全確保・不正防止等のため、必要な範囲でコンテンツを確認・削除・制限する場合があります。
              </li>
              <li>
                ユーザーは、コンテンツが第三者の権利を侵害しないことを保証するものとします。
              </li>
            </ul>
          </section>

          <section className="space-y-3" id="section-7">
            <h2 className="text-lg font-semibold">第7条（利用停止・アカウント削除）</h2>
            <p>
              運営は、ユーザーが本規約に違反した場合、事前通知なく本サービスの全部または一部の利用を停止し、
              アカウントを削除することができます。
            </p>
          </section>

          <section className="space-y-3" id="section-8">
            <h2 className="text-lg font-semibold">第8条（退会）</h2>
            <p>
              ユーザーは、所定の方法により退会することができます。退会後も、法令上または運営上必要な範囲で
              情報を保持する場合があります（詳細はプライバシーポリシーに定めます）。
            </p>
          </section>

          <section className="space-y-3" id="section-9">
            <h2 className="text-lg font-semibold">第9条（免責・保証の否認）</h2>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>運営は、本サービスが特定の目的に適合すること、正確性・有用性を保証しません。</li>
              <li>
                運営は、本サービスの利用により生じた損害について、運営の故意または重過失がある場合を除き責任を負いません。
              </li>
              <li>
                ユーザー間または第三者との間で生じた紛争について、運営は合理的な範囲での対応を除き責任を負いません。
              </li>
            </ul>
          </section>

          <section className="space-y-3" id="section-10">
            <h2 className="text-lg font-semibold">第10条（サービスの変更・停止）</h2>
            <p>
              運営は、必要に応じて本サービスの内容を変更し、または提供を停止することがあります。
              重要な変更がある場合は、本サービス上での告知等により通知します。
            </p>
          </section>

          <section className="space-y-3" id="section-11">
            <h2 className="text-lg font-semibold">第11条（規約の変更）</h2>
            <p>
              運営は、必要に応じて本規約を変更することがあります。変更後の本規約は、本サービス上に表示した時点から効力を生じます。
            </p>
          </section>

          <section className="space-y-3" id="section-12">
            <h2 className="text-lg font-semibold">第12条（準拠法・管轄）</h2>
            <p>
              本規約は日本法に準拠し、本サービスに関して紛争が生じた場合、運営者所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
            </p>
          </section>

          <section className="space-y-3" id="section-13">
            <h2 className="text-lg font-semibold">第13条（お問い合わせ）</h2>
            <p>本規約に関するお問い合わせは、下記までご連絡ください。</p>
            <div className="rounded-2xl border border-[rgba(15,15,18,0.10)] bg-white/60 p-4">
              <p className="text-sm text-[rgba(95,96,107,1)]">連絡先メール</p>
              <p className="mt-1 font-semibold">{SUPPORT_EMAIL}</p>
            </div>
          </section>

          <hr className="border-[rgba(15,15,18,0.10)]" />

          <section className="space-y-3">
            <p className="text-sm text-[rgba(95,96,107,1)]">
              関連ページ：{" "}
              <Link href="/privacy" className="underline">
                プライバシーポリシー
              </Link>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
