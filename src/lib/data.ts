import { NavItem, BarbershopLocation } from "@/types";

export const navItems: NavItem[] = [
  { label: "HOME", href: "/" },
  {
    label: "BARBERSHOPS",
    href: "#",
    children: [
      { label: "SURAKARTA", href: "/surakarta" },
      { label: "YOGYAKARTA", href: "/yogyakarta" },
    ],
  },
];

export const rightNavItems: NavItem[] = [
  {
    label: "EXPLORE",
    href: "#",
    children: [
      { label: "SERVICES", href: "/services" },
      { label: "GALLERY", href: "/gallery" },
    ],
  },
  { label: "LOGIN", href: "/login" },
  { label: "GET IN TOUCH", href: "/contact" },
];

export const socialLinks = [
  { label: "Facebook", href: "https://www.facebook.com/monarchbarber" },
  { label: "Mail", href: "mailto:hello@monarchbarber.com" },
  { label: "Instagram", href: "https://www.instagram.com/monarchbarber" },
  { label: "YouTube", href: "https://www.youtube.com/monarchbarber" },
];

export const footerLocations = [
  { label: "SURAKARTA", href: "/surakarta" },
  { label: "YOGYAKARTA", href: "/yogyakarta" },
];

export const barbershopLocations: BarbershopLocation[] = [
  {
    city: "SURAKARTA",
    href: "/surakarta",
    description:
      "Monarch Surakarta adalah barbershop premium yang telah berdiri sejak 2014, berlokasi di kawasan Laweyan, Surakarta. Kami menghadirkan layanan grooming terbaik dengan standar tinggi untuk pelanggan setia kami.",
    bookingUrl: "/reservasi",
    order: "1st",
  },
  {
    city: "YOGYAKARTA",
    href: "/yogyakarta",
    description:
      "Monarch Yogyakarta merupakan cabang kedua dari brand Monarch, yang dibuka di kawasan ikonik Malioboro untuk menghadirkan layanan barber premium dengan pengalaman modern di jantung kota.",
    bookingUrl: "/reservasi",
    order: "2nd",
  },
];

export const globeMarkers = [
  { lat: -7.5705, lng: 110.8285, city: "Surakarta (Solo)" },
];
