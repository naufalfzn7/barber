# Server MVC Baseline

Folder `src/server` mengikuti pendekatan MVC + layered architecture untuk backend Next.js Route Handlers.

## Struktur

- `controllers/`
  - Adapter HTTP untuk Route Handlers.
  - Parsing request/response, panggil service, mapping error ke status code.
- `services/`
  - Business logic utama use case.
  - Tidak mengakses HTTP langsung.
- `repositories/`
  - Akses data via Prisma.
  - Query dan transaction boundary.
- `validators/`
  - Validasi input/output DTO.
- `policies/`
  - RBAC/ABAC policy check per aksi.
- `core/`
  - Shared concern: env, error class, constants.
- `db/`
  - Inisialisasi Prisma Client.

## Role Strategy

Role utama:

- `MEMBER`
- `ADMIN`
- `SUPER_ADMIN`

Prinsip:

- Route API dikelompokkan per domain (`auth`, `booking`, `payment`, dll), bukan per role.
- Role enforcement berada di middleware/policy, bukan path naming.
- Endpoint sensitif wajib melakukan auth + policy check.
