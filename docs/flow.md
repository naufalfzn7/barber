# Manual Browser Test Flows

Dokumen ini berisi skenario uji manual di browser untuk role USER/MEMBER, ADMIN, dan SUPER_ADMIN.

## 1. Lingkup Dan Tujuan

- Validasi flow autentikasi dan redirect per role.
- Validasi flow operasional utama per role.
- Validasi guard akses antar role.
- Validasi integrasi UI ke API (bukan sekadar tampilan statis).

## 2. Environment Dan Data Uji

- Base URL: `http://127.0.0.1:3000`
- Browser: Chrome (Incognito disarankan untuk isolasi session)
- Data akun seed default:
  - MEMBER: `member.demo@monarchbarber.id` / `Monarch123!`
  - ADMIN: `admin.ska@monarchbarber.id` / `Monarch123!`
  - SUPER_ADMIN: `owner@monarchbarber.id` / `Monarch123!`

## 3. Aturan Eksekusi Manual

- Jalankan test per role di tab incognito terpisah atau logout antar skenario.
- Untuk skenario yang membuat data (booking, movement, holiday), catat ID/kode data yang terbentuk.
- Jika ada skenario gagal, simpan screenshot halaman dan response error dari Network tab.

## 3.1 Rules Umum Per Halaman

- Setiap halaman harus menampilkan data live dari API, bukan data statis atau dummy.
- Jika data berubah di server setelah user memilih slot atau melakukan aksi, UI harus menolak submit dan menampilkan pesan yang jelas.
- Jika ada rules khusus halaman, tulis dan baca sebelum test supaya hasil uji konsisten.
- Bila pesan error muncul, anggap itu bagian dari rule bisnis jika memang data terakhir sudah tidak valid.

### Contoh Rule Reservasi

- Slot booking dihitung real-time terhadap service, barberman, jadwal operasional, holiday, dan booking lain.
- Satu slot yang sudah dipakai tidak boleh dipakai lagi untuk barberman yang sama.
- Jika ada booking yang sudah dibuat pada jam `10.00`, lalu user mencoba membuat walk-in lain pada `10.30` dan sistem mendeteksi overlap/konflik jadwal, maka booking harus ditolak.
- Pesan seperti `Selected slot is no longer available` berarti slot yang dipilih sudah tidak valid pada saat submit, walaupun sebelumnya sempat terlihat tersedia. Di UI modern, pesan ini harus muncul lewat toast, bukan banner manual.
- Intinya: yang menentukan boleh atau tidak adalah kondisi server saat tombol submit ditekan, bukan hanya tampilan awal di UI.

---

## 4. Flow USER/MEMBER

### U-M01 - Login Member Dan Redirect

Langkah:

1. Buka `/login`.
2. Login dengan akun MEMBER.

Expected:

1. Redirect ke `/reservasi`.
2. Header menampilkan identitas user login (nama + role Member).

### U-M02 - Load Katalog Booking Dan Riwayat

Langkah:

1. Di halaman `/reservasi`, cek dropdown cabang dan layanan.
2. Cek panel riwayat booking.

Rules:

1. Data cabang dan layanan harus diambil dari API catalog.
2. Riwayat booking boleh kosong, tapi tidak boleh error atau berisi data palsu.

Expected:

1. Daftar cabang dan layanan muncul (bukan kosong).
2. Riwayat booking tampil atau state kosong yang valid.

### U-M03 - Cek Slot Tersedia

Langkah:

1. Pilih cabang.
2. Pilih layanan.
3. Pilih tanggal valid.
4. Klik tombol `Cek Slot`.

Rules:

1. Slot hanya muncul kalau cabang, layanan, tanggal, jam operasional, jadwal barberman, dan holiday semuanya masih valid.
2. Slot yang sudah terisi booking lain harus hilang atau tidak bisa dipilih.
3. Jika server menolak karena overlap, itu berarti rule bisnis berhasil dijalankan.

Expected:

1. Slot waktu tampil jika tersedia.
2. Jika tidak tersedia, muncul pesan yang jelas.

### U-M04 - Buat Booking Member

Langkah:

1. Lanjut dari U-M03.
2. Pilih salah satu slot.
3. Klik `Book Sekarang`.

Rules:

1. Sistem harus melakukan validasi ulang saat submit.
2. Kalau slot sudah dipakai booking lain setelah user membuka halaman, submit wajib ditolak.
3. Pesan `Selected slot is no longer available` artinya slot yang dipilih sudah kalah race-condition dengan booking lain dan harus tampil sebagai toast.
4. Untuk contoh kasus walk-in: jika sudah ada booking `UPCOMING` di jam `10.00`, lalu admin menambah walk-in lagi di jam `10.30` dan server mendeteksi jadwal tumpang tindih, booking harus gagal dengan pesan tersebut.

Expected:

1. Muncul pesan sukses booking.
2. Riwayat booking bertambah item baru.
3. Data baru terlihat setelah refresh riwayat.

### U-M05 - Guard Akses Halaman Admin

Langkah:

1. Saat masih login sebagai MEMBER, buka `/admin/dashboard`.
2. Buka `/superadmin/dashboard`.

Expected:

1. Tidak bisa masuk halaman admin/superadmin.
2. User di-redirect sesuai policy (ke home/login).

---

## 5. Flow ADMIN

### U-A01 - Login Admin Dan Redirect

Langkah:

1. Buka `/login`.
2. Login dengan akun ADMIN.

Expected:

1. Redirect ke `/admin/dashboard`.
2. Header/sidebar admin tampil normal.

### U-A02 - Dashboard Reservasi Harian

Langkah:

1. Buka `/admin/reservasi`.
2. Perhatikan daftar booking harian.

Rules:

1. Data yang tampil harus sesuai cabang admin yang login.
2. Booking harian harus berasal dari API, bukan array lokal.

Expected:

1. Data booking harian termuat.
2. Tidak ada error fetch di UI.

### U-A03 - Create Walk-In Booking

Langkah:

1. Dari halaman reservasi admin, isi form walk-in.
2. Submit booking.

Rules:

1. Walk-in diperlakukan sebagai booking record penuh, bukan data terpisah.
2. Kalau jam yang dipilih bentrok dengan booking atau jadwal barberman, submit harus ditolak.
3. Jika slot berubah setelah form diisi, server tetap menjadi sumber kebenaran terakhir.

Expected:

1. Booking walk-in berhasil dibuat.
2. Booking muncul di daftar harian.

### U-A04 - Ubah Status Booking Berurutan

Langkah:

1. Pilih booking dengan status `UPCOMING`.
2. Ubah ke `IN_PROGRESS`.
3. Ubah ke `COMPLETED`.

Expected:

1. Transisi `UPCOMING -> IN_PROGRESS -> COMPLETED` berhasil.
2. Transisi lompat langsung ditolak (jika dicoba via UI/API helper).

### U-A05 - Pembayaran Cash

Langkah:

1. Gunakan booking status `IN_PROGRESS`.
2. Trigger pembayaran `CASH`.
3. Input nominal bayar >= amount due.

Rules:

1. Pembayaran cash hanya boleh untuk booking yang memang siap dibayar.
2. Nominal bayar tidak boleh kurang dari total tagihan.
3. Setelah payment sukses, booking harus otomatis selesai dan detail payment harus tercatat.

Expected:

1. Status payment menjadi `PAID`.
2. Status booking menjadi `COMPLETED`.
3. Detail payment menampilkan `amount_due`, `amount_paid`, `change_amount`.

### U-A06 - Inventory Basic Flow

Langkah:

1. Buka `/admin/stok`.
2. Tambah item baru.
3. Lakukan movement `OUT` atau `IN`.
4. Ubah minimum stock inline lalu simpan.
5. Buka histori movement item.

Expected:

1. Item baru tersimpan.
2. Movement tercatat dan stock berubah.
3. Histori movement menampilkan before/after qty.
4. Update minimum stock tersimpan.

### U-A07 - Tambah Produk Ke Reservasi

Langkah:

1. Buka `/admin/reservasi`.
2. Pilih booking status `UPCOMING` atau `IN_PROGRESS`.
3. Klik tombol `Produk`.
4. Pilih item produk + quantity, lalu klik `Tambah Produk`.
5. Verifikasi item muncul di rincian layanan booking.
6. Lakukan pembayaran `CASH` atau `QRIS`.

Rules:

1. Produk hanya bisa ditambah/hapus saat status booking masih `UPCOMING` atau `IN_PROGRESS`.
2. Stok produk harus dikurangi saat produk ditambahkan ke booking.
3. Jika stok tidak cukup, aksi harus ditolak dengan pesan yang jelas.
4. Total tagihan harus dihitung: harga layanan + subtotal semua produk.
5. Jika produk dihapus dari booking sebelum dibayar, stok harus kembali.

Expected:

1. Produk berhasil masuk ke booking.
2. Total tagihan booking bertambah sesuai produk.
3. Histori movement stok tercatat dengan reference booking.
4. Payment `amount_due` mencerminkan total terbaru (layanan + produk).

### U-A08 - Guard Scope Branch Untuk Admin

Langkah:

1. Coba akses data lintas cabang lewat query branch lain (via URL/DevTools request).

Expected:

1. Request ditolak (`403`) untuk branch yang bukan scope admin.

---

## 6. Flow SUPER_ADMIN

### U-S01 - Login Super Admin Dan Redirect

Langkah:

1. Buka `/login`.
2. Login dengan akun SUPER_ADMIN.

Expected:

1. Redirect ke `/superadmin/dashboard`.
2. Menu superadmin lengkap tampil.

### U-S02 - Scheduling: Load Data Cabang

Langkah:

1. Buka `/superadmin/pengaturan`.
2. Ganti pilihan cabang.

Rules:

1. Semua pengaturan di halaman ini harus mengikuti cabang yang sedang dipilih.
2. Jika cabang berubah, data operasional, jadwal barber, dan holiday harus ikut berganti.

Expected:

1. Data jam operasional, jadwal barber, dan holiday ikut berubah sesuai cabang.
2. Tidak ada error fetch.

### U-S03 - Scheduling: Update Operating Hours

Langkah:

1. Di tab `Jam Operasional`, ubah salah satu hari.
2. Simpan perubahan.

Expected:

1. Muncul pesan sukses.
2. Setelah reload halaman, nilai jam tetap sesuai perubahan.

### U-S04 - Scheduling: Tambah Jadwal Barber

Langkah:

1. Di tab `Jadwal Barber`, isi barberman, tanggal, jam start/end.
2. Simpan.

Expected:

1. Jadwal tersimpan.
2. Daftar jadwal menampilkan entri baru.

### U-S05 - Scheduling: Tambah Dan Hapus Holiday

Langkah:

1. Di tab `Libur`, tambah holiday full-day.
2. Verifikasi holiday muncul di daftar.
3. Hapus holiday tersebut.

Expected:

1. Create holiday berhasil.
2. Delete holiday berhasil.
3. Daftar holiday ter-update setelah aksi.

### U-S06 - Validasi Slot Tertutup Saat Holiday

Langkah:

1. Buat holiday full-day untuk suatu tanggal.
2. Login sebagai MEMBER (session lain).
3. Di `/reservasi`, cek slot pada tanggal tersebut.

Rules:

1. Holiday full-day menutup slot untuk tanggal tersebut.
2. Setelah holiday dihapus, slot boleh muncul lagi sesuai jadwal normal.

Expected:

1. Slot kosong atau tertutup pada tanggal holiday full-day.
2. Setelah holiday dihapus, slot kembali normal.

### U-S07 - Guard Akses API Scheduling

Langkah:

1. Login sebagai ADMIN.
2. Coba akses endpoint scheduling superadmin (misalnya dari Network/DevTools).

Expected:

1. Ditolak (`403 Forbidden`).

---

## 7. Flow Cross-Role Dan Navigasi Publik

### U-X01 - Halaman Publik Tidak 404

Langkah:

1. Buka `/contact`.
2. Buka `/about-us`.
3. Buka `/gallery`, `/services`, `/surakarta`, `/yogyakarta`.

Expected:

1. Semua halaman terbuka tanpa 404.
2. Link header/footer menuju halaman valid.

### U-X02 - Logout Flow

Langkah:

1. Login sebagai MEMBER/ADMIN/SUPER_ADMIN.
2. Klik logout dari menu akun/layout.

Expected:

1. Session cookie dibersihkan.
2. User diarahkan ke halaman publik/login.
3. Halaman terproteksi tidak bisa diakses tanpa login ulang.

---

## 8. Defect Logging Template

Gunakan format ini untuk setiap temuan bug:

- ID: `BUG-<tanggal>-<nomor>`
- Role: `MEMBER|ADMIN|SUPER_ADMIN`
- Halaman/Route:
- Langkah reproduksi:
- Expected:
- Actual:
- Severity: `Low|Medium|High|Critical`
- Bukti: screenshot + response API (jika ada)
