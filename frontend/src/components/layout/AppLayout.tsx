import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatRole } from '../../lib/format';

function SolarisSunMark() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient
          id="solarisSunGrad"
          x1="8"
          y1="8"
          x2="56"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="55%" stopColor="#E66A14" />
          <stop offset="100%" stopColor="#C4410C" />
        </linearGradient>
      </defs>
      {Array.from({ length: 12 }).map((_, i) => (
        <path
          key={i}
          d="M32 3 C34.5 10, 31 14, 32 19 C29.5 14, 28 10, 32 3 Z"
          fill="url(#solarisSunGrad)"
          transform={`rotate(${i * 30} 32 32)`}
        />
      ))}
      <circle
        cx="32"
        cy="32"
        r="13"
        stroke="url(#solarisSunGrad)"
        strokeWidth="2.4"
        fill="#FFFCF7"
      />
      <circle
        cx="32"
        cy="32"
        r="9.5"
        stroke="#E59A18"
        strokeWidth="1.2"
        fill="#FBF4E5"
      />
    </svg>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const unreadCount = user?.unread_notifications ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      {/* Header atas penuh Amber Tint — FSD Gambar 3.2 s.d. 3.24 */}
      <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-amber-tint px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-semibold text-ink hover:bg-pale-gold lg:hidden"
            aria-label="Buka menu"
          >
            ☰
          </button>

          <Link to="/beranda" className="flex items-center gap-2.5">
            <SolarisSunMark />
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-wide text-ink sm:text-[15px]">
                SOLARIS ETERNAL APPARELS
              </p>
              <p className="hidden text-[11px] font-medium text-ink-muted sm:block">
                Sistem Informasi Pengendalian Order &amp; Produksi
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* Ikon lonceng notifikasi (SCR-02 ⑤) */}
          <span
            aria-label={
              unreadCount > 0
                ? `Notifikasi (${unreadCount} belum dibaca)`
                : 'Notifikasi'
            }
            className="relative rounded-full p-2 text-ink"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2a7 7 0 0 0-7 7v3.586l-1.707 1.707A1 1 0 0 0 4 16h16a1 1 0 0 0 .707-1.707L19 12.586V9a7 7 0 0 0-7-7zm0 20a3 3 0 0 0 2.995-2.824L15 19h-6a3 3 0 0 0 2.824 2.995L12 22z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </span>

          {/* Nama dan peran pengguna (SCR-02 ②) */}
          {user && (
            <span className="hidden text-[13px] font-semibold text-ink sm:inline">
              {user.full_name} ({formatRole(user.role_code)})
            </span>
          )}

          {/* Tombol Keluar (SCR-02 ④) */}
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
            className="cursor-pointer rounded-full border border-ink bg-transparent px-4 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-pale-gold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut ? 'Keluar...' : 'Keluar'}
          </button>
        </div>
      </header>

      {/* Body: Sidebar Hangat + Konten Utama */}
      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <div
            className="no-print fixed inset-0 z-30 bg-ink/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar dinamis dari user.menus — FSD Gambar 3.0 (#F7F3EA) */}
        <aside
          className={[
            'no-print fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col border-r border-line bg-sidebar text-sidebar-ink transition-transform lg:sticky lg:top-16 lg:z-20 lg:h-[calc(100vh-4rem)] lg:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="flex items-center justify-between px-4 pt-5 pb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sidebar-muted">
              MENU
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-ink lg:hidden"
              aria-label="Tutup menu"
            >
              ✕
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 pb-6">
            {(user?.menus ?? []).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center rounded-lg px-3.5 py-2.5 text-[13.5px] transition-colors',
                    isActive
                      ? 'bg-sidebar-active font-bold text-ink shadow-[inset_3px_0_0_0_var(--color-brand)]'
                      : 'font-medium text-sidebar-ink hover:bg-sidebar-hover',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {user && (
            <div className="border-t border-line px-4 py-3 text-xs text-sidebar-muted sm:hidden">
              <p className="truncate font-semibold text-ink">
                {user.full_name}
              </p>
              <p className="truncate">{formatRole(user.role_code)}</p>
            </div>
          )}
        </aside>

        {/* Area Konten Utama */}
        <main className="min-w-0 flex-1 bg-canvas p-5 sm:p-7">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
