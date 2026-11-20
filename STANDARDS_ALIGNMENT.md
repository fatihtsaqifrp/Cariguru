# Pemetaan Standar dan Kesenjangan Trevy

Dokumen ini memetakan kondisi prototipe Trevy terhadap ruang lingkup standar. Pemetaan ini **bukan deklarasi kesesuaian, sertifikasi, audit, atau nasihat hukum**. ISO/IEC 27001 dan ISO 9001 berlaku pada sistem manajemen organisasi; implementasi aplikasi saja tidak membuktikan kesesuaian organisasi.

## Rujukan edisi

- **ISO/IEC 27001:2022**, termasuk Amendment 1:2024. Standar ini menetapkan persyaratan sistem manajemen keamanan informasi (ISMS) berbasis risiko.
- **ISO 9001:2026**, edisi 6 yang diterbitkan September 2026. Standar ini menetapkan persyaratan sistem manajemen mutu (QMS).
- **ISO 20022** adalah standar pemodelan dan skema pesan layanan keuangan. Implementasinya memerlukan pesan, versi skema, dan aturan komunitas yang relevan; standar ini bukan standar bagan akun (COA).

## Status kondisi prototipe

| Area | Kondisi saat ini | Gap utama | Langkah sebelum klaim selaras |
|---|---|---|---|
| Keamanan informasi — ISO/IEC 27001 | Beberapa kontrol teknis dasar kini ada: autentikasi server dengan hash kata sandi, cookie sesi HttpOnly/SameSite, pemeriksaan peran server, CSRF token, rate limit login, SQLite di luar direktori web, validasi transaksi server, transaksi database atomik, dan audit event. | Ini belum merupakan ISMS. Belum ada MFA, pemulihan akun, rotasi/pencabutan sesi mandiri, backup dan uji pemulihan, pemantauan/alert, proses respons insiden, penilaian risiko organisasi, Statement of Applicability, tinjauan akses berkala, atau audit independen. Tutor baru juga belum mengunggah bukti kualifikasi ke server; pembayaran dan transfer masih simulasi. | Tetapkan ruang lingkup ISMS dan pemilik risiko; rancang backup terenkripsi dan uji restore; tambah MFA, manajemen sesi dan pemantauan; lengkapi alur verifikasi bukti; dokumentasikan respons insiden, tinjauan akses, penilaian risiko, Statement of Applicability, dan audit internal/independen. Jangan gunakan untuk dana nyata sebelum review keamanan dan operasional.
| Mutu layanan — ISO 9001 | Belum diterapkan sebagai QMS. Form dan aksi admin sebagian besar prototipe tampilan. | Belum ada proses terkendali untuk kebutuhan pelanggan, keluhan, perubahan, kesalahan layanan, tindakan korektif, kompetensi, pengukuran hasil, dan audit internal. | Tetapkan proses dan pemiliknya; rekam persyaratan pelanggan dan kewajiban yang berlaku; ukur indikator layanan; simpan bukti penanganan keluhan, ketidaksesuaian, tindakan korektif, evaluasi pemasok, tinjauan manajemen, dan perbaikan berkelanjutan.
| Pesan finansial — ISO 20022 | Belum diterapkan. Checkout dan transfer adalah simulator; tidak ada pertukaran pesan finansial dengan bank atau penyedia pembayaran. | Belum ditentukan komunitas/bank, proses bisnis, jenis pesan, versi skema, atau aturan implementasi yang harus dipakai. Status transaksi lokal bukan pesan ISO 20022. | Tentukan bank/penyedia dan spesifikasi integrasinya; petakan proses ke katalog pesan dan aturan komunitas yang benar; validasi pesan terhadap skema resmi; uji penolakan, duplikasi, rekonsiliasi, koreksi, dan audit trail end-to-end. Jangan menambahkan tag ISO 20022 ke COA atau mengklaim dukungan sebelum pertukaran pesan nyata tervalidasi.

## Batasan implementasi sekarang

- Akun, simulasi pembayaran, presensi, honor, dan penarikan kini disimpan di SQLite server. Pilihan tampilan provider masih di `localStorage`; database harus tetap di lokasi privat, dicadangkan, dan tidak diekspos melalui static web server.
- Tombol “Simulasikan Bayar Berhasil” tidak memverifikasi pembayaran pada Midtrans/Xendit. Jangan gunakan untuk transaksi produksi.
- Transfer honor, saldo, jurnal, dan laporan keuangan yang tampil tidak mewakili pembukuan atau perpindahan dana yang telah direkonsiliasi.
- COA Trevy adalah rancangan akun internal. ISO 20022 tidak menetapkan COA; pemetaan akuntansi perlu dikaji terpisah oleh akuntan sesuai entitas dan ketentuan yang berlaku.

## Kriteria penerimaan minimum untuk integrasi ISO 20022

1. Dokumen spesifikasi menyebut pihak lawan, proses bisnis, message definition, versi, transport, dan aturan komunitas yang dipakai.
2. Pesan masuk/keluar divalidasi terhadap skema dan aturan implementasi yang ditetapkan pihak lawan.
3. Identitas pesan, status, waktu, referensi pembayaran, dan hasil validasi dicatat secara dapat diaudit serta direkonsiliasi dengan settlement.
4. Pengujian mencakup pesan valid/tidak valid, pengiriman ulang, duplikasi, timeout, koreksi/pembatalan, dan hasil settlement.

## Sumber resmi

- [ISO/IEC 27001:2022](https://www.iso.org/standard/27001)
- [ISO 9001:2026](https://www.iso.org/standard/9001)
- [About ISO 20022](https://www.iso20022.org/about-iso-20022)
- [ISO 20022 FAQ](https://www.iso20022.org/faq)
