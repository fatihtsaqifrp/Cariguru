# 🎓 Trevy — Portal Les Privat Semarang

Trevy adalah platform web manajemen les privat komprehensif untuk wilayah Semarang dan sekitarnya, menghubungkan siswa/wali murid dengan guru les privat terverifikasi secara tatap muka dan daring.

Platform ini dilengkapi dengan portal khusus multi-peran (**Siswa**, **Guru/Tutor**, **Staf Operasional**, dan **Super Admin**), integrasi pembayaran digital **Midtrans Core API / Snap**, pencairan honor otomatis via **Midtrans Iris (Disbursement API)**, pembukuan berpasangan berstandar **SAK EMKM / PSAK (Double-Entry Bookkeeping)**, serta arsitektur hybrid **Netlify Serverless + Neon PostgreSQL Cloud + SQLite**.

---

## 🏗️ Arsitektur & Infrastruktur Sistem

```text
       [ Pengguna: Browser / Mobile Web ]
                       │
                       ▼
            ┌─────────────────────┐
            │   Netlify Edge CDN  │ ── Menyajikan Frontend Statis (HTML5 / Vanilla CSS3 / JS ES6+)
            └─────────────────────┘
                       │
                       ▼  (API Calls / Request)
        ┌─────────────────────────────┐
        │   Netlify Functions Lambda  │ ── Node.js 22 Express Backend (`server.js`)
        └─────────────────────────────┘
                │               │
  (Bi-directional Sync)         │ (Payment & Payout Webhooks / APIs)
                ▼               ▼
   ┌───────────────────────┐  ┌──────────────────────────────────────────────┐
   │ Neon PostgreSQL Cloud │  │ Midtrans Payment Services:                   │
   │ (Single Source-of-    │  │ • Core API / Snap : QRIS Dinamis & Bank VA   │
   │  Truth Database)      │  │ • Iris Payout API: Auto Transfer Honor Guru │
   └───────────────────────┘  └──────────────────────────────────────────────┘
                ▲
                │  (Container Local Cache)
   ┌───────────────────────┐
   │ /tmp/trevy.sqlite     │
   │ (Fast In-Memory/Disk) │
   └───────────────────────┘
```

### 1. Hybrid Storage Engine (`postgres-sync.js`)
- **Serverless Lifecycle**: Di platform serverless Netlify, filesystem lokal bersifat stateless/ephemeral (`/tmp`).
- **Penyimpanan Utama (PostgreSQL)**: Seluruh data (pengguna, langganan paket, transaksi pembayaran, sesi belajar, presensi, penarikan honor guru, preferensi, dan pengaturan tenant) disimpan secara persisten di **Neon PostgreSQL**.
- **Performa Tinggi**: Request lokal dan query relasional cepat dijalankan di SQLite lokal `/tmp/trevy.sqlite` yang secara berkala dan otomatis disinkronisasikan dua arah (*bi-directional sync*) dengan PostgreSQL Neon sebelum operasi baca/tulis penting.

### 2. Keamanan & Enkripsi
- **Session Stateless Signed Token**: Autentikasi menggunakan cookie HTTP-only ber-signature **HMAC-SHA256** yang memuat User ID, Role, CSRF token, dan masa berlaku sesi, menjamin sesi login tetap aktif dan tidak putus saat berganti container serverless.
- **Enkripsi Kredensial (AES-256-GCM)**: Server Key Midtrans, Kunci API Iris, dan secret gateway lainnya dienkripsi di level database dengan *random Initialization Vector (IV)* dan *Authentication Tag*. Kunci rahasia tidak pernah dikirimkan mentah ke sisi klien.
- **CSRF Defense**: Seluruh mutasi data sensitif (`POST`, `PUT`, `PATCH`, `DELETE`) dilindungi oleh validasi token CSRF (`x-csrf-token`).

---

## 🚀 Panduan Menjalankan Sistem Secara Lokal

### Prasyarat
- **Node.js** versi 22.x LTS
- **npm** versi 10.x ke atas
- **Visual Studio Code** untuk memasang extension editor (opsional; aplikasi tidak membutuhkannya).

### Setup satu kali di laptop baru
Kalau Node.js belum ada, bootstrap mencoba memasangnya lalu meneruskan setup:

**macOS** (perlu Homebrew):
```sh
bash scripts/bootstrap-macos.sh
```

**Windows** (PowerShell dan WinGet):
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-windows.ps1
```

Jika tidak memakai Homebrew/WinGet, pasang Node.js LTS dari [nodejs.org](https://nodejs.org/en/download), buka ulang terminal, lalu jalankan `npm run setup:laptop`.

Setelah Node.js tersedia, jalankan dari folder proyek:
```sh
npm run setup:laptop
```
Perintah ini memasang dependency, membuat `.env` lokal dan encryption key acak jika `.env` belum ada, memasang extension VS Code jika perintah `code` tersedia, lalu menjalankan server development. File `.env` yang sudah ada tidak ditimpa. Extension yang dipakai tercatat di `.vscode/extensions.json`.

Extension VS Code yang direkomendasikan: Prettier, ESLint, SQLite Viewer, dan PostgreSQL. Jika `code` tidak dikenali, buka Command Palette VS Code, jalankan **Shell Command: Install 'code' command in PATH**, lalu jalankan setup lagi; atau pasang extension dari panel Extensions.

### 1. Kloning Repositori & Install Dependensi
```sh
git clone https://github.com/fatihtsaqifrp/Cariguru.git
cd Cariguru
npm install
```

### 2. Konfigurasi Environment Variables (`.env`)
Buat berkas `.env` di root direktori proyek (salin dari konfigurasi berikut):
```env
PORT=3000
NODE_ENV=development

# URL aplikasi publik (tanpa slash di akhir)
TREVY_PUBLIC_URL=http://localhost:3000

# Enkripsi rahasia gateway (32 byte base64 atau 64 karakter hex)
TREVY_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Kredensial Database PostgreSQL Neon (Opsional untuk lokal, default otomatis ke SQLite)
# NETLIFY_DATABASE_URL=postgresql://user:password@ep-sample.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# Kredensial Midtrans (Dapat juga diisi lewat Admin Panel -> Pengaturan Sistem)
MIDTRANS_MERCHANT_ID=M077624236
MIDTRANS_CLIENT_KEY=Mid-client-ewifLRM-nBkQAJqO
# MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
# MIDTRANS_IRIS_API_KEY=IRIS-xxxx
```

### 3. Menjalankan Server Development
```sh
npm run dev
```
Akses aplikasi melalui browser di: `http://localhost:3000`.

### 4. Akun Bawaan (Default Test Credentials)
| Peran | Email | Kata Sandi | Halaman Utama |
|---|---|---|---|
| **Super Admin** | `admin@trevy.id` | `admin123` | `dashboard-admin.html` |
| **Siswa** | `siswa@trevy.id` | `siswa123` | `dashboard-student.html` |
| **Guru / Tutor** | `guru@trevy.id` | `guru123` | `dashboard-tutor.html` |

---

## 💳 Integrasi Pembayaran & Pencairan (Midtrans Suite)

### 1. Pembayaran Masuk (Incoming Payment: Midtrans Core API & Snap)
- **Metode Pembayaran**:
  - **QRIS Dinamis**: Menghasilkan barcode QRIS interaktif langsung di modal aplikasi (*in-app modal* tanpa redirect keluar halaman) yang dapat di-scan dari aplikasi BCA, Mandiri, GoPay, ShopeePay, OVO, atau Dana.
  - **Virtual Account (Bank Transfer)**: Menyediakan nomor VA resmi untuk Bank Mandiri (E-Channel/Bill Key), BCA, BNI, BRI, dan Permata.
- **Konfirmasi Transaksi**:
  - Webhook otomatis mendengarkan notifikasi di: `/api/payments/webhooks/midtrans`.
  - Auto-polling status transaksi real-time di sisi klien setiap 3 detik.
  - Fitur **Simulasi Sandbox Otomatis** bagi pengujian siswa di lingkungan sandbox tanpa perlu berpindah tab atau menggunakan simulator eksternal.

### 2. Pencairan Honor Guru Otomatis (Outgoing Payout: Midtrans Iris)
- **Teknologi**: Menggunakan **Midtrans Iris Payout API** (`/iris/api/v1/payouts`).
- **Mekanisme Otomatis**:
  - Guru mengajukan penarikan saldo honor dari dashboard tutor.
  - Admin membuka menu Transaksi & Penarikan di Admin Panel.
  - Admin mengklik tombol **`⚡ Setujui & Auto-Transfer Iris`**.
  - Sistem menghubungi API Midtrans Iris untuk mengeksekusi transfer dana antarbank ke nomor rekening bank terdaftar guru (BCA, BRI, Mandiri, BNI, BSI, CIMB, Jago, dll).
  - Menerima nomor referensi pencairan unik (`reference_no`) dan status seketika berubah menjadi `transferred`.
  - Di mode pengujian sandbox tanpa key Iris aktif, sistem menjalankan simulasi disbursement otomatis (`IRIS-SIM-XXXXXX`) dengan rekonsiliasi kas keluar yang identik.

---

## 📊 Sistem Akuntansi & Chart of Accounts (COA) Standar SAK EMKM

Platform menerapkan sistem akuntansi **Jurnal Umum Berpasangan (*Double-Entry Bookkeeping*)** dengan rumus keseimbangan $\text{Aset} = \text{Kewajiban} + \text{Ekuitas}$:

```text
[Pembayaran Siswa Masuk] 
  → Debit : 1-1120 Kliring Gateway Midtrans
  → Kredit: 2-1200 Pendapatan Diterima di Muka (Unearned Revenue)

[Sesi Selesai & Disahkan Admin]
  → Debit : 5-1100 Beban Honor Pengajar (COGS)
  → Kredit: 2-1100 Utang Honor Pengajar

[Transfer Honor Guru Disetujui (Iris Payout)]
  → Debit : 2-1100 Utang Honor Pengajar
  → Kredit: 1-1110 Kas & Bank Operasional
```

### Bagan Akun (COA) Utama:
| Kode Akun | Nama Akun | Kategori | Saldo Normal | Fungsi dalam Sistem |
|---|---|---|---|---|
| **`1-1110`** | Kas & Bank Operasional | Aset Lancar | Debit | Kas operasional pencairan honor guru via Iris / Bank. |
| **`1-1120`** | Kliring Payment Gateway (Midtrans) | Aset Lancar | Debit | Saldo escrow settlement penerimaan siswa via Midtrans. |
| **`1-1130`** | Kliring Payment Gateway (Xendit) | Aset Lancar | Debit | Saldo escrow penerimaan siswa via Xendit. |
| **`2-1100`** | Utang Honor Pengajar | Kewajiban Lancar | Kredit | Akrual hak honor pengajar yang belum ditarik. |
| **`2-1200`** | Pendapatan Diterima di Muka | Kewajiban Lancar | Kredit | Dana paket les siswa sebelum seluruh sesi belajar terlaksana. |
| **`4-1100`** | Pendapatan Jasa Les Privat | Pendapatan Usaha | Kredit | Nilai riil pendapatan jasa atas sesi les yang selesai. |
| **`5-1100`** | Beban Honor Pengajar (COGS) | Beban Pokok | Debit | Beban kompensasi pengajar per sesi terverifikasi. |
| **`5-1200`** | Beban MDR & Gateway Fee | Beban Operasional | Debit | Fee transaksi perbankan dan gateway (0.7% QRIS). |

---

## 🔄 Alur Fitur Sistem End-to-End

### 1. Alur Siswa (Student Journey)
1. **Pendaftaran & Akun**: Mendaftar akun baru dengan jenjang kelas dan alamat rumah di Semarang.
2. **Klaim Kelas Percobaan (Free Trial)**: Berhak mendapatkan 1x kuota sesi percobaan gratis 90 menit tanpa biaya.
3. **Pembelian Paket Belajar**: Memilih paket (Harian, Mingguan, Bulanan 8 sesi, atau Tahunan 96 sesi), lalu melakukan pembayaran instan via QRIS Dinamis atau VA Bank di dalam modal aplikasi.
4. **Booking Kelas & Matching Otomatis**: Memilih mata pelajaran (Matematika, Fisika, Kimia, dll), tanggal, dan slot jam. Sistem memindai dan mencocokkan guru privat terdekat yang bersedia di jam tersebut.
5. **Belajar & Riwayat Kehadiran**: Memantau jadwal mendatang, catatan materi pembelajaran, riwayat absensi guru, serta memberikan ulasan bintang (rating) setelah sesi usai.

### 2. Alur Pengajar (Tutor Journey)
1. **Registrasi & Unggah Berkas**: Guru mendaftar dan mengunggah dokumen ijazah/sertifikasi pendidikan untuk ditinjau admin.
2. **Atur Slot Ketersediaan**: Mengaktifkan hari dan jam mengajar mingguan (Senin–Minggu) pada kalender ketersediaan.
3. **Menerima Tugas Les**: Mendapatkan penugasan siswa sesuai lokasi kecamatan (Tembalang, Banyumanik, dll).
4. **Presensi Kehadiran di Lokasi (Check-in & Check-out)**:
   - Tiba di rumah siswa &rarr; Klik **Check-in** (merekam koordinat GPS perangkat).
   - Melaksanakan pembelajaran 90 menit.
   - Selesai sesi &rarr; Unggah foto dokumentasi belajar dan isi jurnal topik materi &rarr; Klik **Check-out**.
5. **Klaim Honor & Penarikan Saldo**:
   - Honor otomatis masuk ke saldo dompet pengajar (`Rp100.000 / sesi`) setelah disahkan admin.
   - Mengatur rekening bank pencairan di Profil Pengajar.
   - Klik **Tarik Saldo Rekening** untuk mengajukan pencairan otomatis.

### 3. Alur Super Admin & Keuangan (Admin Journey)
1. **Verifikasi Pengajar**: Memeriksa berkas CV/Ijazah dan mengaktifkan status akun tutor baru.
2. **Pengesahan Presensi & Sesi**: Meninjau koordinat GPS kehadiran dan foto bukti belajar guru, lalu mengklik `Sahkan & Rilis Honor`.
3. **Eksekusi Transfer Honor (Midtrans Iris)**: Meninjau antrean penarikan dana guru dan mengklik `⚡ Setujui & Auto-Transfer Iris` untuk transfer dana otomatis ke rekening bank guru.
4. **Monitoring Akuntansi & Laporan Finansial**:
   - Memantau Jurnal Umum Berpasangan (*General Journal*) yang seimbang (*balanced*).
   - Mengunduh rekap mutasi jurnal dalam format CSV.
   - Memantau Laporan Laba Rugi Operasional (*Income Statement*) dan Neraca Posisi Keuangan (*Balance Sheet*).
5. **Pengaturan Sistem & Gateway**:
   - Mengonfigurasi kunci API Midtrans Snap, Midtrans Iris, tarif standar per sesi, kuota free trial, durasi sesi, dan identitas branding platform.

---

## 🧪 Pengujian & Verifikasi Otomatis

Trevy dilengkapi dengan suite uji integrasi otomatis (*automated verification script*) yang menguji 8 aspek inti:
- Integritas migrasi skema database versi `001–008`.
- Hak akses dan isolasi Role-Based Access Control (RBAC).
- Idempotensi checkout dan transaksi ganda.
- Alur lengkap booking sesi &rarr; check-in GPS &rarr; bukti foto &rarr; check-out &rarr; review admin &rarr; ulasan siswa.
- Alur payroll honor guru &rarr; penarikan saldo &rarr; approval Iris transfer.
- Enkripsi dan dekripsi kunci rahasia gateway (AES-256-GCM).
- Pengunggahan dan akses media privat.

Jalankan pengujian dengan perintah:
```sh
npm test
# atau
npm run verify
```

---

## 📄 Lisensi & Hak Cipta
Hak Cipta © 2026 Trevy (Portal Les Privat Semarang). Dilindungi Undang-Undang.
