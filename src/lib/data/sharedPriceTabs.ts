import { PriceTab } from "@/types";

/**
 * Default price tabs shared across all locations.
 * If a location has different pricing, override specific tabs in its data file.
 */
export const defaultPriceTabs: PriceTab[] = [
  {
    id: "services",
    label: "SERVICES",
    services: [
      {
        name: "Haircut",
        description: "Konsultasi, potong, dan styling sesuai karakter Anda.",
        price: 100000,
        currency: "Rp",
      },
      {
        name: "Beard Trim",
        description: "Perapian jenggot presisi dengan gunting dan clipper.",
        price: 60000,
        currency: "Rp",
      },
      {
        name: "Hot Towel Shave",
        description: "Cukur bersih dengan pisau cukur dan handuk panas.",
        price: 85000,
        currency: "Rp",
      },
      {
        name: "Hair Coloring",
        description: "Pewarnaan rambut dengan produk berkualitas tinggi.",
        price: 250000,
        currency: "Rp",
      },
      {
        name: "Hair Braiding",
        description: "Anyaman rambut rapi untuk tampilan yang bold dan unik.",
        price: 350000,
        currency: "Rp",
      },
      {
        name: "Wash and Style",
        description: "Keramas dan styling tanpa potong untuk tampilan instan.",
        price: 40000,
        currency: "Rp",
      },
    ],
  },
  {
    id: "packages",
    label: "PACKAGES",
    services: [
      {
        name: "The Essential",
        description:
          "Haircut + Wash & Style. Tampilan bersih untuk kebutuhan sehari-hari.",
        price: 130000,
        currency: "Rp",
      },
      {
        name: "The Gentleman",
        description:
          "Haircut + Beard Trim. Kombinasi klasik untuk tampilan maskulin dan rapi.",
        price: 150000,
        currency: "Rp",
      },
      {
        name: "The Classic Shave",
        description:
          "Beard Trim + Hot Towel Shave. Pengalaman cukur tradisional yang sesungguhnya.",
        price: 130000,
        currency: "Rp",
      },
      {
        name: "The Executive",
        description:
          "Haircut + Beard Trim + Hot Towel Shave. Satu sesi, tampilan sempurna.",
        price: 220000,
        currency: "Rp",
      },
      {
        name: "The Monarch",
        description:
          "Haircut + Beard Trim + Hot Towel Shave + Scalp Treatment. Pengalaman grooming terlengkap.",
        price: 320000,
        currency: "Rp",
      },
    ],
  },
  {
    id: "treatments",
    label: "TREATMENTS",
    services: [
      {
        name: "Scalp Treatment",
        description: "Detoks dan nutrisi mendalam untuk kulit kepala sehat.",
        price: 120000,
        currency: "Rp",
      },
      {
        name: "Hair Perming",
        description: "Keriting permanen untuk tekstur dan volume natural.",
        price: 150000,
        currency: "Rp",
      },
      {
        name: "Hair Straightening",
        description: "Pelurusan permanen untuk rambut halus dan mudah diatur.",
        price: 200000,
        currency: "Rp",
      },
      {
        name: "Hair Mask",
        description:
          "Masker intensif untuk rambut lebih kuat, lembut, dan berkilau.",
        price: 100000,
        currency: "Rp",
      },
      {
        name: "Dandruff Treatment",
        description:
          "Perawatan targeted untuk mengatasi ketombe dan iritasi kulit kepala.",
        price: 130000,
        currency: "Rp",
      },
      {
        name: "Head Massage",
        description:
          "Pijat kepala relaksasi untuk meredakan ketegangan dan melancarkan sirkulasi.",
        price: 80000,
        currency: "Rp",
      },
    ],
  },
  {
    id: "products",
    label: "PRODUCTS",
    services: [
      {
        name: "Pomade / Clay",
        description: "Hold kuat, tersedia matte dan glossy.",
        price: 85000,
        currency: "Rp",
      },
      {
        name: "Hair Tonic",
        description: "Nutrisi kulit kepala, segar tanpa lepek.",
        price: 60000,
        currency: "Rp",
      },
      {
        name: "Shampoo & Conditioner",
        description: "Bersih dan lembut untuk penggunaan rutin.",
        price: 70000,
        currency: "Rp",
      },
      {
        name: "Beard Oil",
        description: "Jenggot lebih lembut dengan aroma maskulin.",
        price: 75000,
        currency: "Rp",
      },
    ],
  },
];