// app/admin/chats/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDbClient } from "@/lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";

type ChatRoomRow = {
  id: string;
  userId: string;
  lastMessage: string;
  updatedAt: string;
  unreadCount: number;
  nickname: string;
  photoURL: string | null;
  role: "pending" | "user" | "rejected" | "admin";
  lastSender?: "user" | "admin";
};

function truncate(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default function AdminChatsPage() {
  const [rooms, setRooms] = useState<ChatRoomRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const load = async () => {
    const db = getDbClient();
    if (!db) {
      // ブラウザじゃない/初期化されてない時は何もしない（保険）
      setLoading(false);
      return;
    }

    try {
      const qRooms = query(
        collection(db, "chatRooms"),
        orderBy("updatedAt", "desc")
      );
      const snap = await getDocs(qRooms);

      const result: ChatRoomRow[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        const roomId = docSnap.id;
        const userId = data.userId ?? "";

        const unreadCount =
          typeof data.unreadCountForAdmin === "number"
            ? data.unreadCountForAdmin
            : 0;

        let nickname = "";
        let photoURL: string | null = null;

        // 🔥 users.role を取得
        let role: ChatRoomRow["role"] = "user";
        if (userId) {
          const userSnap = await getDoc(doc(db, "users", userId));
          if (userSnap.exists()) {
            role = (userSnap.data() as any).role ?? "user";
          }
        }

        // プロフィール（表示用）
        if (userId) {
          const profileRef = doc(db, "profiles", userId);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            const p = profileSnap.data() as any;
            nickname = p.nickname || p.displayName || "(未設定)";
            photoURL =
              p.photoURL ||
              (Array.isArray(p.photoURLs) ? p.photoURLs[0] : null) ||
              null;
          }
        }

        const updatedAt: Timestamp | undefined = data.updatedAt;

        result.push({
          id: roomId,
          userId,
          nickname,
          photoURL,
          unreadCount,
          lastMessage: data.lastMessage ?? "",
          updatedAt: updatedAt ? updatedAt.toDate().toLocaleString() : "",
          role,
          lastSender: data.lastSender ?? "admin",
        });
      }

      setRooms(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  load();
}, []);

  return (
    <div className="relative min-h-[calc(100vh-48px)] px-4 md:px-6 py-6 text-white overflow-hidden">
      {/* 背景 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050007]" />
        <div className="pointer-events-none absolute -left-24 -top-12 h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.18),_transparent_70%)] blur-[70px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.14),_transparent_70%)] blur-[90px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] tracking-[0.25em] text-pink-300/80">
            CHAT LIST
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold">
            ユーザーとのチャット一覧
          </h2>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-8 text-sm text-gray-300">
            読み込み中です…
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((r) => {
              const hasUnread = r.unreadCount > 0;
              const isPending = r.role === "pending";
              const needsReply = r.lastSender === "user" && hasUnread;

              return (
                <Link
                  key={r.id}
                  href={`/admin/chats/${r.id}`}
                  className={`
                    group block rounded-2xl px-4 py-4 transition 
                    border bg-white/5 hover:bg-white/10
                    ${
                      needsReply
                        ? "border-pink-500/80 shadow-[0_0_18px_rgba(236,72,153,0.55)]"
                        : isPending
                        ? "border-pink-500/40"
                        : "border-white/10"
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* アイコン */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/20 flex items-center justify-center">
                      {r.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.photoURL}
                          className="object-cover w-full h-full"
                          alt="icon"
                        />
                      ) : (
                        <span className="text-gray-400 text-sm">
                          {r.nickname?.[0] ?? "？"}
                        </span>
                      )}
                    </div>

                    {/* メイン */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold">
                          {r.nickname || "（未設定）"}
                        </p>

                        {isPending && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-600 text-white font-semibold">
                            審査中
                          </span>
                        )}

                        {needsReply && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500 text-white font-semibold">
                            要対応
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-200">
                        {truncate(r.lastMessage, 40) || "（メッセージなし）"}
                      </p>

                      <p className="text-[11px] text-gray-400">
                        最終更新 {r.updatedAt || "-"}
                      </p>
                    </div>

                    {/* 右側 */}
                    <div className="flex flex-col items-end gap-2">
                      {hasUnread ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-pink-500 px-2 py-1 text-[11px] font-semibold text-white">
                          未読 {r.unreadCount > 9 ? "9+" : r.unreadCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center rounded-full bg-white/10 px-2 py-1 text-[11px] text-gray-300">
                          既読
                        </span>
                      )}

                      <span className="text-[11px] text-pink-300 opacity-0 group-hover:opacity-100 transition">
                        トークを見る →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
