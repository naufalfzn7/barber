import { LocationPageData } from "@/types";
import { defaultPriceTabs } from "@/lib/data/sharedPriceTabs";

const yogyakartaData: LocationPageData = {
  metaTitle: "Monarch Barber Yogyakarta — Best Haircut in Yogyakarta",
  metaDescription:
    "Monarch Barber Yogyakarta — Premium barbershop di kawasan ikonik Malioboro. Nikmati layanan haircut, beard trim, dan shave profesional. Book your appointment today.", // ✅ fixed: was Berlin copy-paste

  cityName: "YOGYAKARTA",
  heroImage: "/images/yogyakarta/as.jpg",

  aboutTitle: "ABOUT MONARCH YOGYAKARTA",
  aboutParagraphs: [
    "Monarch Yogyakarta berlokasi di jantung kawasan ikonik Malioboro, Kota Yogyakarta.",
    "Didirikan pada tahun 2014, Monarch hadir untuk memberikan pengalaman terbaik dalam perawatan dan grooming pria, dengan memadukan sentuhan klasik dan modern yang terinspirasi dari berbagai penjuru dunia. Sejak awal, Monarch terus berkembang sebagai brand yang berkomitmen menghadirkan kualitas serta pelayanan terbaik bagi setiap pelanggan.",
    "Layanan kami mencakup berbagai kebutuhan perawatan pria, dengan fokus pada kenyamanan, pengalaman, dan detail dalam setiap treatment. Setiap sesi potong rambut dan cukur dilakukan dalam durasi 45 menit, sehingga kami dapat memberikan pelayanan secara maksimal.",
    "Setiap layanan potong rambut sudah termasuk keramas gratis, handuk hangat, serta cukur halus di area leher dengan busa panas. Kami juga mengombinasikan teknik pijat dalam layanan cukur dan perapian jenggot, untuk memberikan pengalaman yang tidak hanya rapi, tetapi juga menyegarkan dan menenangkan.",
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

  // Shared price tabs — override di sini jika harga Yogyakarta berbeda
  priceTabs: defaultPriceTabs,

  priceImage: "/images/yogyakarta/price.jpg",
  cancellationImage: "/images/yogyakarta/cancel.jpg",
  bookingLocation: "Malioboro — Monarch Yogyakarta",

  galleryImages: [
    "/images/yogyakarta/1.jpg",
    "/images/yogyakarta/2.jpg",
    "/images/yogyakarta/3.jpg",
  ],
};

export default yogyakartaData;
