import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/ToastProvider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Monarch Barber",
  description:
    "Award-winning barbershops in Surakarta and Yogyakarta. Book your appointment today.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-poppins antialiased min-h-screen flex flex-col">
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
