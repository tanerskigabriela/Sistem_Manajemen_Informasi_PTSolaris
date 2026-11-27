import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import BerandaPage from './pages/admin/BerandaPage';
import LoginPage from './pages/admin/LoginPage';
import BuyerPage from './pages/order/BuyerPage';
import DashboardPage from './pages/order/DashboardPage';
import DeliveryNotePage from './pages/order/DeliveryNotePage';
import OrderDetailPage from './pages/order/OrderDetailPage';
import OrderListPage from './pages/order/OrderListPage';
import OrderNewPage from './pages/order/OrderNewPage';
import ShipmentPage from './pages/order/ShipmentPage';
import UsersPage from './pages/admin/UsersPage';
import ActivityLogsPage from './pages/admin/ActivityLogsPage';
import BahanBakuPage from './pages/produksi/BahanBakuPage';
import ProgresPage from './pages/produksi/ProgresPage';
import QcPage from './pages/produksi/QcPage';
import SpkPage from './pages/produksi/SpkPage';
import { PersetujuanPage } from './pages/produksi/SpkApprovalTab';
import SupplierPage from './pages/produksi/SupplierPage';

function PlaceholderPage({
  title,
  code,
  subtitle,
}: {
  title: string;
  code: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-ink sm:text-[32px]">
          {title}
        </h1>
        <p className="mt-1 text-[13px] font-medium text-ink-muted">
          {[code, subtitle].filter(Boolean).join(' · ')}
        </p>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <p className="text-sm text-ink-muted">
          Halaman ini sedang disiapkan oleh pemilik modul.
        </p>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Publik — SCR-01 */}
          <Route path="/login" element={<LoginPage />} />

          {/* Seluruh halaman terautentikasi memakai AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Milik A — Semua role (SCR-02) */}
              <Route path="/beranda" element={<BerandaPage />} />

              {/* Milik A — Khusus ADMIN */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route path="/pengguna" element={<UsersPage />} />
                <Route path="/log-aktivitas" element={<ActivityLogsPage />} />
              </Route>

              {/* Milik B — Order & Pengiriman */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['MARKETING', 'PIMPINAN']} />
                }
              >
                <Route path="/buyer" element={<BuyerPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['MARKETING']} />}>
                <Route path="/order/baru" element={<OrderNewPage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={['MARKETING', 'PIMPINAN', 'PPIC', 'SPV', 'QC']}
                  />
                }
              >
                <Route path="/order" element={<OrderListPage />} />
                <Route path="/order/:id" element={<OrderDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['PIMPINAN']} />}>
                <Route path="/persetujuan" element={<PersetujuanPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={['PPIC', 'PIMPINAN']} />
                }
              >
                <Route path="/pengiriman" element={<ShipmentPage />} />
                <Route
                  path="/pengiriman/:id/surat-jalan"
                  element={<DeliveryNotePage />}
                />
              </Route>

              {/* Milik C — Produksi */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['PPIC', 'PIMPINAN']} />
                }
              >
                <Route
                  path="/supplier"
                  element={<SupplierPage />}
                />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['PPIC']} />}>
                <Route
                  path="/bahan-baku"
                  element={<BahanBakuPage />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={['PPIC', 'PIMPINAN', 'SPV', 'QC']}
                  />
                }
              >
                <Route
                  path="/spk"
                  element={<SpkPage />}
                />
                <Route
                  path="/progres"
                  element={<ProgresPage />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={['QC', 'PPIC', 'PIMPINAN']} />
                }
              >
                <Route
                  path="/qc"
                  element={<QcPage />}
                />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="/" element={<Navigate to="/beranda" replace />} />
          <Route path="*" element={<Navigate to="/beranda" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}