# Rencana Tahap 2 — Backend dan Frontend (Project Solaris)

Disusun 20/11/2026. Usulan untuk dibahas kelompok. Tidak mengubah KONTRAK.md.

**Jadwal:** sisa **5 hari, Sabtu 21/11 sampai Rabu 25/11/2026**, sesuai kesepakatan kelompok. Karena waktunya pendek, hanya **fitur Wajib RSI** yang dikerjakan di tahap ini (Bagian 3). Fitur Kalau sempat/Terakhir, halaman SMBD, revisi mockup, dan revisi dokumen dikerjakan setelahnya.

---

## 1. Acuan yang dipakai

| Untuk | Baca |
|---|---|
| Tabel, kolom, status, role, objek database, endpoint, halaman | `KONTRAK.md` (v2) |
| Format response API, kode HTTP, kode error, login dan sesi, struktur folder backend, pola `withTransaction` + `logActivity`, aturan halaman frontend, aturan Git | `docs/KONTRAK-v1.md` (arsip v1; bagian yang ditulis "sama dengan v1" di KONTRAK.md) |
| Isi request/response tiap endpoint, validasi field, pesan error | FSD dan TSD (nama tabel/kolom ikut v2) |
| Urutan kerja dan prioritas | File ini |

Bila v1 dan v2 berbeda, **v2 yang berlaku**.

---

## 2. Pembagian tugas (dari KONTRAK v2 Bagian 2, 14, 15)

### A — Fondasi dan Admin

| Lapisan | Pekerjaan |
|---|---|
| Fondasi backend (dipakai semua) | Kerangka Express + TypeScript dari praktikum; `db/pool.ts` dengan **satu** `getPool()` memakai login `app_rsi` (lihat keputusan No. 2); skema Drizzle `app`; `constants.ts`; `utils/response.ts` (`sendSuccess`), `utils/errors.ts` (`AppError`), `utils/transaction.ts` (`withTransaction`), `utils/activity-log.ts` (`logActivity`); middleware `authenticate`, `authorize`, `validate`, error handler; `routes/index.ts`; **contoh OOP** (`BaseRepository<T>`, `AppError extends Error`) |
| Modul backend | auth (login, logout, me, ganti password), users, sessions, password-reset-requests, activity-logs, notifications. Catatan: `/auth/me` mengambil `full_name` lewat join `users → employees` (kolom `users.full_name` tidak ada di v2); `constants.ts` mengikuti nilai status v2 (termasuk SUPERADMIN, status pengiriman, invoice, pembayaran, pembatalan), jangan disalin dari v1 |
| Fondasi frontend (dipakai semua) | Vite + React + TS + Tailwind 4 (`@theme`), `lib/http.ts`, `AuthContext`, `ProtectedRoute`, layout (header, sidebar dari `menus`), komponen bersama: Button, Badge, Table, Input, Modal, Alert; `lib/format.ts`, `lib/validation.ts` |
| Halaman RSI | SCR-01 Login, SCR-02 Beranda, SCR-03 Pengguna (pilih karyawan), SCR-19 s.d. SCR-24 |
| SMBD | Penampil tabel umum `/smbd/data`, SDM dan penggajian, jurnal |

### B — Order dan Pengiriman

| Lapisan | Pekerjaan |
|---|---|
| Modul backend | **countries (GET /countries, untuk dropdown negara di form buyer dan supplier)**, buyers, product-types, items, order-levels, orders (buat, setujui, tolak, tarik, batal + preview denda), price-history, dashboard, reports, expeditions, shipments + surat jalan |
| Halaman RSI | SCR-04 Buyer, SCR-05 Order Baru (diskon, level order), SCR-06 Daftar/Detail Order, SCR-07 Riwayat Harga, SCR-08 Persetujuan (bagian order), SCR-14 Dashboard, SCR-15 Rekap, SCR-16 Pengiriman (ekspedisi dari daftar), SCR-17 Surat Jalan, SCR-18 Riwayat Pengiriman |
| SMBD | Master order (level order, kebijakan pembatalan, ekspedisi), invoice dan pembayaran |

### C — Produksi

| Lapisan | Pekerjaan |
|---|---|
| Modul backend | suppliers, raw-materials, order-details/{id}/materials (+ material-requirement), production-lines, spk (ajukan, setujui, tolak), progress, qc-standards, defect-types, qc-results, material-usages |
| Halaman RSI | SCR-09 Supplier, SCR-10 Bahan Baku (pilih dari master, kebutuhan BOM), SCR-11 SPK (pilih lini), SCR-08 Persetujuan (bagian SPK, koordinasi dengan B), SCR-12 Progres, SCR-13 Hasil QC (standar, sampel, jenis cacat), SCR-26 Pemakaian Bahan (prioritas T) |
| SMBD | Master produksi (lini, standar QC, jenis cacat, bahan, BOM), PO/penerimaan/stok, aset dan maintenance |

---

## 3. Jadwal 5 hari (hanya fitur Wajib RSI)

Prinsip: **RSI fitur Wajib dulu.** Selama login A belum masuk (Hari 1), kolom `*_by` diisi sementara dengan `id` karyawan seed (B: "Staf Marketing"/"Direktur"; C: "Staf PPIC"/"Supervisor Lini 1"/"Staf QC"), lalu diganti `req.user.employee_id`. Setiap hari tetap: pull pagi, kerja di branch, PR malam, satu orang lain me-review (aturan Git v1). B dan C tidak menunggu login A: endpoint diuji tanpa `authorize` dulu, `authorize` ditambahkan setelah login A masuk.

| Hari | A | B | C |
|---|---|---|---|
| **1. Sab 21/11** | Ganti folder `Backend/` dan `Frontend/` ke huruf kecil. Kerangka backend + semua utilitas fondasi + contoh OOP + `/health`, **merge sebelum 13.00**. Sore: login, logout, `/auth/me`, `authenticate`, `authorize` | Setelah kerangka A masuk: skema Drizzle + Zod modul B. Buyers, product-types, items, order-levels; POST dan GET /orders | Setelah kerangka A masuk: skema Drizzle + Zod modul C. Suppliers, raw-materials, production-lines; bahan per style (catat, lihat, ubah) + material-requirement |
| **2. Min 22/11** | Users, activity-logs. Fondasi frontend: Vite, `@theme`, http, AuthContext, ProtectedRoute | Setujui, tolak, batalkan order. Dialog batal **wajib** mengirim `requested_by_party` (BUYER/PERUSAHAAN), karena `sp_cancel_order` menolak bila kosong; yang ditunda hanya tampilan denda/refund. Tambahkan `authorize` | SPK ajukan, setujui, tolak (`sp_submit_spk`, `sp_decide_spk`). Tambahkan `authorize` |
| **3. Sen 23/11** | **Siang, uji sambungan 30 menit:** order → disetujui → SPK → disetujui, lewat Swagger. Lalu layout + komponen bersama, **merge sebelum malam** | Perbaiki temuan uji. Dashboard, expeditions, shipments + surat jalan | Perbaiki temuan uji. Progres (`fn_stage_max_allowed`, `sp_evaluate_flags`), QC + jenis cacat |
| **4. Sel 24/11** | Halaman SCR-01 Login, SCR-02 Beranda, SCR-03 Pengguna, SCR-23 Log Aktivitas | Halaman SCR-04, 05, 06, 08 (order), 14, 16, 17 | Halaman SCR-09, 10, 11, 08 (SPK), 12, 13 |
| **5. Rab 25/11** | **Pagi: uji alur penuh** (Marketing input order → Pimpinan setuju → PPIC bahan + SPK → Pimpinan setuju SPK → SPV progres sampai Packing → QC → dashboard → PPIC kirim + cetak surat jalan → Admin cek log). **Siang:** perbaikan bug. **Sore:** gladi demo | ← sama | ← sama |

### Yang ditunda sampai setelah 25/11

| Ditunda | Keterangan |
|---|---|
| Fitur Kalau sempat / Terakhir | Notifikasi, sesi aktif, buka kunci, reset password (SCR-19 s.d. 22, 24), riwayat harga (SCR-07), rekap (SCR-15), riwayat pengiriman (SCR-18), denda pembatalan di layar, standar QC di layar, pemakaian bahan (SCR-26). Tabel dan SP-nya sudah ada, tinggal halaman |
| Revisi mockup | Tidak perlu digambar ulang dulu. Setelah halaman jadi, mockup diperbarui dari screenshot aplikasi |

### Setelah demo RSI (bila jadwal SMBD terpisah)

Halaman SMBD (`/smbd/*`) untuk SUPERADMIN, mulai dari penampil tabel umum (A), lalu halaman transaksi masing-masing pemilik. Demo SMBD minimal tetap bisa dilakukan lewat SSMS/DBeaver: tabel, view, SP, trigger, dan `EXECUTE AS USER` dari `10-security.sql`.

### Revisi dokumen (SRS, FSD, TSD, laporan SMBD)

Dikerjakan setelah kode jalan, mengikuti kode yang sudah jadi. Daftar yang perlu direvisi ada di KONTRAK.md T-06 dan catatan perbedaan TSD (parameter `sp_create_notification`, `sp_record_login`, `sp_reset_password`; rumus `fn_reject_pct`).

---

## 4. Yang harus diputuskan sebelum Sabtu

| No | Keputusan | Usulan |
|---|---|---|
| 1 | Tanggal demo SMBD | Konfirmasi ke dosen SMBD; halaman SMBD dibuat setelah 25/11 |
| 2 | T-04: satu atau dua login database | **Satu dulu: `getPool()` dengan `app_rsi`** supaya kerangka A sederhana; pool kedua (`app_smbd`) ditambahkan setelah halaman SMBD dibuat |
| 3 | Siapa me-review PR siapa | **Searah:** A me-review PR B, B me-review PR C, C me-review PR A |
| 5 | Format uang (perlu PR ke `KONTRAK.md` Bagian 9) | v1 menulis "angka dalam Rupiah", padahal order INTERNASIONAL memakai USD. Usul: nilai uang mengikuti `currency` order/invoice, dan response yang memuat harga juga menyertakan `currency` |
| 4 | Jawaban Pak Bawi (T-01) | Tidak menghalangi kerja; bila ada perubahan, sesuaikan di KONTRAK.md lewat PR |

---

## 5. Titik sambung antaranggota (agar tidak saling menunggu)

| Yang dibutuhkan | Dari | Untuk | Kapan harus siap |
|---|---|---|---|
| Kerangka backend + `withTransaction` + `logActivity` | A | B, C | Sab 21/11 13.00 |
| Login + `authorize` | A | B, C | Sab 21/11 malam (sebelumnya B dan C boleh uji tanpa `authorize`) |
| Order DISETUJUI lewat API | B | C | Min 22/11 (sebelumnya pakai seed `PO-BRT-0001`) |
| Fungsi progres/reject/ready-to-ship | C | B | **Sudah ada** di database (`fn_detail_completion_pct`, `fn_reject_pct`, `fn_ready_to_ship`) |
| Layout + komponen bersama frontend | A | B, C | Sen 23/11 malam |
| Bagian SPK di halaman Persetujuan SCR-08 | C | B | Sel 24/11 |
