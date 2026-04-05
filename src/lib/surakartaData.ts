import { LocationPageData } from "@/types";
import { defaultPriceTabs } from "@/lib/data/sharedPriceTabs";

const surakartaData: LocationPageData = {
  metaTitle: "Monarch Barber Surakarta — Best Haircut in Surakarta",
  metaDescription:
    "Monarch Barber Surakarta — Premium barbershop experience in the heart of Solo. Nikmati layanan haircut, beard trim, dan shave terbaik. Book your appointment today.",

  cityName: "SURAKARTA",
  heroImage: "/images/surakarta/hero-surakarta.jpg",

  aboutTitle: "ABOUT MONARCH SURAKARTA",
  aboutParagraphs: [
    "Monarch Surakarta berlokasi di kawasan Laweyan, Surakarta — sebuah area dinamis yang merepresentasikan perpaduan antara warisan budaya dan gaya hidup modern.",
    "Berdiri sejak tahun 1998, Monarch Surakarta telah berkembang menjadi destinasi grooming premium yang mengedepankan presisi, kenyamanan, dan kualitas dalam setiap layanan.",
    "Kami menghadirkan rangkaian layanan grooming pria yang dirancang secara profesional — dimulai dari konsultasi personal, proses pengerjaan yang detail, hair wash, hot towel, hingga finishing yang rapi dan presisi menciptakan pengalaman grooming yang eksklusif dan berkelas.",
  ],

  teamBgColor: "#9EB3BC",

  barbers: [
    {
      name: "Evelyn",
      image: "/images/barbers/barber1.jpg",
      bookingUrl: "/reservasi",
    },
    {
      name: "Joel",
      image: "/images/barbers/barber2.webp",
      bookingUrl: "/reservasi",
    },
    {
      name: "Lloyd",
      image: "/images/barbers/barber3.jpg",
      bookingUrl: "/reservasi",
    },
    {
      name: "Sammy",
      image: "/images/barbers/barber4.png",
      bookingUrl: "/reservasi",
    },
  ],

  // Shared price tabs — override di sini jika harga Surakarta berbeda
  priceTabs: defaultPriceTabs,

  priceImage: "/images/surakarta/price.jpg", // ✅ fixed: was /yogyakarta/price.jpg
  cancellationImage: "/images/surakarta/cancel.jpg",
  bookingLocation: "Laweyan — Monarch Surakarta",

  galleryImages: [
    "/images/surakarta/1.jpg",
    "/images/surakarta/2.jpg",
    "/images/surakarta/3.jpg",
  ],
};

export default surakartaData;
