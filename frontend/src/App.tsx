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
          {/* Publik */}
          <Route
            path="/login"
            element={
              <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
                <div className="w-full max-w-md">
                  <PlaceholderPage
                    title="Masuk"
                    code="SCR-01"
                    subtitle="Gunakan akun yang diberikan Administrator Sistem"
                  />
                </div>
              </div>
            }
          />

          {/* Seluruh halaman terautentikasi memakai AppLayout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Milik A — Semua role */}
              <Route
                path="/beranda"
                element={
                  <PlaceholderPage
                    title="Beranda"
                    code="SCR-02"
                    subtitle="Menu dan ringkasan sesuai peran"
                  />
                }
              />

              {/* Milik A — Khusus ADMIN */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                <Route
                  path="/pengguna"
                  element={
                    <PlaceholderPage
                      title="Manajemen Pengguna"
                      code="SCR-03"
                      subtitle="Akun, kunci akun, dan permintaan reset password"
                    />
                  }
                />
                <Route
                  path="/log-aktivitas"
                  element={
                    <PlaceholderPage
                      title="Log Aktivitas"
                      code="SCR-23"
                      subtitle="Hanya dapat dibaca; log tidak dapat diubah atau dihapus"
                    />
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
                    <PlaceholderPage
                      title="Supplier"
                      code="SCR-09"
                      subtitle="Data supplier dan bahan yang dipasok"
                    />
                  }
                />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['PPIC']} />}>
                <Route
                  path="/bahan-baku"
                  element={
                    <PlaceholderPage
                      title="Bahan Baku"
                      code="SCR-10"
                      subtitle="Bahan yang dicatat sudah diperiksa dan dinyatakan layak"
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
                      subtitle="Satu SPK untuk satu style"
                    />
                  }
                />
                <Route
                  path="/progres"
                  element={
                    <PlaceholderPage
                      title="Progres Harian"
                      code="SCR-12"
                      subtitle="Formulir yang sama untuk seluruh tahap"
                    />
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
                  element={
                    <PlaceholderPage
                      title="Hasil QC"
                      code="SCR-13"
                      subtitle="QC hanya mencatat jumlah barang yang lolos"
                    />
                  }
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
