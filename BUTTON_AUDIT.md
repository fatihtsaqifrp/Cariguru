# Audit Kontrol Klik UI

Daftar inventaris dibuat ulang setelah perbaikan dashboard. Mencakup **185** tautan dan kontrol klik statis di **8** halaman. Handler inline pada tujuh halaman utama dibuka di Chrome dan diperiksa bahwa nama fungsi tersedia; alur presensi admin, tab keuangan, unduhan jurnal saat kosong, navigasi sidebar, dan responsivitas diuji terpisah. Kontrol yang dirender dari API (akun, paket, presensi) diuji pada alur UI presensi.

| Halaman | Baris | Elemen | Label | Status/handler | Tujuan atau tindakan |
|---|---:|---|---|---|---|
| index.html | 24 | a | T platform | Tautan/navigasi | index.html |
| index.html | 30 | a | Fitur | Tautan/navigasi | #features |
| index.html | 31 | a | Cara Kerja | Tautan/navigasi | #how-it-works |
| index.html | 32 | a | Mata Pelajaran | Tautan/navigasi | #subjects |
| index.html | 33 | a | Harga | Tautan/navigasi | #pricing |
| index.html | 34 | a | Testimoni | Tautan/navigasi | #testimonials |
| index.html | 38 | a | Masuk | Tautan/navigasi | login.html |
| index.html | 39 | a | Daftar Gratis | Tautan/navigasi | register.html |
| index.html | 42 | button | Toggle menu | Listener menu mobile | initMobileMenu() dari js/main.js |
| index.html | 80 | a | Mulai Belajar Gratis | Tautan/navigasi | register.html |
| index.html | 84 | a | Daftar Jadi Guru | Tautan/navigasi | register-tutor.html |
| index.html | 401 | button | Pilih Harian | Inline handler | openLandingCheckout('daily') |
| index.html | 432 | button | Pilih Paket Bulanan | Inline handler | openLandingCheckout('monthly') |
| index.html | 462 | button | Pilih Tahunan | Inline handler | openLandingCheckout('yearly') |
| index.html | 557 | a | Daftar Sebagai Siswa | Tautan/navigasi | register.html |
| index.html | 561 | a | Bergabung Jadi Guru | Tautan/navigasi | register-tutor.html |
| index.html | 597 | a | Harga Paket | Tautan/navigasi | #pricing |
| index.html | 598 | a | Mata Pelajaran | Tautan/navigasi | #subjects |
| index.html | 605 | a | Daftar Guru | Tautan/navigasi | register-tutor.html |
| index.html | 643 | button | × | Inline handler | closeLandingModal() |
| index.html | 667 | button | Batal | Inline handler | closeLandingModal() |
| index.html | 668 | button | Lanjutkan Pembayaran | Inline handler | processLandingPayment() |
| index.html | 680 | button | × | Inline handler | closeLandingGateway() |
| index.html | 698 | button | Simulasikan Bayar Berhasil | Inline handler | completeLandingSimulation() |
| index.html | 701 | button | Tutup | Inline handler | closeLandingGateway() |
| login.html | 26 | a | Kembali ke Beranda | Tautan/navigasi | index.html |
| login.html | 66 | a | T platform | Tautan/navigasi | index.html |
| login.html | 84 | button | Isi Siswa | Inline handler | autofillLogin('student') |
| login.html | 85 | button | Isi Guru | Inline handler | autofillLogin('tutor') |
| login.html | 86 | button | Isi Super Admin | Inline handler | autofillLogin('admin') |
| login.html | 100 | button | (ikon/tanpa label) | Inline handler | togglePassword('login-password', this) |
| login.html | 113 | button | Masuk Sekarang | Submit form | submit form |
| login.html | 120 | a | Daftar Akun Siswa Baru | Tautan/navigasi | register.html |
| login.html | 120 | a | Daftar Jadi Pengajar | Tautan/navigasi | register-tutor.html |
| register.html | 26 | a | ← Kembali ke Beranda | Tautan/navigasi | index.html |
| register.html | 71 | a | T platform | Tautan/navigasi | index.html |
| register.html | 110 | button | (ikon/tanpa label) | Inline handler | togglePassword('reg-password', this) |
| register.html | 116 | button | Lanjutkan | Inline handler | goToStep(2) |
| register.html | 171 | button | ← Kembali | Inline handler | goToStep(1) |
| register.html | 172 | button | Lanjutkan → | Inline handler | goToStep(3) |
| register.html | 182 | button | Matematika | Inline handler | toggleChip(this) |
| register.html | 183 | button | B. Inggris | Inline handler | toggleChip(this) |
| register.html | 184 | button | Fisika | Inline handler | toggleChip(this) |
| register.html | 185 | button | Kimia | Inline handler | toggleChip(this) |
| register.html | 186 | button | Biologi | Inline handler | toggleChip(this) |
| register.html | 187 | button | B. Indonesia | Inline handler | toggleChip(this) |
| register.html | 188 | button | Komputer | Inline handler | toggleChip(this) |
| register.html | 189 | button | Ekonomi | Inline handler | toggleChip(this) |
| register.html | 205 | button | ← Kembali | Inline handler | goToStep(2) |
| register.html | 206 | button | Daftar Sekarang | Inline handler | handleRegister(event) |
| register.html | 214 | a | Masuk di sini | Tautan/navigasi | login.html |
| register-tutor.html | 25 | a | ← Kembali ke Beranda | Tautan/navigasi | index.html |
| register-tutor.html | 63 | a | T platform | Tautan/navigasi | index.html |
| register-tutor.html | 101 | button | (ikon/tanpa label) | Inline handler | togglePassword('tutor-password', this) |
| register-tutor.html | 107 | button | Lanjutkan → | Inline handler | goToTutorStep(2) |
| register-tutor.html | 134 | button | Matematika | Inline handler | toggleChip(this) |
| register-tutor.html | 135 | button | B. Inggris | Inline handler | toggleChip(this) |
| register-tutor.html | 136 | button | Fisika | Inline handler | toggleChip(this) |
| register-tutor.html | 137 | button | Kimia | Inline handler | toggleChip(this) |
| register-tutor.html | 138 | button | Biologi | Inline handler | toggleChip(this) |
| register-tutor.html | 139 | button | B. Indonesia | Inline handler | toggleChip(this) |
| register-tutor.html | 140 | button | Komputer | Inline handler | toggleChip(this) |
| register-tutor.html | 141 | button | Ekonomi | Inline handler | toggleChip(this) |
| register-tutor.html | 174 | button | ← Kembali | Inline handler | goToTutorStep(1) |
| register-tutor.html | 175 | button | Lanjutkan → | Inline handler | goToTutorStep(3) |
| register-tutor.html | 217 | button | ← Kembali | Inline handler | goToTutorStep(2) |
| register-tutor.html | 218 | button | Kirim Pendaftaran Pengajar | Inline handler | handleTutorRegister(event) |
| register-tutor.html | 232 | a | Masuk di sini | Tautan/navigasi | login.html |
| dashboard-admin.html | 21 | a | T platform Admin Panel | Tautan/navigasi | index.html |
| dashboard-admin.html | 32 | a | Dashboard | Tautan/navigasi | #dashboard |
| dashboard-admin.html | 38 | a | Semua Pengguna | Tautan/navigasi | #pengguna |
| dashboard-admin.html | 46 | a | Verifikasi Pengajar 0 | Tautan/navigasi | #verifikasi |
| dashboard-admin.html | 53 | a | Validasi Presensi & Sesi 0 | Tautan/navigasi | #presensi |
| dashboard-admin.html | 60 | a | Paket & Harga | Tautan/navigasi | #paket |
| dashboard-admin.html | 68 | a | Keuangan & Akuntansi | Tautan/navigasi | #keuangan |
| dashboard-admin.html | 74 | a | Transaksi & Mutasi 0 | Tautan/navigasi | #transaksi |
| dashboard-admin.html | 81 | a | Payroll & Tarik Saldo | Tautan/navigasi | #payroll |
| dashboard-admin.html | 87 | a | Payment Gateway Midtrans | Tautan/navigasi | #gateway |
| dashboard-admin.html | 96 | a | Pengaturan Sistem | Tautan/navigasi | #pengaturan |
| dashboard-admin.html | 105 | a | Keluar | Tautan/navigasi | login.html |
| dashboard-admin.html | 127 | button | Toggle Menu | Listener sidebar | initSidebar() dari js/main.js |
| dashboard-admin.html | 136 | button | Export Laporan | Inline handler | exportDataCSV() |
| dashboard-admin.html | 140 | button | (ikon/tanpa label) | Inline handler | toggleAdminNotifs(event) |
| dashboard-admin.html | 149 | button | Tandai dibaca | Inline handler | markAllAdminNotifsRead() |
| dashboard-admin.html | 305 | button | Buat Akun | Inline handler | createAdminUser() |
| dashboard-admin.html | 305 | button | Tambah Grup | Inline handler | createUserGroup() |
| dashboard-admin.html | 351 | button | + Tambah Paket Baru | Inline handler | openAddPackageModal() |
| dashboard-admin.html | 394 | button | Bagan Akun (Chart of Accounts / COA) | Inline handler | switchCoaSubView('coa') |
| dashboard-admin.html | 398 | button | Jurnal Umum Berpasangan (General Journal) | Inline handler | switchCoaSubView('journal') |
| dashboard-admin.html | 402 | button | Laporan Laba Rugi (Income Statement) | Inline handler | switchCoaSubView('pnl') |
| dashboard-admin.html | 406 | button | Posisi Keuangan (Balance Sheet) | Inline handler | switchCoaSubView('balance') |
| dashboard-admin.html | 423 | button | Download Jurnal CSV | Inline handler | exportJournalCSV() |
| dashboard-admin.html | 474 | button | Download CSV | Inline handler | exportDataCSV() |
| dashboard-admin.html | 609 | button | Simpan Provider Pratinjau | Inline handler | saveGatewayConfig() |
| dashboard-admin.html | 612 | button | Periksa Mode Simulator | Inline handler | testGatewayConnection() |
| dashboard-admin.html | 629 | button | Branding | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 630 | button | Umum | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 631 | button | Payment Gateway | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 632 | button | Keamanan | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 633 | button | Tarif & Operasional | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 634 | button | Notifikasi | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 635 | button | Keuangan | Listener tab pengaturan | data-settings-tab |
| dashboard-admin.html | 644 | button | Simpan Branding | Inline handler | saveTenantSettings('branding') |
| dashboard-admin.html | 648 | button | Simpan Umum | Inline handler | saveTenantSettings('general') |
| dashboard-admin.html | 651 | button | Simpan Payment Gateway | Inline handler | saveTenantSettings('payment') |
| dashboard-admin.html | 652 | button | Simpan Keamanan | Inline handler | saveTenantSettings('security') |
| dashboard-admin.html | 653 | button | Simpan Operasional | Inline handler | saveTenantSettings('operations') |
| dashboard-admin.html | 654 | button | Simpan Notifikasi | Inline handler | saveTenantSettings('notifications') |
| dashboard-admin.html | 655 | button | Simpan Keuangan | Inline handler | saveTenantSettings('finance') |
| dashboard-admin.html | 681 | button | × | Inline handler | closeAdminModal() |
| dashboard-admin.html | 708 | button | Batal | Inline handler | closeAdminModal() |
| dashboard-admin.html | 709 | button | Publikasikan Paket | Inline handler | saveNewPackage() |
| dashboard-student.html | 21 | a | T platform Portal Siswa | Tautan/navigasi | index.html |
| dashboard-student.html | 32 | a | Beranda | Tautan/navigasi | #beranda |
| dashboard-student.html | 38 | a | Jadwal Les 2 | Tautan/navigasi | #jadwal |
| dashboard-student.html | 45 | a | Booking Kelas | Tautan/navigasi | #booking |
| dashboard-student.html | 51 | a | Free Trial 1 | Tautan/navigasi | #trial |
| dashboard-student.html | 60 | a | Absensi | Tautan/navigasi | #absensi |
| dashboard-student.html | 66 | a | Pembayaran & Paket | Tautan/navigasi | #pembayaran |
| dashboard-student.html | 74 | a | Profil Siswa | Tautan/navigasi | #profil |
| dashboard-student.html | 80 | a | Pengaturan | Tautan/navigasi | #pengaturan |
| dashboard-student.html | 89 | a | Keluar | Tautan/navigasi | login.html |
| dashboard-student.html | 111 | button | Toggle Menu | Listener sidebar | initSidebar() dari js/main.js |
| dashboard-student.html | 120 | button | (ikon/tanpa label) | Inline handler | toggleNotifDropdown(event) |
| dashboard-student.html | 129 | button | Tandai dibaca | Inline handler | markAllNotifsRead() |
| dashboard-student.html | 175 | button | Gunakan Sesi Percobaan | Inline handler | claimTrialBanner() |
| dashboard-student.html | 176 | button | Beli Paket | Inline handler | openPackageModal() |
| dashboard-student.html | 225 | button | Lihat Seluruhnya | Inline handler | switchStudentTab('jadwal') |
| dashboard-student.html | 271 | button | Beri Ulasan | Inline handler | openReviewModal('Matematika', 'Budi Wicaksono, S.Pd') |
| dashboard-student.html | 346 | button | + Tambah Jadwal Baru | Inline handler | switchStudentTab('booking') |
| dashboard-student.html | 411 | button | Mulai Pencocokan Guru Terbaik | Inline handler | startAutoMatching() |
| dashboard-student.html | 432 | button | Aktifkan Free Trial Sekarang | Inline handler | claimTrialBanner() |
| dashboard-student.html | 506 | button | Beli / Perpanjang Paket | Inline handler | openPackageModal() |
| dashboard-student.html | 516 | button | Tambah Kuota Sesi | Inline handler | openPackageModal() |
| dashboard-student.html | 566 | button | Simpan Profil | Inline handler | saveStudentProfile() |
| dashboard-student.html | 615 | button | Simpan Perubahan | Inline handler | saveStudentAccountSettings() |
| dashboard-student.html | 633 | button | × | Inline handler | closeActiveModal() |
| dashboard-student.html | 692 | button | Batal | Inline handler | closeActiveModal() |
| dashboard-student.html | 693 | button | Konfirmasi Jadwal Sesi | Inline handler | confirmMatchedSession() |
| dashboard-student.html | 701 | button | × | Inline handler | closeActiveModal() |
| dashboard-student.html | 725 | button | Tutup | Inline handler | closeActiveModal() |
| dashboard-student.html | 726 | button | Kirim Evaluasi | Inline handler | submitReview() |
| dashboard-student.html | 739 | button | × | Inline handler | closeGatewayScreen() |
| dashboard-student.html | 760 | button | Simulasikan Bayar Berhasil (Simulator) | Inline handler | completeGatewaySimulation() |
| dashboard-student.html | 763 | button | Batalkan Pembayaran | Inline handler | closeGatewayScreen() |
| dashboard-student.html | 776 | button | × | Inline handler | closeActiveModal() |
| dashboard-student.html | 809 | button | Batal | Inline handler | closeActiveModal() |
| dashboard-student.html | 810 | button | Konfirmasi & Bayar | Inline handler | processPayment() |
| dashboard-tutor.html | 21 | a | T platform Portal Pengajar | Tautan/navigasi | index.html |
| dashboard-tutor.html | 32 | a | Beranda | Tautan/navigasi | #beranda |
| dashboard-tutor.html | 38 | a | Jadwal Mengajar 3 | Tautan/navigasi | #jadwal |
| dashboard-tutor.html | 45 | a | Atur Ketersediaan | Tautan/navigasi | #ketersediaan |
| dashboard-tutor.html | 51 | a | Check-in Sesi | Tautan/navigasi | #checkin |
| dashboard-tutor.html | 59 | a | Dompet & Honor | Tautan/navigasi | #keuangan |
| dashboard-tutor.html | 65 | a | Riwayat Pertemuan | Tautan/navigasi | #riwayat |
| dashboard-tutor.html | 73 | a | Profil Pengajar | Tautan/navigasi | #profil |
| dashboard-tutor.html | 79 | a | Berkas Kualifikasi | Tautan/navigasi | #berkas |
| dashboard-tutor.html | 85 | a | Pengaturan | Tautan/navigasi | #pengaturan |
| dashboard-tutor.html | 94 | a | Keluar | Tautan/navigasi | login.html |
| dashboard-tutor.html | 116 | button | Toggle Menu | Listener sidebar | initSidebar() dari js/main.js |
| dashboard-tutor.html | 125 | button | (ikon/tanpa label) | Inline handler | toggleTutorNotifs(event) |
| dashboard-tutor.html | 134 | button | Tandai dibaca | Inline handler | markAllTutorNotifsRead() |
| dashboard-tutor.html | 174 | button | Tarik Saldo Rekening | Inline handler | openWithdrawModal() |
| dashboard-tutor.html | 177 | button | Riwayat Honor | Inline handler | switchTutorTab('keuangan') |
| dashboard-tutor.html | 257 | button | Mulai Check-in | Inline handler | handleCheckin() |
| dashboard-tutor.html | 385 | button | Atur Ketersediaan Hari | Inline handler | switchTutorTab('ketersediaan') |
| dashboard-tutor.html | 413 | button | Edit Slot Jadwal | Inline handler | openAvailabilityModal() |
| dashboard-tutor.html | 474 | button | Mulai Check-in Sesi Ini | Inline handler | handleCheckin() |
| dashboard-tutor.html | 487 | button | Tarik Saldo Rekening | Inline handler | openWithdrawModal() |
| dashboard-tutor.html | 496 | button | Tarik Saldo ke Rekening | Inline handler | openWithdrawModal() |
| dashboard-tutor.html | 562 | button | Simpan Rekening & Kontak | Inline handler | saveTutorProfile() |
| dashboard-tutor.html | 627 | button | Ubah Kata Sandi | Inline handler | changeTutorPassword() |
| dashboard-tutor.html | 645 | button | × | Inline handler | closeTutorModal() |
| dashboard-tutor.html | 664 | button | Tarik Semua | Inline handler | setWithdrawAll() |
| dashboard-tutor.html | 671 | button | Batal | Inline handler | closeTutorModal() |
| dashboard-tutor.html | 672 | button | Konfirmasi Pencairan | Inline handler | processWithdrawal() |
| dashboard-tutor.html | 680 | button | × | Inline handler | closeTutorModal() |
| dashboard-tutor.html | 706 | button | Pilih foto bukti | Inline handler | triggerPhotoUpload() |
| dashboard-tutor.html | 738 | button | Batal | Inline handler | closeTutorModal() |
| dashboard-tutor.html | 739 | button | Check-out & Ajukan Tinjauan | Inline handler | submitLessonReport() |
| dashboard-tutor.html | 747 | button | × | Inline handler | closeTutorModal() |
| dashboard-tutor.html | 778 | button | Batal | Inline handler | closeTutorModal() |
| dashboard-tutor.html | 779 | button | Simpan Jadwal | Inline handler | saveAvailability() |
| dashboard-staff.html | 13 | a | P Portal Les Privat Semarang | Tautan/navigasi | index.html |
| dashboard-staff.html | 13 | button | Keluar | Listener logout | data-logout di js/api.js |
