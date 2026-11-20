# Trevy

Portal les privat dengan dashboard siswa, tutor, staf operasional, dan super-admin. UI memakai HTML/CSS/JavaScript; backend memakai Node.js, Express, dan SQLite.

## Menjalankan lokal

Butuh Node.js 22 atau lebih baru.

```sh
npm install
npm run dev
```

Buka `http://localhost:3000`. Mode development membuat akun demo:

| Peran | Login | Kata sandi |
|---|---|---|
| Siswa | `siswa@trevy.id` | `siswa123` |
| Tutor | `guru@trevy.id` | `guru123` |
| Super-admin | `admin@trevy.id` | `admin123` |

Jangan pakai kredensial demo di production. Database dan berkas upload default disimpan di direktori `../trevy-data`, di luar folder web.

## Production

Salin `.env.example` ke environment deployment dan atur:

- `TREVY_DB_PATH` dan `TREVY_UPLOAD_DIR` ke penyimpanan privat persisten.
- `TREVY_ADMIN_EMAIL` dan `TREVY_ADMIN_PASSWORD` (minimal 14 karakter) untuk bootstrap super-admin.
- `TREVY_ENCRYPTION_KEY` sebagai key acak 32 byte (base64) atau 64 karakter hex untuk menyimpan rahasia payment provider.
- `TREVY_PUBLIC_URL` sebagai origin HTTPS publik aplikasi, tanpa slash di akhir. Pasang webhook Midtrans ke `/api/payments/webhooks/midtrans` atau webhook Xendit ke `/api/payments/webhooks/xendit`.
- `NODE_ENV=production`, `PORT` sesuai platform, dan HTTPS pada reverse proxy.

Jalankan `npm start`. Production menolak database yang berisi akun demo. Migrasi versi 001–008 dijalankan saat startup; simpan backup sebelum upgrade. Upload privat disajikan lewat route terautentikasi.

Untuk simulator lokal, jalankan `npm run dev`. Di Pengaturan Sistem pilih mode **Simulator**. Untuk transaksi provider, pilih Sandbox/Test atau Production/Live, simpan key dari environment yang sama, daftarkan URL webhook provider di atas, lalu centang konfirmasi webhook. Xendit menggunakan Payment Session hosted checkout; siapkan `TREVY_PUBLIC_URL` HTTPS juga saat uji sandbox.

## Kapabilitas

- Login sesi server, profil, preferensi, perubahan kata sandi, dan unggah foto profil.
- Role dan permission per tenant: siswa, guru, super-admin, keuangan, marketing, front-office, dan back-office.
- Pengaturan tenant untuk branding, kontak, payment, keamanan, operasional, notifikasi, dan keuangan. Rahasia provider dienkripsi dan API hanya mengembalikan status/mask.
- Checkout hosted Midtrans Snap dan Xendit Payment Session. Pesanan tetap pending sampai callback bertanda tangan/token valid diterima; kuota tidak diberikan dari redirect browser. Midtrans sandbox/live dipilih di Pengaturan Sistem. Xendit test/live mengikuti API key dari environment yang dipilih.
- Form kredensial BI-SNAP terpisah disediakan untuk menyimpan Client ID, Client Secret, Partner ID, Channel ID, dan kunci PEM terenkripsi. Endpoint checkout BI-SNAP belum aktif; perlu integrasi channel BI-SNAP dan verifikasi callback tersendiri sebelum digunakan.
- Manajemen akun, grup, permission, paket, tutor, jadwal ketersediaan, pencocokan, booking, trial/kuota, check-in/out, bukti presensi, review, honor, dan permintaan penarikan.
- Audit log dan ringkasan dashboard menggunakan data database.
- Fitur yang belum dihubungkan ke layanan eksternal ditandai sebagai simulator.

## Batas integrasi

Pembayaran Midtrans/Xendit hanya simulasi; tidak ada transaksi, webhook, atau validasi pembayaran provider sungguhan. Persetujuan penarikan hanya mencatat keputusan dan tidak mengirim transfer bank. Koordinat check-in disimpan sebagai bukti, tetapi belum divalidasi terhadap lokasi sesi. Email, WhatsApp, notifikasi push, dan layanan peta eksternal belum terhubung. Jangan menganggap status simulasi sebagai konfirmasi pembayaran atau transfer.

## Verifikasi

Jalankan `npm run verify` untuk tes integrasi lokal pada database sementara. Script memeriksa migrasi, pembatasan akses role staf, checkout idempoten, booking sampai tinjauan presensi, penarikan, enkripsi rahasia pengaturan, dan upload profil. `npm test` menjalankan verifikasi yang sama.

## Relasi data inti

```text
tenant_settings ── tenant_id ── roles ── role_permissions ── permissions
users ── user_roles ── roles       users ── user_group_members ── user_groups
users ── student_profiles ── learning_sessions ── tutor_profiles ── users
student_profiles ── learning_subscriptions ── packages
 tutor_profiles ── tutor_availability
learning_sessions ── attendance ── attendance_evidence
users ── uploads / audit_log
```

Database juga mempertahankan tabel legacy yang diperlukan untuk sesi, pembayaran simulasi, honor, dan penarikan.
# Cariguru
