import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatRole } from '../../lib/format';
import { Badge, Button } from '../ui';

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

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-sidebar/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar dinamis dari user.menus */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-ink transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-hover px-5">
          <div>
            <p className="text-base font-bold tracking-tight text-surface">
              Project Solaris
            </p>
            <p className="text-xs text-sidebar-muted">PT Solaris Garment</p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-surface lg:hidden"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {(user?.menus ?? []).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-active text-surface'
                    : 'text-sidebar-ink hover:bg-sidebar-hover',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-hover px-4 py-3 text-xs text-sidebar-muted">
          <p className="truncate font-medium text-sidebar-ink">
            {user?.full_name ?? '-'}
          </p>
          <p className="truncate">{user?.username ?? '-'}</p>
        </div>
      </aside>

      {/* Area Konten Utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-line px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted lg:hidden"
              aria-label="Buka menu"
            >
              ☰ Menu
            </button>
            <span className="text-sm font-semibold text-ink">
              Sistem Manajemen Produksi Garment
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink leading-tight">
                {user?.full_name}
              </p>
              <p className="text-xs text-ink-muted">{user?.username}</p>
            </div>
            {user && (
              <Badge tone="brand">{formatRole(user.role_code)}</Badge>
            )}
            <Button
              size="sm"
              variant="secondary"
              loading={loggingOut}
              onClick={() => void handleLogout()}
            >
              Keluar
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}