"use client";

import { useState } from "react";
import Link from "next/link";
import { socialLinks, footerLocations } from "@/lib/data";

export default function Footer() {
  const [email, setEmail] = useState("");
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-black/10 bg-linear-to-b from-[#D4DCE2] to-[#EBEBEB] text-black">
      <div className="border-b border-black/10 px-6 pb-10 pt-20 text-center md:px-16 lg:px-24 xl:px-32">
        <div className="max-w-3xl mx-auto">
          <h2 className="mb-4 text-xl font-medium uppercase tracking-[0.25em] text-black md:text-2xl">
            JOIN THE NEWSLETTER
          </h2>
          <p className="mb-10 text-sm font-light tracking-wide text-black/65">
            To keep up to date with all things Monarch, sign up below and become
            the first to know!
          </p>

          <form
            className="mx-auto flex max-w-137.5 flex-col gap-2 shadow-sm sm:flex-row sm:gap-0"
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
              className="min-h-13 flex-1 border border-black/10 bg-white px-5 py-4 text-xs tracking-widest text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black/15 sm:border-r-0"
            />
            <button
              type="submit"
              className="min-h-13 bg-black px-10 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-gray-900"
            >
              SUBSCRIBE NOW
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-374 mx-auto px-6 md:px-16 lg:px-24 xl:px-32 pt-10 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 items-start">
          <div className="flex flex-col items-start">
            <h3 className="mb-4 text-4xl font-black tracking-[0.08em]">
              MONARCH
            </h3>
            <ul className="grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-700">
              {socialLinks.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target={s.href.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex min-h-10 items-center justify-center border border-black/10 px-3 text-center transition-colors hover:border-black hover:text-black"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[10px] tracking-widest text-gray-500 mt-12">
              © {currentYear}, Monarch Barber
            </p>
          </div>

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

      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="absolute bottom-10 right-10 hidden h-12 w-12 items-center justify-center bg-black text-white shadow-2xl transition-transform hover:scale-105 md:inline-flex"
        aria-label="Kembali ke atas"
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
