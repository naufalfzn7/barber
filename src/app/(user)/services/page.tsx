import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

type ServiceTier = { label: string; price: number; description?: string };

type ServiceItem =
  | { name: string; description: string; price: number; tiers?: never }
  | {
      name: string;
      description: string;
      tiers: ServiceTier[];
      note?: string;
      price?: never;
    };

type ServiceGroup = {
  section: string;
  items: ServiceItem[];
};

const serviceGroups: ServiceGroup[] = [
  {
    section: "Haircut",
    items: [
      {
        name: "Haircut",
        description: "Konsultasi, potong, dan styling sesuai karakter Anda.",
        price: 100000,
      },
      {
        name: "Beard Trim",
        description: "Perapian jenggot presisi dengan gunting dan clipper.",
        price: 60000,
      },
      {
        name: "Hot Towel Shave",
        description: "Cukur bersih dengan pisau cukur dan handuk panas.",
        price: 85000,
      },
    ],
  },
  {
    section: "Hair Coloring",
    items: [
      {
        name: "Hair Coloring",
        description: "Pewarnaan rambut dengan produk berkualitas tinggi.",
        tiers: [
          {
            label: "S",
            price: 150000,
            description:
              "Pewarnaan satu warna untuk rambut pendek. Hasil natural dan tahan lama.",
          },
          {
            label: "M",
            price: 200000,
            description:
              "Pewarnaan satu warna untuk rambut medium. Cocok untuk tampilan bold maupun subtle.",
          },
          {
            label: "L",
            price: 250000,
            description:
              "Pewarnaan penuh untuk rambut panjang atau teknik highlight sederhana.",
          },
          {
            label: "XL",
            price: 350000,
            description:
              "Pewarnaan kompleks untuk rambut sangat panjang atau teknik multi-warna premium.",
          },
        ],
      },
    ],
  },
  {
    section: "Hair Braiding",
    items: [
      {
        name: "Hair Braiding",
        description: "Anyaman rambut rapi untuk tampilan yang bold dan unik.",
        tiers: [
          {
            label: "S",
            price: 200000,
            description:
              "Anyaman sederhana untuk rambut pendek. Cocok untuk tampilan clean dan rapi sehari-hari.",
          },
          {
            label: "M",
            price: 275000,
            description:
              "Anyaman medium untuk rambut sebahu. Lebih banyak detail dan variasi pola.",
          },
          {
            label: "L",
            price: 350000,
            description:
              "Anyaman penuh untuk rambut panjang dengan pola kompleks dan finishing presisi.",
          },
          {
            label: "XL",
            price: 500000,
            description:
              "Full braiding premium untuk rambut sangat panjang. Pola rumit, waktu pengerjaan lebih panjang.",
          },
        ],
      },
    ],
  },
  {
    section: "Wash and Style",
    items: [
      {
        name: "Wash and Style",
        description: "Keramas dan styling tanpa potong untuk tampilan instan.",
        price: 40000,
      },
    ],
  },
];

const packages = [
  {
    name: "The Essential",
    description:
      "Haircut + Wash & Style. Tampilan bersih untuk kebutuhan sehari-hari.",
    price: 130000,
    includes: ["Haircut", "Wash & Style"],
  },
  {
    name: "The Gentleman",
    description:
      "Haircut + Beard Trim. Kombinasi klasik untuk tampilan maskulin dan rapi.",
    price: 150000,
    includes: ["Haircut", "Beard Trim"],
  },
  {
    name: "The Classic Shave",
    description:
      "Beard Trim + Hot Towel Shave. Pengalaman cukur tradisional yang sesungguhnya.",
    price: 130000,
    includes: ["Beard Trim", "Hot Towel Shave"],
  },
  {
    name: "The Executive",
    description:
      "Haircut + Beard Trim + Hot Towel Shave. Satu sesi, tampilan sempurna.",
    price: 220000,
    includes: ["Haircut", "Beard Trim", "Hot Towel Shave"],
  },
  {
    name: "The Monarch",
    description: "Pengalaman grooming terlengkap kami.",
    price: 320000,
    includes: ["Haircut", "Beard Trim", "Hot Towel Shave", "Scalp Treatment"],
  },
];

const treatments = [
  {
    name: "Scalp Treatment",
    description: "Detoks dan nutrisi mendalam untuk kulit kepala sehat.",
    price: 120000,
  },
  {
    name: "Hair Perming",
    description: "Keriting permanen untuk tekstur dan volume natural.",
    price: 150000,
  },
  {
    name: "Hair Straightening",
    description: "Pelurusan permanen untuk rambut halus dan mudah diatur.",
    price: 200000,
  },
  {
    name: "Hair Mask",
    description:
      "Masker intensif untuk rambut lebih kuat, lembut, dan berkilau.",
    price: 100000,
  },
  {
    name: "Dandruff Treatment",
    description:
      "Perawatan targeted untuk mengatasi ketombe dan iritasi kulit kepala.",
    price: 130000,
  },
  {
    name: "Head Massage",
    description:
      "Pijat kepala relaksasi untuk meredakan ketegangan dan melancarkan sirkulasi.",
    price: 80000,
  },
];

const products = [
  {
    name: "Pomade / Clay",
    description: "Hold kuat, tersedia matte dan glossy.",
    price: 85000,
    image: "/images/products/pomade.jpg",
  },
  {
    name: "Hair Tonic",
    description: "Nutrisi kulit kepala, segar tanpa lepek.",
    price: 60000,
    image: "/images/products/tonic.jpg",
  },
  {
    name: "Shampoo & Conditioner",
    description: "Bersih dan lembut untuk penggunaan rutin.",
    price: 70000,
    image: "/images/products/shampoo.jpg",
  },
  {
    name: "Beard Oil",
    description: "Jenggot lebih lembut dengan aroma maskulin.",
    price: 75000,
    image: "/images/products/beard-oil.jpg",
  },
];

const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export default async function ServicesPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("mb_access_token");
  const bookingHref = isAuthenticated
    ? "/reservasi"
    : `/login?next=${encodeURIComponent("/reservasi")}`;

  return (
    <main className="bg-[#EBEBEB] min-h-screen">
      {/* Hero */}
      <section className="relative w-full min-h-100 flex items-center justify-center">
        <Image
          src="/images/shared/service-banners.jpg"
          alt="Services"
          fill
          className="object-cover brightness-50"
          priority
        />
        <h1 className="relative text-white text-5xl md:text-6xl tracking-[0.15em] font-normal uppercase">
          Services
        </h1>
      </section>

      {/* ── Services ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="flex items-end justify-between mb-14 border-b-2 border-black pb-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-normal tracking-widest uppercase text-black">
                Core Services
              </h2>
            </div>
            <Link
              href={bookingHref}
              className="hidden md:inline-flex items-center gap-2 bg-transparent border border-black text-black text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 hover:bg-black hover:text-white transition-all"
            >
              {isAuthenticated ? "Book Now" : "Login To Book"}
            </Link>
          </div>

          <div className="flex flex-col gap-16">
            {serviceGroups.map((group) => (
              <div key={group.section}>
                <div className="flex items-center gap-4 mb-6">
                  <h3 className="text-sm font-bold tracking-[0.25em] uppercase text-black">
                    {group.section}
                  </h3>
                  <div className="flex-1 h-px bg-black/20" />
                </div>

                <div className="divide-y divide-black/10 border-t border-black/10">
                  {group.items.map((s) =>
                    s.tiers ? (
                      s.tiers.map((t) => (
                        <div
                          key={`${s.name}-${t.label}`}
                          className="grid grid-cols-12 items-start gap-4 py-5 px-2 -mx-2"
                        >
                          <div className="col-span-9 border-l-2 border-transparent pl-3">
                            <h4 className="text-base md:text-lg font-bold tracking-wider text-black mb-1 uppercase">
                              {s.name}{" "}
                              <span className="text-black/40 font-medium normal-case tracking-wide text-sm">
                                — {t.label}
                              </span>
                            </h4>
                            {t.description && (
                              <p className="text-xs text-black/60 leading-relaxed max-w-md font-medium">
                                {t.description}
                              </p>
                            )}
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-base md:text-lg font-bold text-black tracking-wider">
                              {fmt(t.price)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        key={s.name}
                        className="grid grid-cols-12 items-start gap-4 py-5 px-2 -mx-2"
                      >
                        <div className="col-span-9 border-l-2 border-transparent pl-3">
                          <h4 className="text-base md:text-lg font-bold tracking-wider text-black mb-1 uppercase">
                            {s.name}
                          </h4>
                          <p className="text-xs text-black/60 leading-relaxed max-w-md font-medium">
                            {s.description}
                          </p>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-base md:text-lg font-bold text-black tracking-wider">
                            {fmt(s.price!)}
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Packages ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#111111] ">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="mb-14 border-b-2 border-white/20 pb-6">
            <p className="text-[10px] tracking-[0.35em] text-white/50 font-bold uppercase mb-2">
              02 — Packages
            </p>
            <h2 className="text-3xl md:text-4xl font-normal tracking-widest uppercase text-white">
              Curated Packages
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((p, i) => (
              <div
                key={p.name}
                className="bg-[#9EB3BC] border border-white/20 p-8 md:p-10 relative flex flex-col justify-between"
              >
                <div className="absolute top-4 right-4 text-white/20 font-mono text-xs">
                  [ PKG // {String(i + 1).padStart(2, "0")} ]
                </div>
                <div className="mt-4">
                  <h3 className="text-xl font-bold tracking-widest uppercase text-white mb-3">
                    {p.name}
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed mb-6 font-medium">
                    {p.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {p.includes.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] font-bold tracking-widest uppercase bg-white/10 text-white px-2 py-1"
                      >
                        + {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-end justify-between border-t border-white/10 pt-6 mt-4">
                  <span className="text-2xl font-bold text-white tracking-wider">
                    {fmt(p.price)}
                  </span>
                  <Link
                    href={bookingHref}
                    className="text-[11px] font-bold tracking-[0.2em] uppercase text-black bg-white px-4 py-2 hover:bg-white/80 transition-colors"
                  >
                    Book
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Treatments ───────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="flex items-end justify-between mb-14 border-b-2 border-black pb-6">
            <div>
              <p className="text-[10px] tracking-[0.35em] text-black/50 font-bold uppercase mb-2">
                03 — Treatments
              </p>
              <h2 className="text-3xl md:text-4xl font-normal tracking-widest uppercase text-black">
                Hair Treatments
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {treatments.map((t) => (
              <div key={t.name} className="bg-white border border-black/15 p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-bold tracking-widest uppercase text-black mb-2">
                      {t.name}
                    </h3>
                    <p className="text-xs text-black/60 leading-relaxed font-medium">
                      {t.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-black text-right border-b border-black pb-1">
                    {fmt(t.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-24 bg-[#1a1a1a] border-t-2 border-black">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8">
          <div className="mb-14 border-b-2 border-white/20 pb-6">
            <p className="text-[10px] tracking-[0.35em] text-white/50 font-bold uppercase mb-2">
              04 — Products
            </p>
            <h2 className="text-3xl md:text-4xl font-normal tracking-widest uppercase text-white">
              Grooming Products
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {products.map((p) => (
              <div key={p.name} className="flex flex-col">
                <div className="relative aspect-square bg-black border border-white/20 mb-5 overflow-hidden">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover opacity-80 grayscale-20"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <div className="absolute top-2 left-2 bg-white text-black text-[9px] font-bold px-2 py-1 uppercase tracking-widest z-10">
                    Stocked
                  </div>
                </div>
                <h3 className="text-sm font-bold tracking-widest uppercase text-white mb-1">
                  {p.name}
                </h3>
                <p className="text-[11px] text-white/50 leading-relaxed mb-3 flex-1 font-medium">
                  {p.description}
                </p>
                <span className="text-sm font-bold text-white tracking-wider border-t border-white/20 pt-2">
                  {fmt(p.price)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section id="book" className="py-24 bg-[#EBEBEB] border-t-8 border-black">
        <div className="max-w-[79.2rem] mx-auto px-4 md:px-8 text-center flex flex-col items-center">
          <div className="w-8 h-8 bg-black mb-6 flex items-center justify-center text-white font-mono text-xs">
            !
          </div>
          <h2 className="text-4xl md:text-5xl font-normal tracking-[0.15em] uppercase text-black mb-6">
            Book Your Session
          </h2>
          <p className="text-sm text-black/60 max-w-md mx-auto mb-10 leading-relaxed font-medium">
            Pilih layanan dan barber favorit Anda. Kami siap memberikan
            pengalaman grooming terbaik.
          </p>
          <Link
            href="/reservasi"
            className="inline-flex items-center gap-3 bg-black text-white text-sm font-bold tracking-[0.25em] uppercase px-12 py-5 hover:bg-transparent hover:text-black hover:shadow-[inset_0_0_0_2px_black] transition-all"
          >
            [ Appointment ]
          </Link>
        </div>
      </section>
    </main>
  );
}
