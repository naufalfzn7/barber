# Payment Test Scripts (Xendit Invoices)

Dokumen ini berisi script dan langkah tes untuk alur pembayaran Xendit Invoices/Checkout Link yang sekarang dipakai aplikasi.

## Ringkasan Flow Baru

1. Member membuat booking deposit dari halaman reservasi.
2. Sistem membuat Xendit Invoice dan menampilkan tombol pembayaran menuju checkout link Xendit.
3. Setelah pembayaran berhasil, Xendit redirect ke halaman khusus: `/reservasi/pembayaran-sukses`.
4. Halaman sukses ini menampilkan pesan sekali saja, lalu auto kembali ke `/reservasi` setelah beberapa detik.
5. Status booking dan payment tetap disinkronkan lewat webhook Xendit ke backend.

## Perubahan yang Perlu Diingat

- Tidak ada lagi alur QR code image sebagai sumber utama pembayaran.
- `invoice_url` dari Xendit dipakai sebagai link checkout.
- Redirect sukses tidak lagi mengarah ke halaman booking biasa, supaya tidak muncul dua pop-up sukses sekaligus.
- Halaman admin reservasi tetap bisa memantau status payment, tetapi tidak lagi menampilkan modal sukses QRIS dari polling.

## 1. Prasyarat

- Jalankan app dulu: `npm run dev`
- Pastikan `APP_URL` dan `XENDIT_CALLBACK_URL` sudah benar di `.env`.
- Pastikan booking target sudah punya invoice Xendit yang aktif.

## 2. Setup Variabel Tes

Gunakan booking/payment reference yang benar dari environment lokal kamu.

```bash
PORT=3000
REF="DEPOSIT-BKG-1777251800428-696639-1777251801239"
TOKEN=$(sed -n 's/^XENDIT_WEBHOOK_TOKEN="\(.*\)"/\1/p' .env | head -n 1)
```

`REF` di atas harus sama dengan `externalRef` atau `reference_id` invoice yang sedang kamu uji.

## 3. Simulasi Pembayaran Berhasil

Pakai ini untuk mensimulasikan event `PAID` dari Xendit webhook.

```bash
curl -i -X POST "http://127.0.0.1:${PORT}/api/payments/webhook/xendit" \
  -H "Content-Type: application/json" \
  -H "x-callback-token: ${TOKEN}" \
  -d "{\"reference_id\":\"${REF}\",\"status\":\"PAID\",\"paid_at\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}"
```

Expected:

- HTTP `200`
- `message: "Webhook processed"`
- Booking berubah menjadi `COMPLETED` setelah sinkronisasi backend.

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

- Status payment menjadi `EXPIRED` atau `FAILED`.
- Booking tetap di `PAYMENT_PENDING` sampai user retry atau bayar ulang.

## 5. Cek Status Payment per Booking

Ganti `BOOKING_ID` dengan id booking, bukan booking code.

```bash
BOOKING_ID="cmnl2kcxf0000usvopru0wpfa"
curl -i "http://127.0.0.1:${PORT}/api/payments/booking/${BOOKING_ID}"
```

Catatan:

- Endpoint ini butuh sesi login `ADMIN` atau `SUPER_ADMIN`.
- Paling mudah cek dari browser yang sudah login, via Network tab.

## 6. Retry Pembayaran Xendit

Jika payment expired atau gagal, gunakan endpoint retry sesuai `paymentId`.

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
- Invoice/checkout link baru dihasilkan.

## 7. Verifikasi Halaman Sukses Redirect

Kalau payment sukses dan user dikirim ke Xendit redirect page, URL yang diharapkan adalah:

```text
/reservasi/pembayaran-sukses?xendit_ref=...&xendit_status=paid
```

Di halaman itu, user akan melihat pesan:

- `Pembayaran berhasil!`
- Booking reference yang terkonfirmasi
- Pop-up menutup otomatis lalu kembali ke `/reservasi`

## 8. Quick One-Liner (PAID)

```bash
TOKEN=$(sed -n 's/^XENDIT_WEBHOOK_TOKEN="\(.*\)"/\1/p' .env | head -n 1) && curl -i -X POST "http://127.0.0.1:3000/api/payments/webhook/xendit" -H "Content-Type: application/json" -H "x-callback-token: ${TOKEN}" -d '{"reference_id":"QRIS-702567890431-MNL2L57K","status":"PAID","paid_at":"2026-04-05T10:00:00.000Z"}'
```

## 9. Troubleshooting Cepat

- `401 Invalid webhook token`: token header tidak cocok dengan `.env`.
- `Payment reference not found`: reference belum tercatat atau salah.
- UI tidak berubah: pastikan halaman booking/admin masih terbuka dan tunggu polling backend.
- Halaman sukses tidak muncul: cek `APP_URL` dan `success_redirect_url` invoice mengarah ke `/reservasi/pembayaran-sukses`.
- Port salah: cek log `next dev`, gunakan port yang sedang aktif.
