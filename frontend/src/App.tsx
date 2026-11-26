import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';

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
                  element={
                    <PlaceholderPage
                      title="Data Buyer"
                      code="SCR-04"
                      subtitle="Kode buyer dipakai untuk membentuk kode barang (BBB-JJ-NNNN)"
                    />
                  }
                />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['MARKETING']} />}>
                <Route
                  path="/order/baru"
                  element={
                    <PlaceholderPage
                      title="Order Baru"
                      code="SCR-05"
                      subtitle="Satu order berisi satu atau lebih style"
                    />
                  }
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
                  element={
                    <PlaceholderPage
                      title="Daftar dan Detail Order"
                      code="SCR-06"
                      subtitle="Status dan riwayat setiap order"
                    />
                  }
                />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['PIMPINAN']} />}>
                <Route
                  path="/persetujuan"
                  element={
                    <PlaceholderPage
                      title="Persetujuan"
                      code="SCR-08"
                      subtitle="Hanya Pimpinan yang dapat menyetujui atau menolak"
                    />
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <PlaceholderPage
                      title="Dashboard"
                      code="SCR-14"
                      subtitle="Data diperbarui ≤ 1 menit setelah progres/QC disimpan"
                    />
                  }
                />
              </Route>

              <Route
                element={
                  <ProtectedRoute allowedRoles={['PPIC', 'PIMPINAN']} />
                }
              >
                <Route
                  path="/pengiriman"
                  element={
                    <PlaceholderPage
                      title="Pengiriman"
                      code="SCR-16"
                      subtitle="Satu surat jalan dapat memuat beberapa style dari order yang sama"
                    />
                  }
                />
                <Route
                  path="/pengiriman/:id/surat-jalan"
                  element={
                    <PlaceholderPage
                      title="Surat Jalan"
                      code="SCR-17"
                      subtitle="Surat jalan siap cetak tanpa harga"
                    />
                  }
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
