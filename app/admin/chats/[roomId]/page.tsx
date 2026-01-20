// app/admin/chats/[roomId]/page.tsx
"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { NightNaviBg } from "@/components/NightNaviBg";
import { getDbClient, getStorageClient } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  increment,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

type ChatMessage = {
  id: string;
  from: "user" | "admin";
  text: string;
  createdAt?: Date | null;
  isDeleted?: boolean;
  imageUrl?: string | null;
  readByAdmin?: boolean;
  readByUser?: boolean;
  isEdited?: boolean;
};

type RoomInfo = {
  id: string;
  userId: string;
  userTyping?: boolean;
};

type QuickReply = {
  id: string;
  category: string;
  text: string;
  order: number;
};

// 時刻「21:34」みたいに整形（user chat と揃え）
const formatTime = (d?: Date | null) => {
  if (!d) return "";
  return d.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 「今日 / 昨日 / 12月1日」ラベル（user chat と揃え）
const getDateLabel = (d: Date) => {
  const today = new Date();
  const toDateOnly = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffMs = toDateOnly(today).getTime() - toDateOnly(d).getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "昨日";
  if (d.getFullYear() === today.getFullYear()) {
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const getDateKey = (d?: Date | null) => {
  if (!d) return "";
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; // user chat と合わせる
};

export default function AdminChatRoomPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const params = useParams<{ roomId: string }>();
  const roomId = params.roomId;

    // ✅ Firebase clients（ブラウザでだけ生きる）
  const db = useMemo(() => getDbClient(), []);
  const storage = useMemo(() => getStorageClient(), []);


  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // userTyping（相手が入力中）
  const [userTyping, setUserTyping] = useState(false);

  // 画像モーダル
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  // quick replies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // admin typing（自分が入力中）を room に反映（相手側の “運営が入力中…” 用）
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adminチェック（既存方針維持）:contentReference[oaicite:2]{index=2}
  useEffect(() => {
    if (loading) return;
    if (!user || userData?.role !== "admin") {
      router.replace("/login");
    }
  }, [user, userData, loading, router]);

  // ルーム情報取得 + userTyping購読 + 未読リセット :contentReference[oaicite:3]{index=3}
    useEffect(() => {
    if (!roomId) return;
    if (!db) return;

    const roomRef = doc(db, "chatRooms", roomId);

    const fetchRoom = async () => {
      try {
        const snap = await getDoc(roomRef);
        if (!snap.exists()) {
          setLoadingRoom(false);
          return;
        }
        const data = snap.data() as any;

        setRoom({
          id: snap.id,
          userId: data.userId,
          userTyping: data.userTyping ?? false,
        });

        setUserTyping(!!data.userTyping);

        // 管理側の未読数を 0 に
        await updateDoc(roomRef, { unreadCountForAdmin: 0 });

        setLoadingRoom(false);
      } catch (e) {
        console.error(e);
        setLoadingRoom(false);
      }
    };

    fetchRoom();

    const unsub = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setUserTyping(!!data.userTyping);
    });

    return () => unsub();
  }, [roomId, db]);

  // QuickReplies 購読（/admin/quick-replies と揃え）:contentReference[oaicite:4]{index=4}
    useEffect(() => {
    if (!user || userData?.role !== "admin") return;
    if (!db) return;

    const q = query(collection(db, "quickReplies"), orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QuickReply[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            category: data.category ?? "",
            text: data.text ?? "",
            order: typeof data.order === "number" ? data.order : 1,
          };
        });
        setQuickReplies(list);
      },
      (e) => {
        console.error(e);
        setError("クイック返信の読み込みに失敗しました");
      }
    );

    return () => unsub();
  }, [user, userData?.role, db]);

  const categories = useMemo(
    () => ["all", ...new Set(quickReplies.map((q) => q.category))],
    [quickReplies]
  );

  const filteredQuickReplies = useMemo(() => {
    return activeCategory === "all"
      ? quickReplies
      : quickReplies.filter((q) => q.category === activeCategory);
  }, [quickReplies, activeCategory]);

  // メッセージ購読
    useEffect(() => {
    if (!roomId) return;
    if (!db) return;

    const msgsRef = collection(db, "chatRooms", roomId, "messages");
    const q = query(msgsRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ChatMessage[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          return {
            id: d.id,
            from: data.from ?? "user",
            text: data.text ?? "",
            createdAt,
            isDeleted: !!data.isDeleted,
            imageUrl: data.imageUrl ?? null,
            readByAdmin: !!data.readByAdmin,
            readByUser: !!data.readByUser,
            isEdited: !!data.isEdited,
          };
        });
        setMessages(list);
        setLoadingMessages(false);
      },
      (e) => {
        console.error(e);
        setError("メッセージの取得に失敗しました");
        setLoadingMessages(false);
      }
    );

    return () => unsub();
  }, [roomId, db]);

  // 管理画面を開いてる間：ユーザーメッセを既読（readByAdmin=true）に寄せる
    useEffect(() => {
    const markRead = async () => {
      if (!roomId) return;
      if (!db) return;

      const targets = messages.filter((m) => m.from === "user" && !m.readByAdmin);
      if (targets.length === 0) return;

      await Promise.all(
        targets.map((m) =>
          updateDoc(doc(db, "chatRooms", roomId, "messages", m.id), {
            readByAdmin: true,
          })
        )
      );
    };

    if (messages.length > 0) markRead().catch(console.error);
  }, [messages, roomId, db]);


  // スクロール追従
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // admin typing 送信（軽い debounce）
    const pushAdminTyping = async (isTyping: boolean) => {
    if (!roomId) return;
    if (!db) return;
    try {
      await updateDoc(doc(db, "chatRooms", roomId), {
        adminTyping: isTyping,
      });
    } catch {
      // ignore
    }
  };

  const onChangeInput = (v: string) => {
    setInput(v);

    // typing を room に反映
    pushAdminTyping(true);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      pushAdminTyping(false);
    }, 1200);
  };

  // 送信（テキスト）
    const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!room || !roomId) return;
    if (!db) return;

    const text = input.trim();
    if (!text) return;

    try {
      setSending(true);
      setError(null);

      const msgsRef = collection(db, "chatRooms", room.id, "messages");
      await addDoc(msgsRef, {
        text,
        from: "admin",
        sender: "admin",
        createdAt: serverTimestamp(),
        isDeleted: false,
        imageUrl: null,
        readByAdmin: true,
        readByUser: false,
        isEdited: false,
      });

      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: text,
        updatedAt: serverTimestamp(),
        adminTyping: false,
        lastSender: "admin",
        unreadCountForUser: increment(1),
      });

      setInput("");
      await pushAdminTyping(false);
    } catch (err) {
      console.error(err);
      setError("メッセージの送信に失敗しました。");
    } finally {
      setSending(false);
    }
  };

  // 画像送信（admin）
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
        from: "admin",
        sender: "admin",
        createdAt: serverTimestamp(),
        isDeleted: false,
        readByAdmin: true,
        readByUser: false,
        isEdited: false,
      });

      await updateDoc(doc(db, "chatRooms", room.id), {
        lastMessage: "画像を送信しました",
        updatedAt: serverTimestamp(),
        adminTyping: false,
        lastSender: "admin",
        unreadCountForUser: increment(1),
      });

      e.target.value = "";
    } catch (err) {
      console.error(err);
      setError("画像の送信に失敗しました。");
    } finally {
      setUploadingImage(false);
    }
  };

  // メッセージ削除（admin 自分の送信だけ） :contentReference[oaicite:5]{index=5}
    const handleDeleteMessage = async (m: ChatMessage) => {
    if (!roomId) return;
    if (!db) return;
    if (!confirm("このメッセージを削除しますか？")) return;

    try {
      await updateDoc(doc(db, "chatRooms", roomId, "messages", m.id), {
        isDeleted: true,
        text: "（削除しました）",
        imageUrl: null,
      });
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    }
  };

  // QuickReply 挿入
  const applyQuickReply = (text: string) => {
    // すぐ送るより「入力欄に入れて微調整」できる方が運用で強い
    setInput(text);
    pushAdminTyping(true);
  };

  if (loading || !user || loadingRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        読み込み中です…
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        ルームが見つかりませんでした
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <NightNaviBg variant="admin" />

      <main className="mx-auto w-full max-w-5xl px-3 md:px-6 py-4 md:py-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/chats"
              className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
            >
              ← 戻る
            </Link>

            <div className="min-w-0">
              <p className="text-[11px] tracking-[0.2em] text-pink-300/80">
                ADMIN CHAT
              </p>
              <div className="mt-0.5 flex items-center gap-2">
                <h1 className="text-sm md:text-base font-semibold truncate">
                  ルーム：{room.id}
                </h1>
                <span className="hidden md:inline text-[11px] text-gray-300">
                  User: {room.userId}
                </span>
              </div>
            </div>
          </div>

          <Link
            href={`/admin/users/${room.userId}`}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 transition"
          >
            ユーザー詳細 →
          </Link>
        </header>

        {/* Chat card */}
        <section
  className="
    overflow-hidden rounded-3xl border border-white/10 bg-black/30
    shadow-[0_20px_60px_rgba(0,0,0,0.55)]
    flex flex-col
    h-[calc(100vh-160px)] md:h-[calc(100vh-180px)]
  "
>
          {/* top bar */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="text-xs text-gray-200">
              {userTyping ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pink-400 animate-pulse" />
                  ユーザーが入力中…
                </span>
              ) : (
                <span className="text-gray-400">オンライン状況：—</span>
              )}
            </div>
            <div className="text-[11px] text-gray-400">
              {loadingMessages ? "読み込み中…" : `${messages.length} 件`}
            </div>
          </div>

          {/* messages */}
          <div className="h-[68vh] md:h-[72vh] overflow-y-auto px-3 md:px-4 py-4 space-y-3">
            {loadingMessages ? (
              <div className="text-center text-xs text-gray-300">読み込み中…</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-xs text-gray-300">
                まだメッセージがありません
              </div>
            ) : (
              (() => {
                let lastDateKey = "";
                return messages.map((m) => {
                  const isMine = m.from === "admin";
                  const dateKey = getDateKey(m.createdAt);

                  const showDate = dateKey && dateKey !== lastDateKey;
                  if (showDate) lastDateKey = dateKey;

                  return (
                    <div key={m.id} className="space-y-2">
                      {showDate && m.createdAt && (
                        <div className="flex justify-center">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200">
                            {getDateLabel(m.createdAt)}
                          </span>
                        </div>
                      )}

                      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`relative max-w-[78%] rounded-2xl px-3 py-2 text-xs md:text-[13px] leading-relaxed shadow-sm ${
                            isMine
                              ? "bg-[#6366f1] text-white rounded-br-sm"
                              : "bg-[#15101f] text-gray-100 rounded-bl-sm border border-white/10"
                          }`}
                        >
                          {/* 削除ボタン（admin 自分の送信だけ） */}
                          {isMine && !m.isDeleted && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m)}
                              className="absolute -top-2 -right-2 rounded-full bg-black/70 border border-white/30 px-1.5 py-0.5 text-[9px] text-gray-200 hover:bg-red-600/80 hover:border-red-400"
                            >
                              削除
                            </button>
                          )}

                          {/* 画像 */}
                          {m.imageUrl && (
                            <div className="mb-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.imageUrl}
                                alt="送信画像"
                                className="max-h-64 rounded-lg border border-white/15 cursor-pointer"
                                onClick={() => setSelectedImageUrl(m.imageUrl!)}
                              />
                            </div>
                          )}

                          {/* テキスト */}
                          {m.text && (
                            <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          )}

                          {/* 時刻＋既読表示 */}
                          <div className="mt-1 flex items-center justify-between gap-2 text-[9px]">
                            <span className={isMine ? "text-indigo-100/80" : "text-gray-400"}>
                              {formatTime(m.createdAt)}
                              {m.isEdited && "（編集済み）"}
                            </span>

                            {isMine && (
                              <span className="text-[9px] text-indigo-100/80">
                                {m.readByUser ? "既読" : "未読"}
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

          {/* input */}
          <form
            onSubmit={handleSend}
            className="border-t border-white/10 px-3 py-3 md:px-4 md:py-3 flex flex-col gap-2"
          >
            {error && (
              <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/40 px-2 py-1 rounded-lg">
                {error}
              </p>
            )}

            {/* クイック返信 */}
            {quickReplies.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1 text-[11px] rounded-full border ${
                        activeCategory === cat
                          ? "bg-pink-500/20 border-pink-300/50 text-pink-100"
                          : "bg-white/5 border-white/10 text-gray-200 hover:bg-white/10"
                      }`}
                    >
                      {cat === "all" ? "すべて" : cat}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {filteredQuickReplies.map((qr) => (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => applyQuickReply(qr.text)}
                      className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-100 hover:bg-white/10"
                      title={qr.text}
                    >
                      {qr.text.length > 22 ? qr.text.slice(0, 22) + "…" : qr.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end justify-between gap-3">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => onChangeInput(e.target.value)}
                  placeholder="メッセージを入力…"
                  rows={2}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-400 outline-none focus:border-pink-300/50 focus:ring-2 focus:ring-pink-500/20"
                />

                <div className="mt-2 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-200">
                    <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 hover:bg-white/10 transition">
                      画像を選択
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </label>

                  {uploadingImage && (
                    <span className="text-[11px] text-pink-200">
                      画像をアップロード中…
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center justify-center rounded-full bg-[#ff2f92] px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(236,72,153,0.7)] hover:bg-[#ff4a9f] disabled:opacity-50 disabled:shadow-none transition"
              >
                {sending ? "送信中…" : "送信"}
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* 画像モーダル */}
      {selectedImageUrl && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedImageUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImageUrl}
            alt="拡大画像"
            className="max-h-[80vh] max-w-[90vw] rounded-xl border border-white/20"
          />
        </div>
      )}
    </div>
  );
}