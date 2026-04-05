# Payment Test Scripts (QRIS)

Dokumen ini berisi script siap pakai untuk tes alur pembayaran QRIS di environment lokal.

## Update: Sistem Pembayaran Member Baru

Sejak update terbaru, sistem pembayaran deposit untuk member telah ditingkatkan:

- ✅ **Persistent Modal** - Modal pembayaran tetap bisa diakses setelah ditutup
- ✅ **Retry QRIS** - Tombol retry untuk regenerate QR ketika expired/gagal
- ✅ **Booking Status Persisten** - Booking tetap `PAYMENT_PENDING` sampai pembayaran selesai
- ✅ **Copy QR String** - Tombol untuk menyalin QR string jika diperlukan
- ✅ **Auto Polling** - Status pembayaran otomatis ter-update dalam 2 detik
- ✅ **Better UI** - Layout lebih rapi dengan header, footer, dan status info

### Flow Member Booking Baru

1. Member membuat booking baru
2. Modal pembayaran deposit otomatis muncul
3. Member bisa scan QR atau tutup modal (booking tetap pending)
4. Di halaman riwayat booking:
   - **Booking PAYMENT_PENDING** → Muncul tombol **"💳 BAYAR"** (warna merah)
   - **Booking COMPLETED** → Muncul tombol **"🧾 LIHAT NOTA"** (warna hijau)
5. Klik "💳 BAYAR" untuk membuka modal pembayaran kembali
6. Jika QR expired, bisa klik "Retry QRIS" untuk regenerate
7. Setelah dibayar, booking auto berubah ke `COMPLETED`
8. Untuk booking COMPLETED, klik "🧾 LIHAT NOTA" untuk lihat detail pembayaran dan print nota

### Receipt (Nota) Features

- **View Receipt** - Lihat detail pembayaran lengkap termasuk item, total, metode pembayaran
- **Print Receipt** - Cetak nota untuk arsip atau bukti pembayaran
- **Available Only for COMPLETED** - Nota hanya bisa diakses setelah booking selesai (COMPLETED)

## 1. Prasyarat

- Jalankan app dulu: `npm run dev`
- Cek port aktif dari log Next.js (contoh: `3001` jika `3000` sedang dipakai).
- Pastikan booking sudah `PAYMENT_PENDING` dan punya `Reference` QRIS dari modal admin reservasi.

## 2. Set Variabel (Git Bash)

Ganti `PORT` dan `REF` sesuai kondisi tes kamu.

```bash
PORT=3001
REF="QRIS-481139702714-MNL39XBN"
TOKEN=$(sed -n 's/^XENDIT_WEBHOOK_TOKEN="\(.*\)"/\1/p' .env | head -n 1)
```

## 3. Simulasi Pembayaran Berhasil (PAID)

curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/webhook/xendit" \
 -H "Content-Type: application/json" \
 -H "x-callback-token: ${TOKEN}" \
  -d '{
    "reference_id": "'"${REF}"'",
"status": "PAID",
"paid_at": "2026-04-05T10:00:00.000Z"
}'

```bash
curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/webhook/xendit" \
  -H "Content-Type: application/json" \
  -H "x-callback-token: ${TOKEN}" \
  -d "{\"reference_id\":\"${REF}\",\"status\":\"PAID\",\"paid_at\":\"2026-04-05T10:00:00.000Z\"}"
```

Expected:

- HTTP `200`
- `message: "Webhook processed"`
- Dalam 4-5 detik (polling UI), booking berubah ke `COMPLETED`.

## 4. Simulasi Gagal / Kadaluarsa

### 4.1 EXPIRED

```bash
curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/webhook/xendit" \
  -H "Content-Type: application/json" \
  -H "x-callback-token: ${TOKEN}" \
  -d "{\"reference_id\":\"${REF}\",\"status\":\"EXPIRED\"}"
```

### 4.2 FAILED

```bash
curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/webhook/xendit" \
  -H "Content-Type: application/json" \
  -H "x-callback-token: ${TOKEN}" \
  -d "{\"reference_id\":\"${REF}\",\"status\":\"FAILED\"}"
```

Expected:

- Status payment jadi `EXPIRED` atau `FAILED`.
- Tombol `Retry QRIS` di modal aktif.

## 5. Cek Status Payment per Booking

Ganti `BOOKING_ID` dengan id booking (bukan booking code).

```bash
BOOKING_ID="cmnl2kcxf0000usvopru0wpfa"
curl -i "http://127.0.0.1:${PORT}/api/payments/booking/${BOOKING_ID}" \
  -H "Cookie: accessToken=ISI_ACCESS_TOKEN_JIKA_DIPERLUKAN"
```

Catatan:

- Endpoint ini butuh sesi login `ADMIN` atau `SUPER_ADMIN`.
- Paling mudah cek dari browser yang sudah login, via Network tab.

## 6. Retry QRIS via API (Opsional)

Ganti `PAYMENT_ID` dengan id payment saat status `EXPIRED`/`FAILED`.

```bash
PAYMENT_ID="cmnl2l5i10004usvo5nd9v5sr"
curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/qris/retry" \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=ISI_ACCESS_TOKEN_JIKA_DIPERLUKAN" \
  -d "{\"paymentId\":\"${PAYMENT_ID}\"}"
```

Expected:

- HTTP `200`
- `message: "QRIS payment retried"`
- QR string/reference baru dihasilkan.

## 6. Retry QRIS via API (Member bisa retry langsung)

Sebelumnya retry QRIS hanya untuk ADMIN/SUPER_ADMIN. Sekarang MEMBER juga bisa retry pembayaran mereka sendiri.

Ganti `PAYMENT_ID` dengan id payment saat status `EXPIRED`/`FAILED`.

Member bisa langsung click tombol "Retry QRIS" di modal pembayaran deposit, atau via API:

```bash
PAYMENT_ID="cmnl2l5i10004usvo5nd9v5sr"
curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/qris/retry" \
  -H "Content-Type: application/json" \
  -H "Cookie: accessToken=ISI_ACCESS_TOKEN_JIKA_DIPERLUKAN" \
  -d "{\"paymentId\":\"${PAYMENT_ID}\"}"
```

Expected:

- HTTP `200`
- `message: "QRIS payment retried"`
- QR string/reference baru dihasilkan
- Member hanya bisa retry pembayaran mereka sendiri (verified at endpoint layer)

## 7. Quick One-Liner (PAID)

```bash
TOKEN=$(sed -n 's/^XENDIT_WEBHOOK_TOKEN="\(.*\)"/\1/p' .env | head -n 1) && curl -i -X POST "http://127.0.0.1:3001/api/payments/webhook/xendit" -H "Content-Type: application/json" -H "x-callback-token: ${TOKEN}" -d '{"reference_id":"QRIS-702567890431-MNL2L57K","status":"PAID","paid_at":"2026-04-05T10:00:00.000Z"}'
```

## 8. Troubleshooting Cepat

- `401 Invalid webhook token`: token header tidak cocok dengan `.env`.
- `Payment reference not found`: reference QRIS salah atau belum tercatat.
- UI tidak berubah: pastikan page admin reservasi terbuka dan tunggu interval polling 4-5 detik.
- Port salah: cek log `next dev`, gunakan port yang sedang aktif.
