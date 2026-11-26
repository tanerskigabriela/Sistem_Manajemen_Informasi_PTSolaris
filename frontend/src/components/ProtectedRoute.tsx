import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { RoleCode } from '../types/api.ts';

interface ProtectedRouteProps {
  allowedRoles?: RoleCode[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted">
        Memuat sesi pengguna...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user.role_code)
  ) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md rounded-xl border border-line bg-surface p-6 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-danger">
            ERR-AUTH-03
          </p>
          <h1 className="mt-1 text-lg font-semibold text-ink">
            Akses Ditolak
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Anda tidak memiliki akses ke halaman ini.
          </p>
          <a
            href="/beranda"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-medium text-surface hover:bg-brand-hover"
          >
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}