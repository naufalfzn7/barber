# Performance Audit

Tanggal audit: 2026-06-06

## Ringkasan

Project memakai Next.js 16.2.1 App Router. Sebelum refactor, `cacheComponents` belum aktif dan beberapa page publik membaca `cookies()` hanya untuk menentukan CTA login/reservasi sehingga route publik menjadi request-time/dynamic.

Masalah utama refetch sebelumnya ada di sisi client: `src/lib/authClient.ts` memberi default `cache: "no-store"` untuk semua `authFetch()`. Akibatnya semua GET interaktif, termasuk data yang relatif stabil seperti catalog, branch, service, barberman, admin list, settings, dan profile bootstrap, selalu bypass cache browser dan dipanggil ulang saat mount ulang/refresh/navigasi.

TanStack Query sebelumnya belum terpasang dan belum digunakan (`@tanstack/react-query` tidak ada di `package.json`). Jadi belum ada `staleTime`, `refetchOnWindowFocus`, atau dedupe query client-side.

## Status Refactor

Selesai pada 2026-06-06:

- `cacheComponents: true` aktif di `next.config.ts`.
- `@tanstack/react-query` ditambahkan dan dipasang via root provider.
- Default TanStack Query diset agar tidak refetch otomatis saat window focus/mount ulang.
- `authFetch()` tidak lagi global `no-store`; GET sekarang punya cache client 60 detik dan otomatis clear setelah mutation.
- Event data/auth change sekarang menghapus cache `authFetch` dan invalidate TanStack Query.
- Home dan services dipisahkan dari runtime `cookies()`; konten publik bisa masuk static/cache shell.
- CTA reservasi publik dipindah ke Client Component kecil yang membaca session via TanStack Query.
- Dashboard admin dan superadmin dashboard dipindah dari manual `useEffect` fetch ke TanStack Query.
- Payment polling dan slot availability tetap explicit `no-store` agar status pembayaran/jadwal tidak stale.
- Tanggal UI yang memakai `new Date()` dipindah ke client snapshot helper agar kompatibel dengan Cache Components prerender.

## Temuan Utama

### 1. Global client fetch selalu `no-store`

- `src/lib/authClient.ts:20` set default `cache: "no-store"` untuk semua request.
- `src/lib/authClient.ts:7` refresh session memang tepat `no-store`.
- Call site tambahan `no-store` ada di:
  - `src/components/layout/Header.tsx:229`
  - `src/components/features/member/MemberProfilePage.tsx:42`
  - `src/app/admin/layout.tsx:194`

Rekomendasi:
- Jangan set `no-store` global untuk semua `authFetch`.
- Pisahkan helper:
  - `authFetch()` default normal untuk GET stabil.
  - `authFetchFresh()` atau opsi explicit untuk data realtime/session/payment.
- Untuk client interaktif, pindah ke TanStack Query dan beri `staleTime` per domain.

### 2. Banyak fetch client-side via `useEffect`

Jumlah `useEffect` terbanyak:

- `src/app/admin/reservasi/page.tsx` - 7
- `src/components/features/booking/DepositPaymentModal.tsx` - 7
- `src/components/features/booking/MemberBookingPanel.tsx` - 5
- `src/components/layout/Header.tsx` - 3
- `src/app/admin/dashboard/page.tsx` - 2
- `src/app/admin/stok/page.tsx` - 2
- `src/app/admin/keuangan/page.tsx` - 2
- `src/app/admin/member/page.tsx` - 2
- `src/app/superadmin/pengaturan/page.tsx` - 2
- `src/app/superadmin/dashboard/page.tsx` - 1
- `src/app/superadmin/cabang/page.tsx` - 1
- `src/app/superadmin/barberman/page.tsx` - 1
- `src/app/superadmin/layanan/page.tsx` - 1
- `src/app/superadmin/admin/page.tsx` - 1
- `src/app/superadmin/laporan/page.tsx` - 1

Call `authFetch()` terbanyak:

- `src/app/admin/reservasi/page.tsx` - 13
- `src/app/superadmin/pengaturan/page.tsx` - 12
- `src/app/superadmin/admin/page.tsx` - 8
- `src/components/features/booking/MemberBookingPanel.tsx` - 8
- `src/app/admin/member/page.tsx` - 7
- `src/app/admin/stok/page.tsx` - 7
- `src/app/superadmin/barberman/page.tsx` - 5

Rekomendasi prioritas:
- Refactor `admin/reservasi`, `MemberBookingPanel`, `admin/stok`, `admin/dashboard`, dan `superadmin/*` ke TanStack Query.
- Query stabil: catalog, branches, services, barbermen, settings, product catalog.
- Query realtime: booking today, payment status, slots, inventory alerts. Tetap client-side, tapi pakai `staleTime` pendek dan refetch manual/polling terkendali.

### 3. Data publik masih tercampur dengan user-specific cookies

Halaman publik yang membaca `cookies()`:

- `src/app/(user)/page.tsx:15`
- `src/app/(user)/services/page.tsx:228`
- `src/app/(user)/profile/page.tsx:7`

`profile` memang user-specific. Namun home dan services hanya memakai cookie untuk mengubah link/label CTA. Ini membuat konten publik ikut dynamic.

Rekomendasi:
- Jadikan konten publik home/services cacheable/static.
- Pindahkan status auth CTA ke Client Component kecil, atau render link default login lalu biarkan header/session client menyesuaikan.

### 4. Cache Components belum aktif

- `next.config.ts` hanya berisi `turbopack.root`.
- Tidak ada `cacheComponents: true`.
- Tidak ada penggunaan `"use cache"`, `cacheLife()`, atau `cacheTag()` untuk data publik/stabil.
- Sudah ada `revalidateTag()`/`revalidatePath()` di `src/server/core/revalidate.ts`, tetapi belum ada producer cache yang memakai tag tersebut.

Rekomendasi:
- Aktifkan `cacheComponents: true` setelah route publik dipisahkan dari runtime cookies.
- Tambahkan cached server functions untuk catalog publik/stabil, misalnya services/branches/barbermen/settings jika tidak user-specific.
- Pasang `cacheTag("catalog")`, `cacheTag("superadmin")`, `cacheTag("inventory")`, `cacheTag("bookings")` hanya pada data yang benar-benar boleh dishare sesuai scope user/branch.

### 5. API GET stabil belum punya HTTP cache policy

Contoh endpoint yang sering dipanggil ulang dan relatif stabil:

- `src/app/api/bookings/catalog/route.ts`
- `src/app/api/superadmin/branches/route.ts`
- `src/app/api/superadmin/services/route.ts`
- `src/app/api/superadmin/barbermen/route.ts`
- `src/app/api/scheduling/operating-hours/route.ts`
- `src/app/api/scheduling/barber-schedules/route.ts`
- `src/app/api/scheduling/holidays/route.ts`
- `src/app/api/superadmin/settings/deposit/route.ts`

Karena endpoint memakai auth/role, jangan pakai public shared cache sembarangan. Lebih aman cache di TanStack Query client berdasarkan query key dan invalidasi setelah mutation.

### 6. Navigasi internal dan gambar

- Tidak ditemukan `<a href="">` internal yang jelas.
- Navigasi internal mayoritas sudah pakai `next/link` atau `router.replace`.
- `window.location.replace()` hanya ditemukan untuk external/payment flow:
  - `src/app/admin/reservasi/page.tsx:1898`
  - `src/components/features/booking/DepositPaymentModal.tsx:548`
- Tidak ditemukan `<img>` mentah di `src`.
- Gambar sudah memakai `next/image` di page publik dan komponen visual.

## Rencana Refactor Bertahap

1. Tambah TanStack Query provider dengan default:
   - `staleTime: 60_000`
   - `refetchOnWindowFocus: false`
   - `refetchOnMount: false` untuk query stabil, override per query realtime.
2. Ubah `authFetch` agar tidak global `no-store`; pertahankan `no-store` hanya untuk refresh/session/payment status.
3. Refactor query stabil:
   - `/api/bookings/catalog`
   - `/api/superadmin/branches`
   - `/api/superadmin/services`
   - `/api/superadmin/barbermen`
   - `/api/superadmin/settings/*`
4. Refactor query realtime dengan stale time pendek:
   - `/api/bookings/admin/today`
   - `/api/inventory/alerts`
   - `/api/bookings/slots`
   - `/api/payments/status/*`
5. Pisahkan CTA auth di page publik dari konten publik, lalu aktifkan `cacheComponents`.
6. Tambahkan cached Server Component/server functions untuk data publik yang tidak mengandung cookie/user/session.

## Risiko

- Data role/branch tidak boleh masuk cache publik/shared.
- Payment status dan booking status tetap butuh freshness. Gunakan polling atau manual invalidation, bukan cache panjang.
- Mengaktifkan `cacheComponents` sebelum memisahkan `cookies()` di page publik bisa memicu error build atau dynamic streaming yang tidak diinginkan.
