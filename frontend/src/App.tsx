import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import ApprovalPage from './pages/order/ApprovalPage';
import BuyerPage from './pages/order/BuyerPage';
import DashboardPage from './pages/order/DashboardPage';
import DeliveryNotePage from './pages/order/DeliveryNotePage';
import OrderDetailPage from './pages/order/OrderDetailPage';
import OrderListPage from './pages/order/OrderListPage';
import OrderNewPage from './pages/order/OrderNewPage';
import ShipmentPage from './pages/order/ShipmentPage';

function PlaceholderPage({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        {code}
      </p>
      <h1 className="mt-1 text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Halaman ini sedang disiapkan oleh pemilik modul.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Publik */}
          <Route
            path="/login"
            element={
              <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
                <PlaceholderPage title="Login (SCR-01)" code="SCR-01" />
              </div>
            }
          />

          {/* Seluruh halaman terautentikasi memakai AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Milik A — Semua role */}
              <Route
                path="/beranda"
                element={<PlaceholderPage title="Beranda" code="SCR-02" />}
              />

              {/* Milik A — Khusus ADMIN */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route
                  path="/pengguna"
                  element={
                    <PlaceholderPage title="Manajemen Pengguna" code="SCR-03" />
                  }
                />
                <Route
                  path="/log-aktivitas"
                  element={
                    <PlaceholderPage title="Log Aktivitas" code="SCR-23" />
                  }
                />
              </Route>

              {/* Milik B — Order & Pengiriman */}
              <Route
                element={
                  <ProtectedRoute allowedRoles={['MARKETING', 'PIMPINAN']} />
                }
              >
                <Route
                  path="/buyer"
                  element={<BuyerPage />}
                />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['MARKETING']} />}>
                <Route
                  path="/order/baru"
                  element={<OrderNewPage />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute
                    allowedRoles={['MARKETING', 'PIMPINAN', 'PPIC', 'SPV', 'QC']}
                  />
                }
              >
                <Route
                  path="/order"
                  element={<OrderListPage />}
                />
                <Route path="/order/:id" element={<OrderDetailPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['PIMPINAN']} />}>
                <Route
                  path="/persetujuan"
                  element={<ApprovalPage />}
                />
                <Route
                  path="/dashboard"
                  element={<DashboardPage />}
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={['PPIC', 'PIMPINAN']} />
                }
              >
                <Route
                  path="/pengiriman"
                  element={<ShipmentPage />}
                />
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
                  element={
                    <PlaceholderPage title="Data Supplier" code="SCR-09" />
                  }
                />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['PPIC']} />}>
                <Route
                  path="/bahan-baku"
                  element={
                    <PlaceholderPage
                      title="Bahan Baku per Style"
                      code="SCR-10"
                    />
                  }
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
                  element={
                    <PlaceholderPage
                      title="Surat Perintah Kerja (SPK)"
                      code="SCR-11"
                    />
                  }
                />
                <Route
                  path="/progres"
                  element={
                    <PlaceholderPage title="Progres Harian" code="SCR-12" />
                  }
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={['QC', 'PPIC', 'PIMPINAN']} />
                }
              >
                <Route
                  path="/qc"
                  element={<PlaceholderPage title="Hasil QC" code="SCR-13" />}
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