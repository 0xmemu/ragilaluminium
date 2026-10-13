/**
 * Sumber teks CTA storefront.
 *
 * Teks CTA TIDAK lagi diatur dari panel admin. Seluruh kalimatnya hidup di
 * berkas ini (hardcode) dan dibaca langsung oleh komponen storefront, jadi
 * mengubah CTA berarti mengubah kode di sini lalu build ulang.
 *
 * Komponen tetap reusable: ClosingCTASection dan TrustAssuranceCard tetap
 * menerima props dan bisa dipakai halaman mana pun. CTA_CONTENT hanya
 * menyediakan nilai bawaan per kunci halaman, dan props halaman menjadi
 * cadangan bila kuncinya tidak ada di sini.
 *
 * `destination` pada tombol adalah KUNCI tujuan, bukan URL. Href diselesaikan
 * runtime oleh resolveCtaActions (@/lib/cta-actions), sehingga "whatsapp"
 * selalu memakai nomor toko yang aktif tanpa perlu disalin ke sini.
 */

export interface CtaActionContent {
  label: string
  /** Kunci tujuan dari daftar CTA_DESTINATIONS; "whatsapp" diselesaikan runtime. */
  destination: string
  variant: "primary" | "secondary"
}

export interface CtaBlockContent {
  /** Kop kecil di atas judul (banner) atau judul kartu (card/empty). */
  eyebrow?: string
  /** Judul ajakan (banner) atau keterangan (card/empty). */
  heading?: string
  actions?: CtaActionContent[]
  /** Baris daftar untuk blok list (home-help, pdp-benefits). */
  items?: Array<{ label: string; description?: string }>
}

/** Tujuan tombol yang sah. Href diselesaikan resolveCtaActions. */
export const CTA_DESTINATIONS = [
  "whatsapp",
  "home",
  "catalog.index",
  "catalog.all",
  "catalog.category.jendela",
  "installation.index",
  "reviews.screenshots",
  "reviews.website",
  "faq",
  "cara-pemesanan",
  "masalah-dan-solusi",
  "about",
  "contact",
] as const

export type CtaDestination = (typeof CTA_DESTINATIONS)[number]

/**
 * Teks CTA per kunci halaman.
 *
 * Kind blok hanya penanda baca: banner = banner penutup halaman, card = kartu
 * di halaman transaksi, section = tombol kecil di samping judul section
 * beranda, empty = tampilan saat isi belum ada, list = daftar langkah/kartu.
 */
export const CTA_CONTENT: Record<string, CtaBlockContent> = {
  // banner: Beranda, banner penutup
  home: {
    eyebrow: "Butuh bantuan pilih jendela?",
    heading: "Konsultasi gratis via WhatsApp, admin balas cepat",
    actions: [{ label: "Chat WhatsApp", destination: "whatsapp", variant: "primary" }],
  },
  // banner: Detail Model Produk, banner penutup
  "model-detail": {
    eyebrow: "Butuh bantuan pilih jendela?",
    heading: "Konsultasi gratis via WhatsApp, admin balas cepat",
    actions: [{ label: "Chat WhatsApp", destination: "whatsapp", variant: "primary" }],
  },
  // banner: Tentang Kami, banner penutup
  about: {
    eyebrow: "Butuh bantuan memilih produk?",
    heading: "Konsultasi gratis untuk menentukan model dan ukuran yang sesuai",
    actions: [
      { label: "Chat WhatsApp", destination: "whatsapp", variant: "primary" },
      { label: "Lihat Produk", destination: "catalog.index", variant: "secondary" },
    ],
  },
  // banner: Sering Ditanyakan, banner penutup
  faq: {
    eyebrow: "Masih punya pertanyaan?",
    heading: "Tim kami siap membantu lewat WhatsApp",
    actions: [
      { label: "Chat WhatsApp", destination: "whatsapp", variant: "primary" },
      { label: "Cara pemesanan", destination: "cara-pemesanan", variant: "secondary" },
    ],
  },
  // banner: Cara Pemesanan, banner penutup
  "cara-pemesanan": {
    eyebrow: "Siap memesan?",
    heading: "Pilih model aluminium yang tepat, atau konsultasikan kebutuhan Anda lebih dulu",
    actions: [
      { label: "Pilih Model Produk", destination: "catalog.index", variant: "primary" },
      { label: "Konsultasi Sekarang", destination: "whatsapp", variant: "secondary" },
    ],
  },
  // banner: Masalah & Solusi, banner penutup
  "masalah-solusi": {
    eyebrow: "Masih ragu spesifikasi yang tepat?",
    heading:
      "Tim kami siap bantu memilih model & ukuran yang sesuai kebutuhan Anda, gratis tanpa komitmen",
    actions: [
      { label: "Konsultasi WhatsApp", destination: "whatsapp", variant: "primary" },
      { label: "Lihat FAQ", destination: "faq", variant: "secondary" },
    ],
  },
  // card: Kartu Jaminan di keranjang, checkout, dan pesanan
  trust: {
    eyebrow: "Belanja Aman & Terpercaya",
    heading: "Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.",
  },
  // card: Bantuan di halaman Pesanan
  "order-help": {
    eyebrow: "Butuh bantuan dengan pesanan ini?",
    heading: "Hubungi tim kami, sertakan nomor pesanan agar cepat ditindaklanjuti.",
    actions: [{ label: "Hubungi Kami", destination: "contact", variant: "secondary" }],
  },
  // card: Tentang Kami, panel toko dan workshop
  "about-contact": {
    heading: "Toko & Workshop Ragil Aluminium",
    actions: [{ label: "Chat WhatsApp", destination: "whatsapp", variant: "primary" }],
  },
  // section: Beranda, tombol pada judul Model Produk
  "home-model": {
    actions: [{ label: "Lihat Semua", destination: "", variant: "secondary" }],
  },
  // section: Beranda, tombol pada judul Paling Banyak Dipesan
  "home-popular": {
    actions: [{ label: "Lihat Semua", destination: "", variant: "secondary" }],
  },
  // section: Beranda, tombol pada judul Cara Pesan
  "home-howto": {
    actions: [{ label: "Lihat Panduan", destination: "", variant: "secondary" }],
  },
  // section: Beranda, tombol pada judul Hasil Pemasangan
  "home-installation": {
    actions: [{ label: "Lihat Semua", destination: "", variant: "secondary" }],
  },
  // section: Beranda, tombol pada judul Apa Kata Pelanggan
  "home-testimonial": {
    actions: [{ label: "Lihat Semua", destination: "", variant: "secondary" }],
  },
  // section: Beranda, tombol pada judul Ulasan di Website
  "home-review-website": {
    actions: [{ label: "Lihat Semua", destination: "", variant: "secondary" }],
  },
  // empty: Beranda, saat belum ada model
  "home-empty-model": {
    eyebrow: "Model belum tersedia",
    heading:
      "Katalog model sedang disiapkan. Chat WhatsApp jika Anda ingin dibantu memilih.",
    actions: [{ label: "Buka Katalog", destination: "catalog.index", variant: "primary" }],
  },
  // empty: Beranda, saat belum ada produk populer
  "home-empty-popular": {
    eyebrow: "Belum ada produk populer",
    heading:
      "Mulai dari katalog jendela, pintu, atau bouven untuk menemukan ukuran yang Anda butuhkan.",
    actions: [
      { label: "Jelajahi Produk", destination: "catalog.category.jendela", variant: "primary" },
    ],
  },
  // empty: Beranda, saat belum ada foto pemasangan
  "home-empty-installation": {
    eyebrow: "Belum ada foto pemasangan",
    heading: "Contoh pemasangan di kota Anda bisa ditanyakan langsung lewat WhatsApp.",
  },
  // empty: Beranda, saat belum ada screenshot ulasan
  "home-empty-testimonial": {
    eyebrow: "Belum ada screenshot",
    heading: "Screenshot Shopee/WhatsApp akan tampil di sini setelah admin menambahkan.",
  },
  // empty: Beranda, saat belum ada ulasan website
  "home-empty-review": {
    eyebrow: "Belum ada ulasan website",
    heading: "Ulasan dari pembeli website (teks dan/atau foto) akan tampil di sini.",
  },
  // empty: Katalog, saat pencarian tidak menemukan hasil
  "catalog-empty": {
    eyebrow: "Tidak ada hasil untuk pencarian Anda",
    heading:
      "Tidak menemukan ukuran yang sesuai? Tim kami siap membantu memastikan produk pas dengan kebutuhan Anda.",
    actions: [
      { label: "Konsultasi via WhatsApp", destination: "whatsapp", variant: "primary" },
      { label: "Lihat semua model", destination: "catalog.all", variant: "secondary" },
    ],
  },
  // list: Beranda, bagian Kami bantu
  "home-help": {
    eyebrow: "Masih Bingung?",
    heading: "Kami bantu dari awal sampai jadi",
    items: [
      {
        label: "Konsultasi sebelum produksi",
        description:
          "Tim kami bantu memilih model yang pas untuk kebutuhan dan tampilan rumah Anda.",
      },
      {
        label: "Kami bantu cek & konfirmasi ukuran sebelum produksi",
        description:
          "Ukuran dan opsi dicek ulang bersama Anda sebelum produksi, agar hasilnya pas di lokasi.",
      },
      {
        label: "Packing kayu gratis & pengiriman ke seluruh Indonesia",
        description:
          "Produk dikemas rapi agar aman sampai di rumah Anda, ke seluruh Indonesia.",
      },
      {
        label: "Masih ragu? Chat WhatsApp, kami bantu sampai jelas",
        description:
          "Tanya apa saja lewat WhatsApp, dari pilihan model sampai panduan pemasangan.",
      },
    ],
  },
  // list: Detail Produk, alasan belanja (kasus umum; komponen tetap menghitung
  // label garansi ikut promo dan menghapus baris COD yang tidak berlaku).
  "pdp-benefits": {
    heading: "Alasan harus belanja di Ragil Aluminium",
    items: [
      { label: "Garansi 100%", description: "" },
      { label: "Bayar di tempat (COD)", description: "" },
      { label: "Kirim ke seluruh Indonesia", description: "" },
    ],
  },
}

/** Blok CTA satu kunci halaman, atau undefined bila kunci tidak dikenal. */
export function ctaBlock(key: string | undefined): CtaBlockContent | undefined {
  return key ? CTA_CONTENT[key] : undefined
}

/**
 * Label tombol kecil di samping judul section (blok `section`).
 * Href tetap milik komponen karena menyatu dengan tata letak section.
 */
export function ctaActionLabel(key: string, fallback: string): string {
  const label = CTA_CONTENT[key]?.actions?.[0]?.label?.trim()
  return label ? label : fallback
}
