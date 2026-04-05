export interface NavItem {
  label: string;
  href: string;
  external?: boolean;
  children?: NavItem[];
}

export interface Barber {
  name: string;
  image: string;
  bookingUrl: string;
}

export interface ServiceItem {
  name: string;
  description: string;
  price: number;
  currency: "Rp" | "€" | "$" | "£";
}

export interface PriceTab {
  id: string;
  label: string;
  services: ServiceItem[];
}

export interface BarbershopLocation {
  city: string;
  href: string;
  description: string;
  bookingUrl: string;
  order: string;
}

export interface LocationPageData {
  // Meta
  metaTitle: string;
  metaDescription: string;

  // Hero
  cityName: string;
  heroImage: string;

  // About
  aboutTitle: string;
  aboutParagraphs: string[];

  // Team
  teamBgColor: string;
  barbers: Barber[];

  // Price
  priceTabs: PriceTab[];
  priceImage: string;

  // Booking
  bookingLocation: string;

  // Cancellation
  cancellationImage: string;

  // Gallery
  galleryImages: string[];
}