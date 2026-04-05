"use client";

import { useState } from "react";
import Link from "next/link";
import { socialLinks, footerLocations } from "@/lib/data";

export default function Footer() {
  const [email, setEmail] = useState("");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-linear-to-b from-[#D4DCE2] to-[#EBEBEB] text-black">
      {/* --- SECTION NEWSLETTER --- */}
      <div className="pt-20 pb-10 px-6 md:px-16 lg:px-24 xl:px-32 text-center border-b border-gray-300/40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl md:text-2xl tracking-[0.25em] font-medium mb-4 uppercase text-black">
            JOIN THE NEWSLETTER
          </h2>
          <p className="text-sm mb-10 tracking-wide font-light">
            To keep up to date with all things Nomad, sign up below and become
            the first to know!
          </p>

          <form
            className="flex flex-col sm:flex-row gap-0 max-w-137.5 mx-auto shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              setEmail("");
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail"
              required
              className="flex-1 px-5 py-4 bg-white text-black placeholder-gray-400 text-xs tracking-widest focus:outline-none"
            />
            <button
              type="submit"
              className="px-10 py-4 bg-black text-white text-[10px] tracking-[0.2em] font-bold hover:bg-gray-900 transition-colors whitespace-nowrap uppercase"
            >
              SUBSCRIBE NOW
            </button>
          </form>
        </div>
      </div>

      {/* --- MAIN FOOTER SECTION --- */}
      <div className="max-w-374 mx-auto px-6 md:px-16 lg:px-24 xl:px-32 pt-10 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 items-start">
          {/* KOLOM 1: NOMAD (Pojok Kiri) */}
          <div className="flex flex-col items-start">
            <h3 className="text-4xl font-black tracking-tighter mb-4">NOMAD</h3>
            <ul className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] tracking-[0.15em] font-medium text-gray-800">
              {socialLinks.map((s, index) => (
                <li key={s.label} className="flex items-center gap-2">
                  <a
                    href={s.href}
                    className="hover:text-black transition-colors"
                  >
                    {s.label}
                  </a>
                  {index < socialLinks.length - 1 && (
                    <span className="text-gray-400 font-light">|</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-[10px] tracking-widest text-gray-500 mt-12">
              © {currentYear}, Nomad Barber
            </p>
          </div>

          {/* KOLOM 2: SUPPORT (Posisi Tengah, Teks Rata Kiri) */}
          <div className="lg:mx-auto min-w-30">
            <h4 className="text-[13px] tracking-[0.15em] font-bold mb-6 uppercase text-black">
              SUPPORT
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  href="/contact"
                  className="text-[12px] tracking-widest font-medium text-gray-700 hover:text-black uppercase"
                >
                  GET IN TOUCH
                </Link>
              </li>
            </ul>
          </div>

          {/* KOLOM 3: QUICK LINKS (Posisi Tengah, Teks Rata Kiri) */}
          <div className="lg:mx-auto min-w-30">
            <h4 className="text-[13px] tracking-[0.15em] font-bold mb-6 uppercase text-black">
              QUICK LINKS
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  href="/about-us"
                  className="text-[12px] tracking-widest font-medium text-gray-700 hover:text-black uppercase"
                >
                  ABOUT US
                </Link>
              </li>
            </ul>
          </div>

          {/* KOLOM 4: BARBERSHOPS (Pojok Kanan, Teks Tetap Rata Kiri) */}
          <div className="lg:ml-auto min-w-30">
            <h4 className="text-[13px] tracking-[0.15em] font-bold mb-6 uppercase text-black text-left">
              BARBERSHOPS
            </h4>
            <ul className="space-y-4 text-left">
              {footerLocations.map((loc) => (
                <li key={loc.label}>
                  <Link
                    href={loc.href}
                    className="text-[12px] tracking-widest font-medium text-gray-700 hover:text-black transition-colors uppercase"
                  >
                    {loc.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Back to Top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="absolute bottom-10 right-10 bg-black text-white w-12 h-12 rounded-full items-center justify-center shadow-2xl hover:scale-110 transition-transform hidden md:inline-flex"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="3"
        >
          <path d="M5 15l7-7 7 7" strokeLinecap="square" />
        </svg>
      </button>
    </footer>
  );
}
