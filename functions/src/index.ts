// functions/src/index.ts

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { Resend } from "resend";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");

// 送信元（Verifiedにしたドメイン配下にする）
const FROM = "NAVIÉ <noreply@mail.night-navie.jp>";

function buildNewAdminMessageEmail(params: {
  nickname?: string;
  roomId: string;
  textPreview: string;
}) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";
  const subject = "【NAVIÉ】運営からメッセージが届きました";
  const chatUrl = `https://night-navie.jp/chat`; // ルーム直リンクがあるなら差し替え推奨

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">運営からメッセージが届きました ✨</h2>
    <p style="margin:0 0 14px;">${name}、NAVIÉです。運営から新しいメッセージがあります。</p>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#faf5f7; border:1px solid #f2d6e2;">
      <p style="margin:0; font-size:13px; color:#333; white-space:pre-wrap;">${escapeHtml(
        params.textPreview
      )}</p>
    </div>

    <p style="margin:0 0 24px;">
      <a href="${chatUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d14a79;color:#fff;text-decoration:none;font-weight:600;">
        チャットを開く
      </a>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0;font-size:12px;color:#666;">
      ※本メールは送信専用です。返信いただいてもお返事できません。
    </p>
  </div>
  `;

  const text = `${name} 様

NAVIÉ運営からメッセージが届きました。

--- メッセージ（抜粋）---
${params.textPreview}
------------------------

チャットを開く：${chatUrl}

※送信専用のため返信できません。`;

  return { subject, html, text };
}

// 超シンプルなHTMLエスケープ（メール内の安全用）
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const notifyUserOnAdminMessage = onDocumentCreated(
  {
    document: "chatRooms/{roomId}/messages/{messageId}",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const db = getFirestore();

    const roomId = event.params.roomId;
    const msg = event.data?.data() as any;
    if (!msg) return;

    // ✅ admin発のみ
    const from = msg.from ?? msg.sender ?? "user";
    if (from !== "admin") return;

    // ✅ 削除/空は送らない
    if (msg.isDeleted === true) return;

    const rawText = (msg.text ?? "").toString().trim();
    const hasImage = !!msg.imageUrl;
    if (!rawText && !hasImage) return;

    const roomRef = db.doc(`chatRooms/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return;

    const room = roomSnap.data() as any;
    const userId = room.userId as string | undefined;
    if (!userId) return;

    // ✅ メール送信のクールダウン（同ルーム5分に1回）
    const now = Date.now();
    const last = room.lastAdminNotifyAt?.toMillis?.() ?? 0;
    const cooldownMs = 5 * 60 * 1000;
    if (now - last < cooldownMs) {
      return;
    }

    // users/{uid} から email / nickname 取得（あなたの設計に合わせてる）
    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) return;
    const u = userSnap.data() as any;

    const to = (u.email ?? "").toString().trim();
    if (!to) return;

    // （任意）通知OFFを導入するなら：
    // if (u.notifyChatByEmail === false) return;

    const textPreview =
      rawText.length > 140
        ? rawText.slice(0, 140) + "…"
        : rawText || (hasImage ? "画像が届きました" : "");

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildNewAdminMessageEmail({
      nickname: u.nickname,
      roomId,
      textPreview,
    });

    await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
    });

    // ✅ 送信済みスタンプ（クールダウン用）
    await roomRef.set(
      {
        lastAdminNotifyAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
);

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
    try {
      if (!req.auth?.uid) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }

      const uid = req.auth.uid;
      const user = await getAuth().getUser(uid);

      const email = user.email;
      if (!email) throw new HttpsError("failed-precondition", "email がありません");

      // すでに認証済みなら何もしない（再送連打対策）
      if (user.emailVerified) return { ok: true, alreadyVerified: true };

      // 🔥 認証リンク生成（ここがレート制限で落ちやすいので囲う）
      const actionCodeSettings = {
        url: "https://night-navie.jp/verify-email/complete",
        handleCodeInApp: true,
      };

      let verifyUrl = "";
      try {
        verifyUrl = await getAuth().generateEmailVerificationLink(email, actionCodeSettings);
      } catch (e: any) {
        const raw = String(e?.message ?? e);
        logger.error("generateEmailVerificationLink failed", { uid, email, error: raw });

        // ✅ ここが今回のエラー
        if (raw.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
          throw new HttpsError(
            "resource-exhausted",
            "再送が多すぎます。少し時間を置いてから試してください。"
          );
        }

        throw new HttpsError("internal", "認証リンクの生成に失敗しました");
      }

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
        const raw = String(e?.message ?? e);
        logger.error("Failed to send verification email.", { uid, email, error: raw });

        // Resend側のエラーは details で返すとデバッグしやすい
        throw new HttpsError("internal", "認証メール送信に失敗しました", { raw });
      }
    } catch (err: any) {
      // HttpsError はそのまま返す
      if (err instanceof HttpsError) throw err;

      const raw = String(err?.message ?? err);
      logger.error("sendVerificationEmail unexpected error", { error: raw });
      throw new HttpsError("internal", "INTERNAL", { raw });
    }
  }
);