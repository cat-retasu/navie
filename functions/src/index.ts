import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Resend } from "resend";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// 送信元（Verifiedにしたドメイン配下にする）
const FROM = "NAVIÉ <noreply@mail.night-navie.jp>";

// =====================
// 承認メール（既存）
// =====================
function buildApprovalEmail(params: { nickname?: string }) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";

  const subject = "【NAVIÉ】審査完了のお知らせ";
  const html = `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', 'Hiragino Sans', 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; line-height:1.7; color:#111;">
    <h2 style="margin:0 0 12px;">審査が完了しました ✨</h2>
    <p style="margin:0 0 16px;">${name}、NAVIÉのご登録ありがとうございます。<br/>アカウントの審査が完了しました。</p>

    <p style="margin:0 0 18px;">
      下のボタンからマイページへ進んでください。
    </p>

    <p style="margin:0 0 24px;">
      <a href="https://night-navie.jp/mypage"
         style="display:inline-block; padding:12px 18px; border-radius:10px; background:#d14a79; color:#fff; text-decoration:none; font-weight:600;">
        マイページへ進む
      </a>
    </p>

    <hr style="border:none; border-top:1px solid #eee; margin:18px 0;" />

    <p style="margin:0; font-size:12px; color:#666;">
      このメールに心当たりがない場合は、このまま破棄してください。<br/>
      ※本メールは送信専用です。返信いただいてもお返事できません。
    </p>
  </div>
  `;

  const text = `${name} 様
審査が完了しました。

マイページ：https://night-navie.jp/mypage

このメールに心当たりがない場合は破棄してください。
※送信専用のため返信できません。`;

  return { subject, html, text };
}

export const sendApprovalEmailOnRoleChange = onDocumentUpdated(
  {
    document: "users/{uid}",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const before = event.data?.before.data() as any;
    const after = event.data?.after.data() as any;

    if (!before || !after) return;

    // pending -> user に変わったときだけ
    const beforeRole = before.role;
    const afterRole = after.role;
    if (!(beforeRole === "pending" && afterRole === "user")) return;

    const to = after.email;
    if (!to) {
      logger.warn("No email on user doc; skip sending.", { uid: event.params.uid });
      return;
    }

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildApprovalEmail({ nickname: after.nickname });

    try {
      await resend.emails.send({
        from: FROM,
        to,
        subject,
        html,
        text,
      });
      logger.info("Approval email sent.", { uid: event.params.uid, to });
    } catch (e: any) {
      logger.error("Failed to send approval email.", {
        uid: event.params.uid,
        to,
        error: e?.message ?? e,
      });
      throw e;
    }
  }
);

// =====================
// ✅ メール認証メール（追加）
// =====================
function buildVerifyEmail(params: { nickname?: string; verifyUrl: string }) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";

  const subject = "【NAVIÉ】メールアドレスの認証をお願いします";
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">メール認証のお願い ✨</h2>
    <p style="margin:0 0 16px;">${name}、NAVIÉのご登録ありがとうございます。<br/>下のボタンからメール認証を完了してください。</p>

    <p style="margin:0 0 24px;">
      <a href="${params.verifyUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d14a79;color:#fff;text-decoration:none;font-weight:600;">
        メール認証を完了する
      </a>
    </p>

    <p style="margin:0 0 16px;font-size:12px;color:#666;">
      ボタンが開けない場合は、以下のURLをブラウザに貼り付けてください：<br/>
      <span style="word-break:break-all;">${params.verifyUrl}</span>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0;font-size:12px;color:#666;">
      このメールに心当たりがない場合は、このまま破棄してください。<br/>
      ※本メールは送信専用です。返信いただいてもお返事できません。
    </p>
  </div>
  `;

  const text = `${name} 様

NAVIÉのメール認証をお願いします。
以下のリンクを開いて認証を完了してください：
${params.verifyUrl}

このメールに心当たりがない場合は破棄してください。
※送信専用のため返信できません。`;

  return { subject, html, text };
}

/**
 * クライアントから呼ぶ：
 * - 新規登録直後
 * - 認証メール再送ボタン
 */
export const sendVerificationEmail = onCall(
  {
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY],
  },
  async (req) => {
    if (!req.auth?.uid) {
      throw new HttpsError("unauthenticated", "ログインが必要です");
    }

    const uid = req.auth.uid;
    const user = await getAuth().getUser(uid);

    const email = user.email;
    if (!email) throw new HttpsError("failed-precondition", "email がありません");

    // すでに認証済みなら何もしない（再送連打対策）
    if (user.emailVerified) return { ok: true, alreadyVerified: true };

    // 🔥 認証リンク生成（oobCode入りURL）
    // ここはあなたのフロントの完了ページに合わせる
    const actionCodeSettings = {
      url: "https://night-navie.jp/verify-email/complete",
      handleCodeInApp: true,
    };

    const verifyUrl = await getAuth().generateEmailVerificationLink(
      email,
      actionCodeSettings
    );

    const resend = new Resend(RESEND_API_KEY.value());
    const nickname = (req.data?.nickname as string | undefined) ?? undefined;
    const { subject, html, text } = buildVerifyEmail({ nickname, verifyUrl });

    try {
      await resend.emails.send({
        from: FROM,
        to: email,
        subject,
        html,
        text,
      });

      logger.info("Verification email sent.", { uid, email });
      return { ok: true };
    } catch (e: any) {
      logger.error("Failed to send verification email.", {
        uid,
        email,
        error: e?.message ?? e,
      });
      throw new HttpsError("internal", "認証メール送信に失敗しました");
    }
  }
);
