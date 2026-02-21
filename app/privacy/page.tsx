// app/privacy/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | NAVIÉ",
  description:
    "NAVIÉ（night-navie.jp）のプライバシーポリシーです。取得する情報、利用目的、外部サービス（Firebase/Analytics）等について説明します。",
  robots: { index: true, follow: true },
};

const UPDATED_AT = "2026年2月16日";
const SUPPORT_EMAIL = "support@night-navie.jp";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <div className="nomi-card p-6 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.28em] text-[rgba(95,96,107,1)]">
              PRIVACY POLICY
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
              プライバシーポリシー
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
              NAVIÉ（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報を適切に取り扱います。
              本ポリシーは、本サービス（アプリおよびWeb）におけるユーザー情報の取扱いについて定めるものです。
            </p>
          </section>

          <hr className="border-[rgba(15,15,18,0.10)]" />

          <section className="space-y-3" id="section-1">
            <h2 className="text-lg font-semibold">1. 取得する情報</h2>
            <p>本サービスは、以下の情報を取得します。</p>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[rgba(15,15,18,0.10)] bg-white/60 p-4">
                <h3 className="font-semibold">（1）アカウント・認証情報</h3>
                <ul className="mt-2 list-disc pl-5 text-[rgba(15,15,18,0.86)]">
                  <li>メールアドレス</li>
                  <li>電話番号（ユーザーが入力した場合）</li>
                  <li>ユーザーID（Firebase Authentication のUID 等）</li>
                  <li>認証に必要な情報（トークン等）</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[rgba(15,15,18,0.10)] bg-white/60 p-4">
                <h3 className="font-semibold">（2）ユーザーが入力・送信する情報</h3>
                <ul className="mt-2 list-disc pl-5 text-[rgba(15,15,18,0.86)]">
                  <li>チャットで送信する内容（テキスト、画像、送信日時 等）</li>
                  <li>プロフィール・希望条件等、ユーザーが入力する情報</li>
                  <li>お問い合わせ内容</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[rgba(15,15,18,0.10)] bg-white/60 p-4">
                <h3 className="font-semibold">（3）利用状況等（自動的に取得される場合）</h3>
                <ul className="mt-2 list-disc pl-5 text-[rgba(15,15,18,0.86)]">
                  <li>アクセス情報（IPアドレス、リクエスト日時、閲覧履歴等）</li>
                  <li>端末・ブラウザ情報（OS、端末モデル、言語設定等）</li>
                  <li>エラー情報、操作ログ（サービス改善・障害調査のため）</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-3" id="section-2">
            <h2 className="text-lg font-semibold">2. 利用目的</h2>
            <p>取得した情報は、以下の目的で利用します。</p>
            <ul className="list-disc pl-5 text-[rgba(15,15,18,0.86)]">
              <li>本サービスの提供、ログイン認証、本人確認</li>
              <li>チャット相談・連絡・調整等の運営</li>
              <li>画像送信を含む機能提供、コンテンツ管理</li>
              <li>不正利用の防止、セキュリティ確保</li>
              <li>お問い合わせ対応</li>
              <li>サービス改善、品質向上、障害調査</li>
            </ul>
          </section>

          <section className="space-y-3" id="section-3">
            <h2 className="text-lg font-semibold">3. 第三者提供</h2>
            <p>
              本サービスは、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供しません。
            </p>
          </section>

          <section className="space-y-3" id="section-4">
            <h2 className="text-lg font-semibold">4. 外部サービスの利用（Firebase 等）</h2>
            <p>
              本サービスは、運営に必要な範囲で外部サービスを利用します。これらの提供者がユーザー情報を取り扱う場合があります。
            </p>

            <div className="rounded-2xl border border-[rgba(15,15,18,0.10)] bg-white/60 p-4">
              <h3 className="font-semibold">Google Firebase（Google LLC）</h3>
              <ul className="mt-2 list-disc pl-5 text-[rgba(15,15,18,0.86)]">
                <li>認証：Firebase Authentication</li>
                <li>データ保存：Cloud Firestore</li>
                <li>画像等の保存：Firebase Storage</li>
                <li>
                  アクセス解析：Firebase Analytics（利用状況の把握、サービス改善のため）
                </li>
              </ul>
              <p className="mt-3 text-sm text-[rgba(95,96,107,1)]">
                ※Crashlytics は現時点で利用していません。
              </p>
            </div>
          </section>

          <section className="space-y-3" id="section-5">
            <h2 className="text-lg font-semibold">5. 保存期間</h2>
            <p>
              取得した情報は、利用目的の達成に必要な期間保持し、不要となった場合は合理的な方法で削除または匿名化します。
              法令により保存が必要な場合はその期間保持します。
            </p>
          </section>

          <section className="space-y-3" id="section-6">
            <h2 className="text-lg font-semibold">6. セキュリティ</h2>
            <p>
              本サービスは、情報漏えい等を防止するため、アクセス制御、権限管理等の合理的な安全管理措置を講じます。
            </p>
          </section>

          <section className="space-y-3" id="section-7">
            <h2 className="text-lg font-semibold">7. 開示・訂正・削除等</h2>
            <p>
              ユーザーは、自己の情報について、開示・訂正・削除・利用停止等を求めることができます。
              ご希望の際は「8. お問い合わせ窓口」までご連絡ください。本人確認のうえ、合理的な範囲で対応します。
            </p>
          </section>

          <section className="space-y-3" id="section-8">
            <h2 className="text-lg font-semibold">8. お問い合わせ窓口</h2>
            <p>本ポリシーに関するお問い合わせは、下記までご連絡ください。</p>
            <div className="rounded-2xl border border-[rgba(15,15,18,0.10)] bg-white/60 p-4">
              <p className="text-sm text-[rgba(95,96,107,1)]">連絡先メール</p>
              <p className="mt-1 font-semibold">{SUPPORT_EMAIL}</p>
            </div>
          </section>

          <section className="space-y-3" id="section-9">
            <h2 className="text-lg font-semibold">9. 改定</h2>
            <p>
              本ポリシーは必要に応じて改定されることがあります。重要な変更がある場合は、本サービス上で告知します。
            </p>
          </section>

          <hr className="border-[rgba(15,15,18,0.10)]" />

          <section className="space-y-3">
            <p className="text-sm text-[rgba(95,96,107,1)]">
              ※本ページは app 内ブラウザ（WebView）からも参照される場合があります。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
