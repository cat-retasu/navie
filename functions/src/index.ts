import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";

import { Resend } from "resend";
import { DateTime } from "luxon";

initializeApp();

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const ADMIN_EMAILS = defineSecret("ADMIN_EMAILS");

const FROM = "NAVIÉ <noreply@mail.night-navie.jp>";

// =====================
// 管理者通知（共通）
// =====================
function getAdminRecipients(): string[] {
  const raw = String(ADMIN_EMAILS.value() ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function sendToAdmins(resend: Resend, payload: { subject: string; html: string; text: string }) {
  const admins = getAdminRecipients();
  if (!admins.length) {
    logger.warn("ADMIN_EMAILS is empty; skip admin notify.");
    return;
  }
  await resend.emails.send({
    from: FROM,
    to: admins,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

// =====================
// 共通：HTMLエスケープ
// =====================
function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtJstDateTime(d: Date): string {
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =====================
// ユーザー通知：運営(admin)→ユーザーの新着チャット
// =====================
type NewAdminMessageEmailParams = {
  nickname?: string;
  roomId: string;
  textPreview: string;
};

function buildNewAdminMessageEmail(params: NewAdminMessageEmailParams) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";
  const subject = "【NAVIÉ】運営からメッセージが届きました";
  const chatUrl = `https://night-navie.jp/chat`;

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">運営からメッセージが届きました ✨</h2>
    <p style="margin:0 0 14px;">${escapeHtml(name)}、NAVIÉです。運営から新しいメッセージがあります。</p>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#faf5f7; border:1px solid #f2d6e2;">
      <p style="margin:0; font-size:13px; color:#333; white-space:pre-wrap;">${escapeHtml(params.textPreview)}</p>
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
    const from = (msg.from ?? msg.sender ?? "user") as string;
    if (from !== "admin") return;

    // ✅ 削除/空は送らない
    if (msg.isDeleted === true) return;

    const rawText = String(msg.text ?? "").trim();
    const hasImage = !!msg.imageUrl;
    if (!rawText && !hasImage) return;

    const roomRef = db.doc(`chatRooms/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return;

    const room = roomSnap.data() as any;
    const userId = room?.userId as string | undefined;
    if (!userId) return;

    // ✅ メール送信のクールダウン（同ルーム5分に1回）
    const now = Date.now();
    const last =
      typeof room?.lastAdminNotifyAt?.toMillis === "function" ? room.lastAdminNotifyAt.toMillis() : 0;
    const cooldownMs = 5 * 60 * 1000;
    if (now - last < cooldownMs) return;

    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) return;

    const u = userSnap.data() as any;
    const to = String(u?.email ?? "").trim();
    if (!to) return;

    const textPreview =
      rawText.length > 140 ? rawText.slice(0, 140) + "…" : rawText || (hasImage ? "画像が届きました" : "");

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildNewAdminMessageEmail({
      nickname: u?.nickname,
      roomId,
      textPreview,
    });

    await resend.emails.send({ from: FROM, to, subject, html, text });

    await roomRef.set({ lastAdminNotifyAt: FieldValue.serverTimestamp() }, { merge: true });
  }
);

// =====================
// ユーザー通知：承認メール（pending -> user）
// =====================
function buildApprovalEmail(params: { nickname?: string }) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";
  const subject = "【NAVIÉ】審査完了のお知らせ";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">審査が完了しました ✨</h2>
    <p style="margin:0 0 16px;">${escapeHtml(name)}、NAVIÉのご登録ありがとうございます。<br/>アカウントの審査が完了しました。</p>

    <p style="margin:0 0 24px;">
      <a href="https://night-navie.jp/mypage"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d14a79;color:#fff;text-decoration:none;font-weight:600;">
        マイページへ進む
      </a>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0;font-size:12px;color:#666;">
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

    if (!(before.role === "pending" && after.role === "user")) return;

    const to = String(after.email ?? "").trim();
    if (!to) {
      logger.warn("No email on user doc; skip sending.", { uid: event.params.uid });
      return;
    }

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildApprovalEmail({ nickname: after.nickname });

    await resend.emails.send({ from: FROM, to, subject, html, text });
    logger.info("Approval email sent.", { uid: event.params.uid, to });
  }
);

// =====================
// ユーザー通知：メール認証メール（onCall）
// =====================
function buildVerifyEmail(params: { nickname?: string; verifyUrl: string }) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";
  const subject = "【NAVIÉ】メールアドレスの認証をお願いします";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">メール認証のお願い ✨</h2>
    <p style="margin:0 0 16px;">${escapeHtml(name)}、NAVIÉのご登録ありがとうございます。<br/>下のボタンからメール認証を完了してください。</p>

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

export const sendVerificationEmail = onCall(
  { region: "asia-northeast1", secrets: [RESEND_API_KEY] },
  async (req) => {
    try {
      if (!req.auth?.uid) throw new HttpsError("unauthenticated", "ログインが必要です");

      const uid = req.auth.uid;
      const user = await getAuth().getUser(uid);
      const email = user.email;
      if (!email) throw new HttpsError("failed-precondition", "email がありません");

      if (user.emailVerified) return { ok: true, alreadyVerified: true };

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

        if (raw.includes("TOO_MANY_ATTEMPTS_TRY_LATER")) {
          throw new HttpsError("resource-exhausted", "再送が多すぎます。少し時間を置いてから試してください。");
        }
        throw new HttpsError("internal", "認証リンクの生成に失敗しました");
      }

      const resend = new Resend(RESEND_API_KEY.value());
      const nickname = (req.data?.nickname ?? undefined) as string | undefined;
      const { subject, html, text } = buildVerifyEmail({ nickname, verifyUrl });

      await resend.emails.send({ from: FROM, to: email, subject, html, text });
      logger.info("Verification email sent.", { uid, email });

      return { ok: true };
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      const raw = String(err?.message ?? err);
      logger.error("sendVerificationEmail unexpected error", { error: raw });
      throw new HttpsError("internal", "INTERNAL", { raw });
    }
  }
);

// =====================
// ユーザー通知：予定確定メール（schedules作成時）
// =====================
type ScheduleConfirmedEmailParams = {
  nickname?: string;
  title: string;
  typeLabel: string;
  startAtText: string;
  endAtText: string | null;
  location: string;
  memo: string;
};

function buildScheduleConfirmedEmail(params: ScheduleConfirmedEmailParams) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";
  const subject = "【NAVIÉ】日程が確定しました";
  const mypageUrl = "https://night-navie.jp/schedule";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">日程が確定しました ✨</h2>
    <p style="margin:0 0 16px;">${escapeHtml(name)}、NAVIÉです。以下の内容で予定を確定しました。</p>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#faf5f7; border:1px solid #f2d6e2;">
      <p style="margin:0; font-size:13px; color:#111;"><b>${escapeHtml(params.typeLabel)}</b>：${escapeHtml(params.title)}</p>
      <p style="margin:6px 0 0; font-size:13px; color:#333;">
        日時：${escapeHtml(params.startAtText)}${params.endAtText ? ` 〜 ${escapeHtml(params.endAtText)}` : ""}
      </p>
      ${
        params.location?.trim()
          ? `<p style="margin:6px 0 0; font-size:13px; color:#333;">場所：${escapeHtml(params.location)}</p>`
          : ""
      }
      ${
        params.memo?.trim()
          ? `<p style="margin:10px 0 0; font-size:12px; color:#555; white-space:pre-wrap;">${escapeHtml(
              params.memo
            )}</p>`
          : ""
      }
    </div>

    <p style="margin:0 0 24px;">
      <a href="${mypageUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d14a79;color:#fff;text-decoration:none;font-weight:600;">
        マイページで確認する
      </a>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0;font-size:12px;color:#666;">
      ※本メールは送信専用です。返信いただいてもお返事できません。
    </p>
  </div>
  `;

  const text = `${name} 様

NAVIÉです。日程が確定しました。

【内容】
${params.typeLabel}：${params.title}
日時：${params.startAtText}${params.endAtText ? ` 〜 ${params.endAtText}` : ""}
${params.location?.trim() ? `場所：${params.location}` : ""}
${params.memo?.trim() ? `\nメモ：\n${params.memo}\n` : ""}

確認：${mypageUrl}

※送信専用のため返信できません。`;

  return { subject, html, text };
}

export const notifyUserOnScheduleConfirmed = onDocumentCreated(
  {
    document: "schedules/{scheduleId}",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const db = getFirestore();
    const scheduleId = event.params.scheduleId;
    const data = event.data?.data() as any;
    if (!data) return;

    if (data.isDeleted === true) return;
    if (data.status !== "confirmed") return;
    if (data.createdBy !== "admin") return;

    const scheduleRef = db.doc(`schedules/${scheduleId}`);
    const snap = await scheduleRef.get();
    if (!snap.exists) return;

    const current = snap.data() as any;
    if (current?.confirmedMailSentAt) return; // 冪等

    const userId = current?.userId as string | undefined;
    if (!userId) return;

    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) return;

    const u = userSnap.data() as any;
    const to = String(u?.email ?? "").trim();
    if (!to) return;

    const startAt: Date | null = current?.startAt?.toDate ? current.startAt.toDate() : null;
    if (!startAt) return;

    const endAt: Date | null = current?.endAt?.toDate ? current.endAt.toDate() : null;

    const typeLabel = current?.type === "interview" ? "面接" : current?.type === "trial" ? "体験入店" : "予定";

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildScheduleConfirmedEmail({
      nickname: u?.nickname,
      title: String(current?.title || typeLabel),
      typeLabel,
      startAtText: fmtJstDateTime(startAt),
      endAtText: endAt ? fmtJstDateTime(endAt) : null,
      location: String(current?.location || ""),
      memo: String(current?.memo || ""),
    });

    await resend.emails.send({ from: FROM, to, subject, html, text });

    await scheduleRef.set({ confirmedMailSentAt: FieldValue.serverTimestamp() }, { merge: true });

    logger.info("Schedule confirmed email sent.", { scheduleId, to });
  }
);

// =====================
// ユーザー通知：予定日当日メール（毎朝9時JST）
// =====================
type ScheduleReminderEmailParams = {
  nickname?: string;
  title: string;
  typeLabel: string;
  startAtText: string;
  location: string;
};

function buildScheduleReminderEmail(params: ScheduleReminderEmailParams) {
  const name = params.nickname?.trim() ? params.nickname.trim() : "ご登録者さま";
  const subject = "【NAVIÉ】本日の予定リマインド";
  const mypageUrl = "https://night-navie.jp/schedule";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">本日の予定です ✨</h2>
    <p style="margin:0 0 16px;">${escapeHtml(name)}、NAVIÉです。今日の予定をお知らせします。</p>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#faf5f7; border:1px solid #f2d6e2;">
      <p style="margin:0; font-size:13px; color:#111;"><b>${escapeHtml(params.typeLabel)}</b>：${escapeHtml(params.title)}</p>
      <p style="margin:6px 0 0; font-size:13px; color:#333;">日時：${escapeHtml(params.startAtText)}</p>
      ${
        params.location?.trim()
          ? `<p style="margin:6px 0 0; font-size:13px; color:#333;">場所：${escapeHtml(params.location)}</p>`
          : ""
      }
    </div>

    <p style="margin:0 0 24px;">
      <a href="${mypageUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d14a79;color:#fff;text-decoration:none;font-weight:600;">
        マイページで確認する
      </a>
    </p>

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="margin:0;font-size:12px;color:#666;">
      ※本メールは送信専用です。返信いただいてもお返事できません。
    </p>
  </div>
  `;

  const text = `${name} 様

NAVIÉです。本日の予定リマインドです。

${params.typeLabel}：${params.title}
日時：${params.startAtText}
${params.location?.trim() ? `場所：${params.location}` : ""}

確認：${mypageUrl}

※送信専用のため返信できません。`;

  return { subject, html, text };
}

export const sendScheduleRemindersDaily = onSchedule(
  {
    schedule: "0 9 * * *",
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY],
  },
  async () => {
    const db = getFirestore();
    const resend = new Resend(RESEND_API_KEY.value());

    const todayStart = DateTime.now().setZone("Asia/Tokyo").startOf("day");
    const todayEnd = todayStart.plus({ days: 1 });

    const startTs = Timestamp.fromDate(todayStart.toJSDate());
    const endTs = Timestamp.fromDate(todayEnd.toJSDate());

    const q = db
      .collection("schedules")
      .where("status", "==", "confirmed")
      .where("startAt", ">=", startTs)
      .where("startAt", "<", endTs);

    const snap = await q.get();
    if (snap.empty) {
      logger.info("No schedules for today.");
      return;
    }

    for (const docSnap of snap.docs) {
      const s = docSnap.data() as any;

      if (s?.isDeleted === true) continue;
      if (s?.reminderSentAt) continue;

      const userId = s?.userId as string | undefined;
      if (!userId) continue;

      const userSnap = await db.doc(`users/${userId}`).get();
      if (!userSnap.exists) continue;

      const u = userSnap.data() as any;
      const to = String(u?.email ?? "").trim();
      if (!to) continue;

      const startAt: Date | null = s?.startAt?.toDate ? s.startAt.toDate() : null;
      if (!startAt) continue;

      const typeLabel = s?.type === "interview" ? "面接" : s?.type === "trial" ? "体験入店" : "予定";

      const { subject, html, text } = buildScheduleReminderEmail({
        nickname: u?.nickname,
        title: String(s?.title || typeLabel),
        typeLabel,
        startAtText: fmtJstDateTime(startAt),
        location: String(s?.location || ""),
      });

      try {
        await resend.emails.send({ from: FROM, to, subject, html, text });
        await docSnap.ref.set({ reminderSentAt: FieldValue.serverTimestamp() }, { merge: true });
        logger.info("Schedule reminder sent.", { scheduleId: docSnap.id, to });
      } catch (e: any) {
        logger.error("Failed to send reminder.", {
          scheduleId: docSnap.id,
          to,
          error: String(e?.message ?? e),
        });
      }
    }
  }
);

// =====================
// 管理者通知①：承認待ちユーザーが増えた（users作成時 role=pending）
// =====================
function buildAdminNewPendingUserEmail(params: { uid: string; nickname?: string; email?: string }) {
  const subject = "【NAVIÉ】承認待ちユーザーが追加されました";
  const adminUrl = `https://night-navie.jp/admin/users?status=pending`;

  const name = params.nickname?.trim() ? params.nickname.trim() : "(未設定)";
  const email = params.email?.trim() ? params.email.trim() : "(未設定)";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">承認待ちユーザーが追加されました</h2>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#f6f7fb; border:1px solid #e5e7f2;">
      <p style="margin:0; font-size:13px;"><b>UID</b>：${escapeHtml(params.uid)}</p>
      <p style="margin:6px 0 0; font-size:13px;"><b>nickname</b>：${escapeHtml(name)}</p>
      <p style="margin:6px 0 0; font-size:13px;"><b>email</b>：${escapeHtml(email)}</p>
    </div>

    <p style="margin:0 0 24px;">
      <a href="${adminUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-weight:600;">
        管理画面で確認
      </a>
    </p>
  </div>`;

  const text = `NAVIÉ 管理者各位

承認待ちユーザーが追加されました。

UID: ${params.uid}
nickname: ${name}
email: ${email}

確認: ${adminUrl}
`;

  return { subject, html, text };
}

export const notifyAdminOnNewPendingUser = onDocumentCreated(
  {
    document: "users/{uid}",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY, ADMIN_EMAILS],
  },
  async (event) => {
    const after = event.data?.data() as any;
    if (!after) return;

    if (after.role !== "pending") return;

    const db = getFirestore();
    const userRef = db.doc(`users/${event.params.uid}`);

    if (after.adminPendingNotifiedAt) return; // 冪等

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildAdminNewPendingUserEmail({
      uid: event.params.uid,
      nickname: after.nickname,
      email: after.email,
    });

    await sendToAdmins(resend, { subject, html, text });

    await userRef.set({ adminPendingNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });

    logger.info("Admin notified: new pending user", { uid: event.params.uid });
  }
);

// =====================
// 管理者通知②：ユーザーからチャットが来た
// =====================
function buildAdminNewUserChatEmail(params: { roomId: string; nickname?: string; textPreview: string }) {
  const subject = "【NAVIÉ】ユーザーから新しいチャットが届きました";
  const adminChatUrl = `https://night-navie.jp/admin/chat?roomId=${encodeURIComponent(params.roomId)}`;

  const name = params.nickname?.trim() ? params.nickname.trim() : "（未設定）";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">ユーザーからチャットが届きました</h2>
    <p style="margin:0 0 14px;">送信者：<b>${escapeHtml(name)}</b></p>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#f6f7fb; border:1px solid #e5e7f2;">
      <p style="margin:0; font-size:13px; color:#333; white-space:pre-wrap;">${escapeHtml(params.textPreview)}</p>
    </div>

    <p style="margin:0 0 24px;">
      <a href="${adminChatUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-weight:600;">
        管理チャットを開く
      </a>
    </p>
  </div>`;

  const text = `NAVIÉ 管理者各位

ユーザーから新しいチャットが届きました。
送信者: ${name}

--- 抜粋 ---
${params.textPreview}
-----------

管理チャット: ${adminChatUrl}
`;

  return { subject, html, text };
}

export const notifyAdminOnUserMessage = onDocumentCreated(
  {
    document: "chatRooms/{roomId}/messages/{messageId}",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY, ADMIN_EMAILS],
  },
  async (event) => {
    const db = getFirestore();
    const roomId = event.params.roomId;
    const msg = event.data?.data() as any;
    if (!msg) return;

    const from = (msg.from ?? msg.sender ?? "user") as string;
    if (from !== "user") return;

    if (msg.isDeleted === true) return;

    const rawText = String(msg.text ?? "").trim();
    const hasImage = !!msg.imageUrl;
    if (!rawText && !hasImage) return;

    const roomRef = db.doc(`chatRooms/${roomId}`);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) return;

    const room = roomSnap.data() as any;

    // ✅ クールダウン（同ルーム2分に1回）
    const now = Date.now();
    const last =
      typeof room?.lastUserNotifyToAdminAt?.toMillis === "function"
        ? room.lastUserNotifyToAdminAt.toMillis()
        : 0;
    const cooldownMs = 2 * 60 * 1000;
    if (now - last < cooldownMs) return;

    const userId = room?.userId as string | undefined;
    if (!userId) return;

    const userSnap = await db.doc(`users/${userId}`).get();
    const u = userSnap.exists ? (userSnap.data() as any) : null;

    const textPreview =
      rawText.length > 140 ? rawText.slice(0, 140) + "…" : rawText || (hasImage ? "画像が届きました" : "");

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildAdminNewUserChatEmail({
      roomId,
      nickname: u?.nickname,
      textPreview,
    });

    await sendToAdmins(resend, { subject, html, text });

    await roomRef.set({ lastUserNotifyToAdminAt: FieldValue.serverTimestamp() }, { merge: true });

    logger.info("Admin notified: user message", { roomId, userId });
  }
);

// =====================
// 管理者通知③：候補日（requests）が提出された（←あなたのUIはこっち）
// =====================
function buildAdminRequestSubmittedEmail(params: {
  requestId: string;
  nickname?: string;
  typeLabel: string;
  candidatesText: string;
  memo?: string;
}) {
  const subject = "【NAVIÉ】候補日が提出されました";
  const adminUrl = `https://night-navie.jp/admin/requests?focus=${encodeURIComponent(params.requestId)}`;

  const name = params.nickname?.trim() ? params.nickname.trim() : "（未設定）";

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans JP','Hiragino Sans','Helvetica Neue',Arial;line-height:1.7;color:#111;">
    <h2 style="margin:0 0 12px;">候補日が提出されました</h2>

    <div style="margin:0 0 18px; padding:12px 14px; border-radius:12px; background:#f6f7fb; border:1px solid #e5e7f2;">
      <p style="margin:0; font-size:13px;"><b>提出者</b>：${escapeHtml(name)}</p>
      <p style="margin:6px 0 0; font-size:13px;"><b>種別</b>：${escapeHtml(params.typeLabel)}</p>

      <div style="margin:10px 0 0; padding:10px 12px; border-radius:10px; background:#fff; border:1px solid #eee;">
        <p style="margin:0; font-size:12px; color:#333; white-space:pre-wrap;">${escapeHtml(params.candidatesText)}</p>
      </div>

      ${
        params.memo?.trim()
          ? `<p style="margin:10px 0 0; font-size:12px; color:#555; white-space:pre-wrap;"><b>メモ</b>\n${escapeHtml(
              params.memo
            )}</p>`
          : ""
      }

      <p style="margin:10px 0 0; font-size:12px; color:#666;"><b>ID</b>：${escapeHtml(params.requestId)}</p>
    </div>

    <p style="margin:0 0 24px;">
      <a href="${adminUrl}"
         style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111;color:#fff;text-decoration:none;font-weight:600;">
        管理画面で確認
      </a>
    </p>
  </div>`;

  const text = `NAVIÉ 管理者各位

候補日が提出されました。

提出者: ${name}
種別: ${params.typeLabel}

${params.candidatesText}

${params.memo?.trim() ? `メモ:\n${params.memo}\n\n` : ""}ID: ${params.requestId}
確認: ${adminUrl}
`;

  return { subject, html, text };
}

export const notifyAdminOnRequestSubmitted = onDocumentCreated(
  {
    document: "requests/{requestId}",
    region: "asia-northeast1",
    secrets: [RESEND_API_KEY, ADMIN_EMAILS],
  },
  async (event) => {
    const db = getFirestore();
    const requestId = event.params.requestId;
    const data = event.data?.data() as any;
    if (!data) return;

    // あなたのUIは addDoc で status:"open" を入れてる
    if (data.status !== "open") return;
    if (data.isDeleted === true) return;

    // 冪等
    if (data.adminNotifiedAt) return;

    const userId = data.userId as string | undefined;
    if (!userId) return;

    // 同一ユーザー連投ガード（2分）
    const userRef = db.doc(`users/${userId}`);
    const userSnap = await userRef.get();
    const u = userSnap.exists ? (userSnap.data() as any) : null;

    const now = Date.now();
    const last =
      typeof u?.lastRequestNotifyToAdminAt?.toMillis === "function" ? u.lastRequestNotifyToAdminAt.toMillis() : 0;
    const cooldownMs = 2 * 60 * 1000;
    if (now - last < cooldownMs) return;

    const nickname = u?.nickname;

    // candidates を整形
    const candidatesArr = Array.isArray(data.candidates) ? data.candidates : [];
    const lines: string[] = [];
    for (let i = 0; i < Math.min(candidatesArr.length, 3); i++) {
      const c = candidatesArr[i];
      const start = c?.startAt?.toDate ? c.startAt.toDate() : null;
      const end = c?.endAt?.toDate ? c.endAt.toDate() : null;
      const note = String(c?.note ?? "").trim();
      if (!start) continue;

      lines.push(
        `・${fmtJstDateTime(start)}${end ? ` 〜 ${fmtJstDateTime(end)}` : ""}${note ? `（${note}）` : ""}`
      );
    }
    const candidatesText = lines.length ? lines.join("\n") : "（候補日の取得に失敗）";

    const typeLabel = data.type === "interview" ? "面接" : data.type === "trial" ? "体験入店" : "その他";

    const resend = new Resend(RESEND_API_KEY.value());
    const { subject, html, text } = buildAdminRequestSubmittedEmail({
      requestId,
      nickname,
      typeLabel,
      candidatesText,
      memo: String(data.memo ?? ""),
    });

    await sendToAdmins(resend, { subject, html, text });

    // 送信済み印（request側）
    await db.doc(`requests/${requestId}`).set({ adminNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });

    // クールダウン印（user側）
    await userRef.set({ lastRequestNotifyToAdminAt: FieldValue.serverTimestamp() }, { merge: true });

    logger.info("Admin notified: request submitted", { requestId, userId });
  }
);
