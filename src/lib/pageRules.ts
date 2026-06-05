export type RuleEntry = {
  title: string;
  usage: string[];
  forbidden: string[];
  note?: string;
};

export type RuleScope = "user" | "admin" | "superadmin";

type RuleRoute = {
  path: string;
  rule: RuleEntry;
};

export const pageRulesByScope: Record<RuleScope, RuleRoute[]> = {
  user: [],
  admin: [
    {
      path: "/admin/dashboard",
      rule: {
        title: "Dashboard Admin",
        usage: [
          "Pantau ringkasan booking, pendapatan, dan alert stok cabang aktif.",
          "Gunakan sebagai titik cek awal sebelum aksi operasional.",
        ],
        forbidden: [
          "Jangan memakai dashboard sebagai sumber edit data langsung.",
          "Jangan abaikan alert stok rendah yang muncul.",
        ],
      },
    },
    {
      path: "/admin/reservasi",
      rule: {
        title: "Reservasi Harian",
        usage: [
          "Kelola status booking sesuai urutan proses layanan.",
          "Buat walk-in hanya setelah memastikan slot masih valid.",
        ],
        forbidden: [
          "Jangan memaksa booking pada slot yang sudah bentrok.",
          "Jangan loncat status booking di luar transisi yang diizinkan.",
        ],
      },
    },
    {
      path: "/admin/member",
      rule: {
        title: "Kelola Member",
        usage: [
          "Tambahkan member dengan data valid dan unik.",
          "Gunakan reset password hanya saat diminta pemilik akun.",
        ],
        forbidden: [
          "Jangan membuat akun duplikat untuk email yang sama.",
          "Jangan membagikan password sementara ke pihak lain.",
        ],
      },
    },
    {
      path: "/admin/stok",
      rule: {
        title: "Stok Produk",
        usage: [
          "Catat pergerakan IN/OUT sesuai transaksi nyata di cabang.",
          "Perbarui minimum stock agar alert tetap akurat.",
        ],
        forbidden: [
          "Jangan mengubah stok tanpa alasan operasional yang jelas.",
          "Jangan menunda pencatatan movement karena dapat merusak akurasi.",
        ],
      },
    },
    {
      path: "/admin/keuangan",
      rule: {
        title: "Rekap Keuangan",
        usage: [
          "Gunakan halaman ini untuk memantau transaksi yang sudah terekam.",
          "Cek metode bayar dan nominal untuk rekonsiliasi harian.",
        ],
        forbidden: [
          "Jangan mengedit angka keuangan langsung dari tampilan rekap.",
          "Jangan jadikan data pending sebagai pendapatan final.",
        ],
      },
    },
  ],
  superadmin: [
    {
      path: "/superadmin/dashboard",
      rule: {
        title: "Dashboard Superadmin",
        usage: [
          "Pantau performa lintas cabang, alert stok, dan tren pendapatan.",
          "Gunakan sebagai pusat monitoring sebelum mengambil keputusan strategis.",
        ],
        forbidden: [
          "Jangan ambil keputusan tanpa membandingkan data per cabang.",
          "Jangan abaikan alert kritis yang memengaruhi operasional.",
        ],
      },
    },
    {
      path: "/superadmin/cabang",
      rule: {
        title: "Kelola Cabang",
        usage: [
          "Evaluasi performa cabang berdasarkan booking, revenue, dan resource.",
          "Pastikan status aktif/nonaktif cabang sesuai kondisi operasional.",
        ],
        forbidden: [
          "Jangan mengubah kebijakan cabang tanpa validasi data.",
          "Jangan menilai performa dari satu metrik saja.",
        ],
      },
    },
    {
      path: "/superadmin/admin",
      rule: {
        title: "Kelola Admin",
        usage: [
          "Buat dan perbarui akun admin sesuai cabang penugasan.",
          "Gunakan reset password untuk pemulihan akses yang terverifikasi.",
        ],
        forbidden: [
          "Jangan memberi akses admin tanpa cabang yang jelas.",
          "Jangan membiarkan akun tidak aktif tetap memiliki akses.",
        ],
      },
    },
    {
      path: "/superadmin/barberman",
      rule: {
        title: "Kelola Barberman",
        usage: [
          "Atur status aktif barberman sesuai jadwal kerja nyata.",
          "Pastikan data profil barberman lengkap sebelum diaktifkan.",
        ],
        forbidden: [
          "Jangan memindahkan barberman antar cabang tanpa sinkronisasi jadwal.",
          "Jangan menonaktifkan barberman saat masih ada booking aktif.",
        ],
      },
    },
    {
      path: "/superadmin/layanan",
      rule: {
        title: "Kelola Layanan",
        usage: [
          "Atur harga, durasi, dan status layanan per cabang.",
          "Gunakan kategori layanan agar analitik tetap konsisten.",
        ],
        forbidden: [
          "Jangan menonaktifkan layanan tanpa cek dampak ke booking berjalan.",
          "Jangan ubah harga tanpa validasi kebijakan bisnis.",
        ],
      },
    },
    {
      path: "/superadmin/laporan",
      rule: {
        title: "Laporan Keuangan",
        usage: [
          "Pilih periode dan cabang yang tepat sebelum export laporan.",
          "Gunakan export PDF/Excel untuk audit dan pelaporan manajemen.",
        ],
        forbidden: [
          "Jangan ekspor tanpa memverifikasi periode yang dipilih.",
          "Jangan mencampur data lintas periode untuk keputusan final.",
        ],
      },
    },
    {
      path: "/superadmin/pengaturan",
      rule: {
        title: "Pengaturan Operasional",
        usage: [
          "Atur jam operasional, jadwal barber, dan holiday per cabang.",
          "Simpan perubahan segera agar perhitungan slot tetap akurat.",
        ],
        forbidden: [
          "Jangan membuat jadwal overlap untuk barberman yang sama.",
          "Jangan mengubah holiday tanpa koordinasi dengan tim cabang.",
        ],
      },
    },
  ],
};
