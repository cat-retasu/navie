// app/chat/page.tsx
"use client";

import { FormEvent, useEffect, useRef, useState, ChangeEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient, getStorageClient } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  increment,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import NavieBg from "@/components/NavieBg";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ChatMessage = {
  id: string;
  from: "user" | "admin";
  text: string;
  createdAt?: Date | null;
  isDeleted?: boolean;
  imageUrl?: string;
  readByAdmin?: boolean;
  readByUser?: boolean;
  isEdited?: boolean;
};

type RoomInfo = {
  id: string;
  userId: string;
  adminTyping?: boolean;
};

// ✅ 既存ルームがあれば取得、なければ作成して RoomInfo を返す
async function getOrCreateRoom(db: any, userId: string): Promise<RoomInfo> {
  const q = query(
    collection(db, "chatRooms"),
    where("userId", "==", userId),
    limit(1)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    const d = snap.docs[0];
    const data = d.data() as any;
    return {
      id: d.id,
      userId: data.userId ?? userId,
      adminTyping: data.adminTyping ?? false,
    };
  }

  const newRoomRef = await addDoc(collection(db, "chatRooms"), {
    userId,
    lastMessage: "",
    updatedAt: serverTimestamp(),
    adminTyping: false,
    userTyping: false,
  });

  return {
    id: newRoomRef.id,
    userId,
    adminTyping: false,
  };
}

// 日付キー（同じ日のメッセージをまとめる用）
const getDateKey = (d?: Date | null) => {
  if (!d) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// 「今日 / 昨日 / 12月1日」みたいなラベル
const getDateLabel = (d: Date) => {
  const today = new Date();
  const toDateOnly = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffMs = toDateOnly(today).getTime() - toDateOnly(d).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (d.getFullYear() === today.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

// 時刻「21:34」みたいに整形
const formatTime = (d?: Date | null) => {
  if (!d) return "";
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
};

export default function UserChatPage() {
  const router = useRouter();
  const db = useMemo(() => getDbClient(), []);
  const storage = useMemo(() => getStorageClient(), []);
  const { user, userData, loading } = useAuth();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // ログインチェック
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (userData?.role === "suspended") {
      router.replace("/suspended");
      return;
    }

    if (userData?.role === "admin") {
      router.replace("/admin");
      return;
    }

    if (userData?.role === "pending") {
      router.replace("/pending");
      return;
    }
  }, [user, userData, loading, router]);

  // ✅ ルーム取得 or 作成（ここ1箇所だけ）
    useEffect(() => {
    if (!user) return;
    if (!db) return;

    (async () => {
      setLoadingRoom(true);
      try {
        const r = await getOrCreateRoom(db, user.uid);
        setRoom(r);
      } catch (e) {
        console.error(e);
        setError("チャットルームの準備に失敗しました。");
      } finally {
        setLoadingRoom(false);
      }
    })();
  }, [user, db]);

  // typingTimeout のクリーンアップ
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ルーム情報（adminTypingなど）の購読
    useEffect(() => {
    if (!room) return;
    if (!db) return;

    const roomRef = doc(db, "chatRooms", room.id);

    const unsub = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setIsAdminTyping(!!data.adminTyping);
    });

    return () => unsub();
  }, [room, db]);

  // メッセージ購読
    useEffect(() => {
    if (!room) return;
    if (!db) return;

    const msgsRef = collection(db, "chatRooms", room.id, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAt: Date | null = data.createdAt?.toDate ? data.createdAt.toDate() : null;

          const from: "user" | "admin" =
            data.from === "admin" || data.sender === "admin" || data.isAdmin === true ? "admin" : "user";

          return {
            id: d.id,
            from,
            text: data.text ?? "",
            createdAt,
            isDeleted: data.isDeleted ?? false,
            imageUrl: data.imageUrl ?? undefined,
            readByAdmin: data.readByAdmin ?? false,
            readByUser: data.readByUser ?? false,
            isEdited: data.isEdited ?? false,
          };
        });

        setMessages(list);
        setLoadingMessages(false);
      },
      (err) => {
        console.error(err);
        setLoadingMessages(false);
      }
    );

    return () => unsub();
  }, [room, db]);

  // admin → user メッセージを既読にする
    useEffect(() => {
    const markRead = async () => {
      if (!room) return;
      if (!db) return;

      const targets = messages.filter((m) => m.from === "admin" && !m.readByUser && !m.isDeleted);
      if (!targets.length) return;

      try {
        await Promise.all(
          targets.map((m) =>
            updateDoc(doc(db, "chatRooms", room.id, "messages", m.id), { readByUser: true })
          )
        );
      } catch (e) {
        console.error("failed to mark readByUser:", e);
      }

      await updateDoc(doc(db, "chatRooms", room.id), {
  unreadCountForUser: 0,
});

    };

    if (messages.length > 0) markRead();
  }, [messages, room, db]);

  // 自動スクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // userTyping 更新
    const setUserTyping = async (typing: boolean) => {
    if (!room) return;
    if (!db) return;
    try {
      const roomRef = doc(db, "chatRooms", room.id);
      await updateDoc(roomRef, { userTyping: typing });
    } catch (e) {
      console.error("failed to update userTyping", e);
    }
  };

  const handleChangeInput = (value: string) => {
    setInput(value);
    if (!room) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setUserTyping(value.trim().length > 0);
    typingTimeoutRef.current = setTimeout(() => setUserTyping(false), 2000);
  };

  // テキスト送信
    const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!room) return;
    if (!db) return;

    const text = input.trim();
    if (!text) return;

    try {
      setSending(true);
      setError(null);

      const msgsRef = collection(db, "chatRooms", room.id, "messages");
      await addDoc(msgsRef, {
        text,
        from: "user",
        sender: "user",
        createdAt: serverTimestamp(),
        isDeleted: false,
        imageUrl: null,
        readByAdmin: false,
        readByUser: true,
        isEdited: false,
      });

      const roomRef = doc(db, "chatRooms", room.id);
      await updateDoc(roomRef, {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        userTyping: false,
        lastSender: "user",
        unreadCountForAdmin: increment(1),
      });

      setInput("");
    } catch (err) {
      console.error(err);
      setError("メッセージの送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  // 画像送信
    const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;
    if (!db || !storage) return;

    try {
      setUploadingImage(true);
      setError(null);

      const path = `chatImages/${room.id}/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const msgsRef = collection(db, "chatRooms", room.id, "messages");
      await addDoc(msgsRef, {
        text: "",
        imageUrl: url,
        from: "user",
        sender: "user",
        createdAt: serverTimestamp(),
        isDeleted: false,
        readByAdmin: false,
        readByUser: true,
        isEdited: false,
      });

      const roomRef = doc(db, "chatRooms", room.id);
      await updateDoc(roomRef, {
        lastMessage: "画像を送信しました",
        updatedAt: serverTimestamp(),
        userTyping: false,
        lastSender: "user",
        unreadCountForAdmin: increment(1),
      });

      e.target.value = "";
    } catch (err) {
      console.error(err);
      setError("画像の送信に失敗しました。");
    } finally {
      setUploadingImage(false);
    }
  };

  if (loading || !user || loadingRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#0f0f12]">
        <div className="nomi-card px-5 py-4 text-sm" style={{ color: "var(--muted)" }}>
          読み込み中…
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen text-[#0f0f12] relative overflow-hidden">
      {/* 背景（NAVIÉ） */}
      <NavieBg />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1200px 720px at 18% 12%, rgba(255,59,122,0.14), transparent 62%),
              radial-gradient(900px 640px at 88% 28%, rgba(255,208,223,0.42), transparent 62%),
              radial-gradient(1000px 760px at 50% 110%, rgba(255,59,122,0.10), transparent 62%),
              linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,249,251,1) 48%, rgba(255,255,255,1) 100%)
            `,
          }}
        />
        <div className="pointer-events-none absolute inset-0 nomi-dots" />
        <div className="pointer-events-none absolute inset-0 navie-grain" />
      </div>

      <div className="mx-auto w-full px-4 pb-10 pt-16 md:pt-20">
        {/* md以上：外枠（スマホは枠なし） */}
        <div
          className={cx(
            "mx-auto w-full max-w-4xl",
            "md:rounded-[44px] md:border md:border-[rgba(255,59,122,0.18)]",
            "md:bg-white/55 md:backdrop-blur-[14px]",
            "md:shadow-[0_26px_90px_rgba(18,18,24,0.14)]",
            "md:p-6 lg:p-8",
            "md:relative md:overflow-hidden"
          )}
        >
          <div
            aria-hidden
            className="hidden md:block absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.55), transparent 60%)",
            }}
          />

          <div className="relative">
            {/* ヘッダー */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                  CHAT
                </p>
                <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                  運営とのチャット
                </h1>
                <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  条件の相談や不安なことなど、LINE感覚で送ってください。
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.history.back()}
                className="shrink-0 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white transition"
                style={{ color: "var(--muted)" }}
              >
                ← 戻る
              </button>
            </div>

            {/* チャットカード（nomi-card） */}
            <section
              className={cx(
                "nomi-card",
                "p-0 overflow-hidden flex flex-col",
                "min-h-[62vh] md:min-h-[70vh]",
                "max-h-[calc(100vh-220px)]"
              )}
            >
              {/* 上部バー */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10 bg-white/55 backdrop-blur-[10px]">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold truncate" style={{ color: "rgba(95,96,107,0.85)" }}>
                    NAVIÉ 運営スタッフ
                  </p>
                  <p className="text-sm font-semibold text-[#0f0f12] truncate">ご相談はこちらから</p>
                </div>

                {isAdminTyping && (
                  <p className="text-[11px] font-semibold shrink-0" style={{ color: "var(--pink)" }}>
                    入力中…
                  </p>
                )}

                <div className="text-right max-w-[42%] hidden sm:block">
                  <p className="text-[10px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                    ルームID
                  </p>
                  <p className="text-[10px] break-all" style={{ color: "rgba(95,96,107,0.95)" }}>
                    {room?.id}
                  </p>
                </div>
              </div>

              {/* メッセージ一覧 */}
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 md:px-4 md:py-4 space-y-2">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs" style={{ color: "rgba(95,96,107,0.85)" }}>
                      読み込み中です…
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-xs text-center leading-relaxed" style={{ color: "rgba(95,96,107,0.85)" }}>
                      まだメッセージがありません。
                      <br />
                      「はじめまして」など一言から送ってみてください。
                    </p>
                  </div>
                ) : (
                  (() => {
                    let lastDateKey = "";
                    return messages.map((m) => {
                      const dateKey = getDateKey(m.createdAt);
                      const showDateLabel = dateKey && dateKey !== lastDateKey;
                      if (showDateLabel) lastDateKey = dateKey;

                      const isMine = m.from === "user";

                      if (m.isDeleted) {
                        return (
                          <div key={m.id}>
                            {showDateLabel && m.createdAt && (
                              <div className="flex justify-center my-2">
                                <div className="px-3 py-0.5 text-[10px] rounded-full border border-black/10 bg-white/70">
                                  <span style={{ color: "rgba(95,96,107,0.85)" }}>{getDateLabel(m.createdAt)}</span>
                                </div>
                              </div>
                            )}
                            <div className="flex justify-center text-[10px] my-2" style={{ color: "rgba(95,96,107,0.75)" }}>
                              このメッセージは削除されました
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={m.id}>
                          {showDateLabel && m.createdAt && (
                            <div className="flex justify-center my-2">
                              <div className="px-3 py-0.5 text-[10px] rounded-full border border-black/10 bg-white/70">
                                <span style={{ color: "rgba(95,96,107,0.85)" }}>{getDateLabel(m.createdAt)}</span>
                              </div>
                            </div>
                          )}

                          <div className={cx("flex", isMine ? "justify-end" : "justify-start")}>
                            <div
                              className={cx(
                                "max-w-[82%] rounded-2xl px-3 py-2 text-xs md:text-[13px] leading-relaxed shadow-sm",
                                isMine
                                  ? "text-white rounded-br-sm"
                                  : "border border-black/10 bg-white/75 text-[#0f0f12] rounded-bl-sm"
                              )}
                              style={
                                isMine
                                  ? {
                                      background:
                                        "linear-gradient(135deg, #FF2F72 0%, #FF5B8D 55%, #FF9DB8 100%)",
                                    }
                                  : undefined
                              }
                            >
                              {/* 画像 */}
                              {m.imageUrl && (
                                <div className="mb-1">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m.imageUrl}
                                    alt="送信画像"
                                    className="max-h-64 rounded-xl border border-black/10 cursor-pointer"
                                    onClick={() => setSelectedImageUrl(m.imageUrl!)}
                                  />
                                </div>
                              )}

                              {/* テキスト */}
                              {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}

                              {/* 時刻＋編集済み表示 */}
                              <div className="mt-1 flex items-center justify-between gap-2 text-[9px]">
                                <span style={{ color: isMine ? "rgba(255,255,255,0.82)" : "rgba(95,96,107,0.8)" }}>
                                  {formatTime(m.createdAt)}
                                  {m.isEdited && "（編集済み）"}
                                </span>

                                {isMine && (
                                  <span style={{ color: "rgba(255,255,255,0.82)" }}>
                                    {m.readByAdmin ? "既読" : "送信済み"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
                <div ref={bottomRef} />
              </div>

              {/* 入力フォーム */}
              <form onSubmit={handleSend} className="border-t border-black/10 px-3 py-3 md:px-4 md:py-3 flex flex-col gap-2 bg-white/55 backdrop-blur-[10px]">
                {error && (
                  <div className="rounded-2xl border border-[rgba(255,59,122,0.25)] bg-[rgba(255,59,122,0.08)] px-3 py-2 text-[11px]">
                    <span className="font-semibold" style={{ color: "var(--pink)" }}>
                      エラー：
                    </span>{" "}
                    <span style={{ color: "var(--muted)" }}>{error}</span>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => handleChangeInput(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-sm text-[#0f0f12] placeholder:text-[#9aa0aa] outline-none focus:border-[rgba(255,59,122,0.45)]"
                      placeholder="相談したいことや聞きたいことを入力してください"
                    />

                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      <label className="cursor-pointer inline-flex items-center gap-2 hover:opacity-80">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-black/10 bg-white/70 font-semibold">
                          画像を選択
                        </span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                      </label>

                      {uploadingImage && (
                        <span className="font-semibold" style={{ color: "var(--pink)" }}>
                          アップロード中…
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className={cx(
                      "inline-flex items-center justify-center rounded-full h-[44px] px-5 text-sm font-semibold text-white transition",
                      "shadow-[0_14px_36px_rgba(255,59,122,0.24)] hover:-translate-y-[1px] active:translate-y-0",
                      "disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
                    )}
                    style={{
                      background: "linear-gradient(135deg, #FF2F72 0%, #FF5B8D 55%, #FF9DB8 100%)",
                    }}
                  >
                    {sending ? "送信中…" : "送信"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>

      {/* 画像モーダル */}
      {selectedImageUrl && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70" onClick={() => setSelectedImageUrl(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedImageUrl} alt="拡大画像" className="max-h-[80vh] max-w-[90vw] rounded-2xl border border-white/20" />
        </div>
      )}
    </main>
  );
}
