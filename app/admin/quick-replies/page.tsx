// app/admin/quick-replies/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { NightNaviBg } from "@/components/NightNaviBg";

type QuickReply = {
  id: string;
  category: string;
  text: string;
  order: number;
};

const DEFAULT_WELCOME = `はじめまして！夜ナビ運営です✨
ここから条件相談〜面接調整までぜんぶサポートします！

まずは下の3つだけ教えてください👇
①希望エリア
②希望業種（キャバ/ガルバ/ラウンジ など）
③希望時給（目安でOK）`;

export default function AdminQuickRepliesPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const db = useMemo(() => getDbClient(), []);

  // quickReplies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [order, setOrder] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  // welcome message (settings/welcomeMessage)
  const [welcomeText, setWelcomeText] = useState(DEFAULT_WELCOME);
  const [welcomeLoading, setWelcomeLoading] = useState(true);
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeSavedAt, setWelcomeSavedAt] = useState<string>("");

  // Adminチェック
  useEffect(() => {
    if (loading) return;
    if (!user || userData?.role !== "admin") {
      router.replace("/login");
    }
  }, [user, userData, loading, router]);

  // QuickReplies 購読
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
        setError("読み込みに失敗しました");
      }
    );

    return () => unsub();
  }, [user, userData?.role, db]);

  // Welcome message 読み込み（無ければ初期作成）
    useEffect(() => {
    if (!user || userData?.role !== "admin") return;
    if (!db) return;

    const ref = doc(db, "settings", "welcomeMessage");
    (async () => {
      try {
        setWelcomeLoading(true);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            text: DEFAULT_WELCOME,
            updatedAt: serverTimestamp(),
          });
          setWelcomeText(DEFAULT_WELCOME);
          setWelcomeSavedAt("");
          return;
        }

        const data = snap.data() as any;
        setWelcomeText((data?.text ?? DEFAULT_WELCOME) as string);

        const updatedAt = data?.updatedAt?.toDate ? data.updatedAt.toDate() : null;
        if (updatedAt) {
          setWelcomeSavedAt(
            updatedAt.toLocaleString("ja-JP", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          );
        } else {
          setWelcomeSavedAt("");
        }
      } catch (e) {
        console.error(e);
        setWelcomeText(DEFAULT_WELCOME);
      } finally {
        setWelcomeLoading(false);
      }
    })();
  }, [user, userData?.role, db]);

  const categories = useMemo(
    () => ["all", ...new Set(quickReplies.map((q) => q.category))],
    [quickReplies]
  );

  const filtered = useMemo(() => {
    return selectedCategory === "all"
      ? quickReplies
      : quickReplies.filter((q) => q.category === selectedCategory);
  }, [quickReplies, selectedCategory]);

  // テンプレ追加
    const handleAdd = async () => {
    if (!db) return;

    if (!category.trim() || !text.trim()) {
      setError("カテゴリとテキストは必須です");
      return;
    }
    setError(null);

    try {
      await addDoc(collection(db, "quickReplies"), {
        category: category.trim(),
        text: text.trim(),
        order: Number.isFinite(order) ? order : 1,
      });

      setText("");
      setOrder(1);
    } catch (e) {
      console.error(e);
      setError("追加に失敗しました");
    }
  };

  // 削除
    const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm("このテンプレを削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "quickReplies", id));
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    }
  };

  // order更新
    const updateOrder = async (id: string, newOrder: number) => {
    if (!db) return;

    try {
      const ref = doc(db, "quickReplies", id);
      await updateDoc(ref, { order: newOrder });
    } catch (e) {
      console.error(e);
      alert("並び順の更新に失敗しました");
    }
  };

  // welcome 保存
    const handleSaveWelcome = async () => {
    if (!db) return;

    try {
      setWelcomeSaving(true);
      const ref = doc(db, "settings", "welcomeMessage");
      await setDoc(
        ref,
        { text: welcomeText, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
      alert("ウェルカムメッセージの保存に失敗しました");
    } finally {
      setWelcomeSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-white">
      <NightNaviBg variant="default" />

      <div className="mx-auto w-full max-w-4xl flex flex-col gap-6">
        {/* ヘッダー */}
        <header>
          <p className="text-[11px] text-pink-200 mb-1">ADMIN / QUICK REPLIES</p>
          <h1 className="text-xl md:text-2xl font-bold">クイック返信 管理</h1>
          <p className="mt-1 text-xs text-gray-400">
            チャット画面に表示される定型文＆初回ウェルカム文をここで管理できます。
          </p>
        </header>

        {/* ウェルカムメッセージ */}
        <section className="rounded-2xl border border-white/10 bg-[#08030f]/95 p-4 shadow-lg">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">初回ウェルカムメッセージ</h2>
              <p className="text-xs text-gray-400 mt-1">
                ユーザーが初めてチャットを開いた時に、自動送信される運営メッセージです。
                {welcomeSavedAt ? `（最終更新: ${welcomeSavedAt}）` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={welcomeLoading || welcomeSaving}
              onClick={handleSaveWelcome}
              className="inline-flex items-center justify-center rounded-full bg-[#ff2f92] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(236,72,153,0.7)] hover:bg-[#ff4a9f] disabled:opacity-50 disabled:shadow-none transition"
            >
              {welcomeSaving ? "保存中…" : "保存"}
            </button>
          </div>

          <textarea
            value={welcomeText}
            onChange={(e) => setWelcomeText(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-2xl bg-[#050008] border border-white/15 px-3 py-2 text-sm outline-none focus:border-pink-400 whitespace-pre-wrap"
            placeholder="初回ウェルカムメッセージを入力…"
            disabled={welcomeLoading}
          />
          <div className="mt-2 text-[11px] text-gray-400">
            ※改行OK（そのまま送信されます）
          </div>
        </section>

        {/* 追加フォーム */}
        <section className="rounded-2xl border border-white/10 bg-[#08030f]/95 p-4 shadow-lg">
          <h2 className="text-lg font-semibold mb-3">テンプレを追加</h2>

          {error && (
            <p className="mb-3 text-[11px] text-red-300 bg-red-500/10 border border-red-500/40 px-2 py-1 rounded-lg">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <p className="text-[11px] text-gray-400 mb-1">カテゴリ</p>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl bg-[#050008] border border-white/15 px-3 py-2 text-sm outline-none focus:border-pink-400"
                placeholder="例）未経験 / 写真お願い / 面接"
              />
            </div>

            <div className="md:col-span-1">
              <p className="text-[11px] text-gray-400 mb-1">並び順</p>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                className="w-full rounded-xl bg-[#050008] border border-white/15 px-3 py-2 text-sm outline-none focus:border-pink-400"
              />
            </div>

            <div className="md:col-span-3">
              <p className="text-[11px] text-gray-400 mb-1">テキスト</p>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full rounded-xl bg-[#050008] border border-white/15 px-3 py-2 text-sm outline-none focus:border-pink-400"
                placeholder="例）お写真をお願いできますか？"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white border border-white/20 hover:border-pink-300/60 hover:text-pink-100 transition"
            >
              追加
            </button>
          </div>
        </section>

        {/* 一覧 */}
        <section className="rounded-2xl border border-white/10 bg-[#08030f]/95 p-4 shadow-lg">
          <div className="flex items-end justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold">テンプレ一覧</h2>
              <p className="text-xs text-gray-400 mt-1">
                カテゴリ別にフィルタして、並び順を調整できます。
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-[11px] rounded-full border ${
                    selectedCategory === cat
                      ? "bg-pink-600 text-white border-pink-400"
                      : "bg-white/5 text-gray-300 border-white/20 hover:border-pink-300/60 hover:text-pink-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/10">
            {filtered.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                テンプレがありません
              </p>
            ) : (
              filtered.map((q) => (
                <div key={q.id} className="py-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-white/20 bg-black/40 text-gray-200">
                        {q.category}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        order:
                        <input
                          type="number"
                          defaultValue={q.order}
                          onBlur={(e) =>
                            updateOrder(q.id, Number(e.target.value))
                          }
                          className="ml-2 w-20 rounded-lg bg-[#050008] border border-white/15 px-2 py-1 text-[11px] outline-none focus:border-pink-400"
                        />
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="text-[11px] px-3 py-1 rounded-full border border-white/20 bg-white/5 text-gray-200 hover:bg-red-600/20 hover:border-red-400/60 transition"
                    >
                      削除
                    </button>
                  </div>

                  <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">
                    {q.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
