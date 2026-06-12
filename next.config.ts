import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/drofugycg/**",
      },
    ],
  },
  // NONAKTIF SEMENTARA: halaman /services dan /gallery dialihkan ke beranda.
  // Untuk mengaktifkan kembali, hapus blok `redirects` di bawah ini.
  // Memakai 307 (permanent: false) agar tidak di-cache permanen oleh browser.
  async redirects() {
    return [
      { source: "/services", destination: "/", permanent: false },
      { source: "/gallery", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
