// app/admin/layout.tsx
"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { db } from "@/lib/firebase";
import Link from "next/link";
import {
  collectionGroup,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { NightNaviBg } from "@/components/NightNaviBg";

type NavItem = {
  href: string;
  label: string;
  badge?: number;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/** ✅ 未読総数を admin 配下に配る Context */
type AdminUnreadContextValue = {
  unreadTotal: number;
};

const AdminUnreadContext = createContext<AdminUnreadContextValue>({
  unreadTotal: 0,
});

export function useAdminUnread() {
  return useContext(AdminUnreadContext);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [unreadTotal, setUnreadTotal] = useState(0);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // ログイン確認 + role チェック（現状の実装を維持）:contentReference[oaicite:2]{index=2}
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    const ensureAdmin = async () => {
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as any;
        const role = data?.role ?? "user";

        if (role !== "admin") {
          router.replace("/mypage");
          return;
        }

        setIsAdmin(true);
      } catch (e) {
        console.error(e);
        router.replace("/mypage");
        return;
      } finally {
        setCheckingRole(false);
      }
    };

    ensureAdmin();
  }, [user, loading, router]);

  // ✅ 未読総数はここだけでリアルタイム監視（admin 確定後だけ）
  // 既存は from==user を購読して JS 側で readByAdmin を数えてたので、そのまま “安全側” で維持しつつ
  // 「未読総数の参照先」をここに一本化する。:contentReference[oaicite:3]{index=3}
  useEffect(() => {
    if (!user || !isAdmin) return;

    const q = query(collectionGroup(db, "messages"), where("from", "==", "user"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        let count = 0;
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (!data.readByAdmin) count += 1;
        });
        setUnreadTotal(count);
      },
      (err) => {
        console.error("onSnapshot error in admin layout:", err);
      }
    );

    return () => unsub();
  }, [user, isAdmin]);

  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/admin", label: "ダッシュボード" },
      { href: "/admin/chats", label: "チャット", badge: unreadTotal },
      { href: "/admin/users/pending", label: "承認待ち" },
      { href: "/admin/users", label: "ユーザー一覧" },
      { href: "/admin/quick-replies", label: "定型文" },
    ],
    [unreadTotal]
  );

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (loading || !user || checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050007] text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-gray-200">
          確認中…
        </div>
      </div>
    );
  }

  // 念のため（ここに来るのは稀）
  if (!isAdmin) return null;

  return (
    <AdminUnreadContext.Provider value={{ unreadTotal }}>
      <div className="min-h-screen bg-[#050007] text-white">
        <NightNaviBg variant="admin" />

        {/* ✅ モバイル：メニュー開閉 */}
        <MobileAdminShell
          navItems={navItems}
          pathname={pathname ?? ""}
          unreadTotal={unreadTotal}
          onLogout={handleLogout}
        >
          {children}
        </MobileAdminShell>
      </div>
    </AdminUnreadContext.Provider>
  );
}

/** ✅ 追加：モバイル対応シェル */
function MobileAdminShell({
  children,
  navItems,
  pathname,
  unreadTotal,
  onLogout,
}: {
  children: React.ReactNode;
  navItems: NavItem[];
  pathname: string;
  unreadTotal: number;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* ✅ モバイルトップバー（md未満） */}
      <div className="md:hidden sticky top-0 z-30 w-full border-b border-white/10 bg-[#050007]/70 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10 transition"
          >
            ☰
          </button>

          <Link href="/admin" className="font-semibold text-sm">
            夜ナビ 管理
          </Link>

          <Link
            href="/admin/chats"
            className="text-sm rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10 transition"
          >
            チャット
            {unreadTotal > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-pink-500/20 border border-pink-300/50 px-2 py-[1px] text-[11px] text-pink-100">
                {unreadTotal > 9 ? "9+" : unreadTotal}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ✅ モバイルドロワー */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          {/* overlay */}
          <button
            type="button"
            aria-label="close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          {/* drawer */}
          <div className="absolute left-0 top-0 h-full w-[84%] max-w-[320px] border-r border-white/10 bg-[#050007]/92 backdrop-blur-xl">
            <div className="px-5 pt-6 pb-4 border-b border-white/10">
              <p className="text-[11px] tracking-[0.28em] text-pink-300/80">
                ADMIN
              </p>
              <div className="mt-1 flex items-center justify-between">
                <h1 className="text-base font-semibold">夜ナビ 管理</h1>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"
                >
                  閉じる
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-300">対応を最短で回す用</p>
            </div>

            <nav className="px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cx(
                      "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition",
                      "border border-transparent",
                      active
                        ? "bg-white/10 border-white/10"
                        : "hover:bg-white/5 hover:border-white/10 text-gray-100"
                    )}
                  >
                    <span className="truncate">{item.label}</span>

                    {typeof item.badge === "number" && item.badge > 0 && (
                      <span className="shrink-0 rounded-full bg-pink-500/20 border border-pink-300/50 px-2 py-[2px] text-[11px] text-pink-100">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto px-4 pb-5">
              <button
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 本体：md以上は「サイドバー + メイン」、スマホは「メインだけ」 */}
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* サイドバー（md以上） */}
        <aside className="hidden md:flex w-[260px] flex-col border-r border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <div className="px-5 pt-6 pb-4 border-b border-white/10">
            <p className="text-[11px] tracking-[0.28em] text-pink-300/80">
              ADMIN
            </p>
            <h1 className="mt-1 text-lg font-semibold">夜ナビ 管理</h1>
            <p className="mt-1 text-xs text-gray-300">対応を最短で回す用</p>
          </div>

          <nav className="px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition",
                    "border border-transparent",
                    active
                      ? "bg-white/10 border-white/10"
                      : "hover:bg-white/5 hover:border-white/10 text-gray-100"
                  )}
                >
                  <span className="truncate">{item.label}</span>

                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="shrink-0 rounded-full bg-pink-500/20 border border-pink-300/50 px-2 py-[2px] text-[11px] text-pink-100">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto px-4 pb-5">
            <button
              onClick={onLogout}
              className="w-full rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
            >
              ログアウト
            </button>
          </div>
        </aside>

        {/* ✅ メイン：スマホはトップバー分の余白を確保 */}
        <main className="flex-1 min-w-0 pt-0 md:pt-0">
          <div className="md:hidden h-0" />
          {children}
        </main>
      </div>
    </div>
  );
}
