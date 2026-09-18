/**
 * Registry panduan halaman admin (PageGuide "< Panduan").
 * Kunci = nama route Laravel (admin.*). Halaman tanpa entry tidak menampilkan tombol Panduan.
 *
 * Kontrak konten: bahasa Indonesia sehari-hari, sentence case, tanpa em dash,
 * jelaskan "halaman ini untuk apa + langkah kerja + catatan penting", bukan copy pemasaran.
 */
export interface AdminPageGuide {
  title: string
  summary: string
  steps: string[]
  notes?: string[]
}

export const adminPageGuides: Record<string, AdminPageGuide> = {
  "admin.beranda.index": {
    title: "Tata Letak Beranda",
    summary: "Aktifkan, nonaktifkan, dan atur urutan section di halaman utama toko.",
    steps: [
      "Tekan Aktifkan mode geser untuk mengubah urutan section beranda.",
      "Gunakan tombol naik atau turun, lalu tekan Simpan.",
      "Gunakan Edit konten untuk membuka pengelolaan section terkait.",
    ],
    notes: [
      "Section yang dinonaktifkan tidak tampil di beranda tanpa menghapus isinya.",
      "Perubahan urutan langsung terlihat di halaman utama toko.",
    ],
  },
  "admin.cara-pemesanan.edit": {
    title: "Cara Pemesanan",
    summary: "Isi panduan langkah belanja di halaman /cara-pemesanan.",
    steps: [
      "Isi judul hero dan subjudul halaman.",
      "Atur langkah pemesanan: pilih ikon, judul, deskripsi, dan poin penting.",
      "Atur kartu informasi pembayaran, pengiriman, dan garansi.",
    ],
    notes: [
      "Tampilan halaman tetap mengikuti desain toko; Anda hanya mengisi isi.",
      "Gunakan maksimal 8 langkah dan 6 kartu informasi.",
    ],
  },
  "admin.tentang-kami.edit": {
    title: "Tentang Kami",
    summary: "Isi konten halaman profil toko /about: judul, keunggulan, langkah kerja, dan daftar jaminan.",
    steps: [
      "Isi Judul Utama dan Kalimat Pengantar. Kosongkan untuk memakai teks baku.",
      "Atur Keunggulan Toko: pilih ikon, tulis judul singkat dan keterangan.",
      "Atur Langkah Kerja dari konsultasi sampai pengiriman (maksimal 4).",
      "Tulis Daftar Jaminan, satu jaminan per baris.",
      "Tekan Simpan perubahan, lalu buka Lihat di toko untuk memeriksa hasilnya.",
    ],
    notes: [
      "Tampilan halaman tetap mengikuti desain toko; Anda hanya mengisi isi.",
      "Konten yang dikosongkan otomatis memakai teks baku, halaman tidak pernah kosong.",
    ],
  },
  "admin.store-settings.index": {
    title: "Profil & Kontak Toko",
    summary: "Pengaturan akun resmi marketplace, media sosial, nomor WhatsApp konsultasi, dan alamat workshop.",
    steps: [
      "Pilih tab Marketplace & Media Sosial untuk memperbarui tautan Shopee, Tokopedia, Lazada, atau Instagram.",
      "Pilih tab Kontak & Jam Kerja untuk memperbarui nomor telepon, WhatsApp, dan alamat fisik workshop.",
      "Gunakan tombol Simpan perubahan di kanan atas untuk menyimpan data.",
    ],
    notes: [
      "Tautan marketplace tampil pada badge kepercayaan etalase, informasi toko, dan footer publik.",
      "Nomor WhatsApp terhubung langsung dengan tombol konsultasi cepat pembeli.",
    ],
  },
  "admin.storefront-platforms.edit": {
    title: "Profil & Kontak Toko",
    summary: "Pengaturan akun resmi marketplace, media sosial, nomor WhatsApp konsultasi, dan alamat workshop.",
    steps: [
      "Pilih tab Marketplace & Media Sosial untuk memperbarui tautan Shopee, Tokopedia, Lazada, atau Instagram.",
      "Pilih tab Kontak & Jam Kerja untuk memperbarui nomor telepon, WhatsApp, dan alamat fisik workshop.",
      "Gunakan tombol Simpan perubahan di kanan atas untuk menyimpan data.",
    ],
    notes: [
      "Tautan marketplace tampil pada badge kepercayaan etalase, informasi toko, dan footer publik.",
      "Nomor WhatsApp terhubung langsung dengan tombol konsultasi cepat pembeli.",
    ],
  },
  "admin.testimonials.index": {
    title: "Ulasan Pelanggan",
    summary: "Kelola ulasan pembeli dari transaksi website, tangkapan layar marketplace, dan galeri hasil pemasangan.",
    steps: [
      "Gunakan tab Ulasan Website untuk meninjau dan memoderasi ulasan riil pembeli.",
      "Gunakan tab Ulasan Eksternal untuk mengelola tangkapan layar ulasan dari Shopee atau WhatsApp.",
      "Gunakan tab Hasil Pemasangan untuk mengelola foto dan video aplikasi produk.",
      "Gunakan tombol Atur urutan pada ulasan eksternal untuk mengatur urutan tampil di etalase.",
    ],
    notes: [
      "Ulasan website dengan status terbit otomatis tampil di halaman produk terkait dan halaman ulasan publik.",
      "Foto hasil pemasangan yang diimpor dari produk berstatus read-only dan dapat ditambah dengan foto manual.",
    ],
  },
  "admin.dashboard": {
    title: "Dashboard",
    summary: "Ringkasan kondisi toko hari ini dan daftar pekerjaan yang perlu ditangani.",
    steps: [
      "Cek kartu ringkasan di atas untuk angka Penjualan Gross dan pesanan hari ini.",
      "Buka daftar Perlu Ditangani Hari Ini untuk pekerjaan yang tidak boleh tertunda.",
      "Klik item di daftar untuk langsung menuju halaman terkait.",
    ],
    notes: ["Angka hari ini dihitung sejak pukul 00.00 WIB."],
  },
  "admin.orders.index": {
    title: "Daftar Pesanan",
    summary: "Semua pesanan pelanggan beserta status, pembayaran, dan aksi utamanya.",
    steps: [
      "Gunakan pencarian dan filter untuk menemukan pesanan.",
      "Klik baris pesanan untuk membuka detail lengkap.",
      "Aksi utama (Proses Pesanan, Input Resi, Selesaikan) tersedia di tiap baris dan di halaman detail.",
    ],
    notes: [
      "Pesanan COD dianggap lunas setelah barang diterima pelanggan.",
      "Export pesanan ada di tombol kanan atas.",
    ],
  },
  "admin.orders.show": {
    title: "Detail Pesanan",
    summary: "Informasi lengkap satu pesanan: produk, pembayaran, penerima, dan pengiriman.",
    steps: [
      "Periksa ringkasan pesanan dan data penerima sebelum memproses.",
      "Gunakan tombol aksi utama untuk memproses pesanan atau input resi.",
      "Status pengiriman muncul setelah resi tersimpan dan dikirim ke kurir.",
    ],
    notes: [
      "Input resi membuka popup berisi verifikasi pelanggan dan alamat tujuan.",
      "Perubahan status mengikuti alur pesanan, tidak ada dropdown status manual.",
    ],
  },
  "admin.products.index": {
    title: "Produk",
    summary: "Daftar seluruh produk katalog beserta status dan aksi cepatnya.",
    steps: [
      "Cari produk lewat kolom pencarian atau filter kategori.",
      "Urutkan daftar lewat pemilih urutan: Baru saja diubah, Terlaris, atau waktu ditambahkan, tiap opsi punya arah naik dan turun.",
      "Klik nama produk untuk membuka detail dan media.",
      "Tambah produk baru lewat tombol di kanan atas.",
    ],
    notes: ["Produk baru selalu berstatus Arsip sampai datanya lengkap dan dipublikasikan."],
  },
  "admin.products.show": {
    title: "Detail Produk",
    summary: "Kelola satu produk: varian, harga, media, atribut, dan publikasi.",
    steps: [
      "Lengkapi varian dan harga terlebih dahulu.",
      "Unggah atau tautkan media di tab media, tautkan minimal satu gambar ke varian.",
      "Publikasikan produk lewat langkah Review agar tampil di toko.",
    ],
    notes: [
      "Checklist publikasi menuntut varian aktif, harga, gambar utama, dan data pengiriman.",
      "Produk yang belum aktif tidak terlihat oleh pembeli.",
    ],
  },
  "admin.media.library": {
    title: "Media Library",
    summary: "Kumpulan aset media bersama untuk produk, banner, dan dokumentasi.",
    steps: [
      "Unggah media baru atau pilih aset yang sudah ada.",
      "Gunakan folder untuk mengelompokkan aset.",
      "Klik Pasang untuk menautkan aset ke produk, banner, atau dokumentasi hasil pemasangan.",
    ],
    notes: [
      "Tautan Hasil pemasangan pada aset membuat fotonya tampil di halaman hasil pemasangan.",
      "Salin URL menghasilkan tautan gambar versi web yang siap dipakai.",
    ],
  },
  "admin.imports.index": {
    title: "Import",
    summary: "Riwayat proses import katalog, harga, stok, dan media.",
    steps: [
      "Buat import baru lewat tombol kanan atas dan pilih jenisnya.",
      "Unduh template, isi sesuai petunjuk, lalu unggah kembali.",
      "Pantau progres di daftar; baris gagal bisa diunduh untuk perbaikan.",
    ],
    notes: [
      "Sel kosong pada template update berarti nilai lama dipertahankan.",
      "Batas baris per file import adalah 50.000 baris.",
    ],
  },
  "admin.imports.create": {
    title: "Mulai Import",
    summary: "Form unggah berkas Excel untuk import katalog baru atau pembaruan massal.",
    steps: [
      "Pilih jenis import: Import Katalog, Update Harga & Stok, atau Update Media.",
      "Unduh template Excel resmi melalui tombol di kanan atas.",
      "Unggah berkas Excel yang sudah diisi lalu tekan Periksa file untuk validasi awal.",
      "Setelah verifikasi lolos, tombol Mulai Import akan aktif untuk memulai proses.",
    ],
    notes: [
      "Tombol Mulai Import hanya aktif jika berkas berhasil diverifikasi via Periksa file.",
      "Format berkas harus sesuai template resmi tanpa mengubah urutan kolom.",
    ],
  },
  "admin.imports.show": {
    title: "Detail Import",
    summary: "Pemantauan langsung proses import produk, varian, dan media.",
    steps: [
      "Perhatikan bilah kemajuan (progress bar) yang diperbarui secara langsung.",
      "Tinjau jumlah produk dan baris kombinasi yang berhasil diimpor.",
      "Jika ada produk yang tersimpan sebagai arsip, lengkapi data melalui tautan yang tersedia.",
    ],
    notes: [
      "Halaman menyegarkan data progres otomatis selama proses import berlangsung.",
      "Seluruh transaksi import dibungkus proteksi database untuk mencegah data rusak.",
    ],
  },
  "admin.shipping.index": {
    title: "Pengiriman",
    summary: "Pantau status pengiriman semua pesanan yang sudah memiliki resi.",
    steps: [
      "Gunakan filter status untuk menemukan kiriman yang perlu ditindak.",
      "Klik Refresh tracking untuk menarik status terbaru dari kurir.",
      "Buka detail pesanan untuk melihat riwayat perjalanan paket.",
    ],
    notes: ["Status pengiriman diperbarui otomatis dari webhook kurir dan dapat disegarkan manual."],
  },
  "admin.vouchers.index": {
    title: "Voucher Toko",
    summary: "Kelola kode voucher potongan harga untuk pembeli.",
    steps: [
      "Buat voucher baru dengan periode dan aturan potongannya.",
      "Publikasikan agar dapat dipakai saat checkout.",
      "Akhiri voucher yang sudah tidak berlaku agar tidak bisa dipakai lagi.",
    ],
    notes: ["Voucher yang diakhiri tidak bisa diaktifkan ulang; buat duplikat bila perlu."],
  },
  "admin.promotions.index": {
    title: "Promo Toko",
    summary: "Kampanye potongan harga per produk untuk periode tertentu.",
    steps: [
      "Buat promo baru lalu pilih produk yang ikut kampanye.",
      "Aktifkan promo pada tanggal mulainya.",
      "Pantau dampaknya lewat tombol Impact pada kartu promo.",
    ],
  },
  "admin.cod-settings.edit": {
    title: "Biaya COD",
    summary: "Pengaturan biaya layanan COD yang dibebankan ke pembeli.",
    steps: [
      "Atur persentase biaya COD sesuai kebijakan toko.",
      "Simpan perubahan dan pastikan layanan COD aktif.",
    ],
    notes: [
      "Nilai biaya (%). Rumus: biaya COD = 4% x (subtotal produk + ongkir yang dibayar pembeli). Subtotal produk dihitung dari harga yang sudah dikurangi diskon (flash sale atau diskon biasa) dan voucher. Contoh: harga produk Rp 100.000, diskon Rp 10.000, ongkir Rp 20.000. Biaya COD = 4% x (Rp 90.000 + Rp 20.000) = Rp 4.400.",
    ],
  },
  "admin.shipping-subsidy.edit": {
    title: "Subsidi Ongkir",
    summary: "Pengaturan potongan ongkir yang ditanggung toko.",
    steps: [
      "Atur persentase subsidi dan kurir yang mendapat subsidi.",
      "Simpan perubahan, lalu cek estimasi ongkir di halaman checkout.",
    ],
    notes: ["Subsidi dihitung dari ongkir kurir, bukan dari harga produk."],
  },
  "admin.faq.index": {
    title: "Sering Ditanyakan",
    summary: "Kelola pertanyaan yang tampil di halaman FAQ toko.",
    steps: [
      "Tambah pertanyaan beserta jawabannya per kategori.",
      "Susun urutan tampil lewat tombol reorder.",
      "Arsipkan pertanyaan yang jarang dipakai tanpa menghapusnya.",
    ],
  },
  "admin.masalah-solusi.index": {
    title: "Masalah & Solusi",
    summary: "Panduan penanganan kendala pelanggan yang tampil di toko.",
    steps: [
      "Tambah pasangan masalah dan solusinya.",
      "Gunakan solusi rich untuk menyertakan foto atau video.",
      "Susun urutan sesuai frekuensi masalah.",
    ],
  },
  "admin.activity-logs.index": {
    title: "Log Aktivitas",
    summary: "Rekam jejak perubahan data yang dilakukan admin.",
    steps: [
      "Cari aktivitas berdasarkan kata kunci atau jenis perubahan.",
      "Gunakan export untuk dokumentasi atau audit.",
    ],
    notes: ["Log bersifat baca saja dan tidak bisa diedit."],
  },
  "admin.notifications.index": {
    title: "Notifikasi",
    summary: "Pemberitahuan sistem untuk admin, misalnya hasil import atau media.",
    steps: [
      "Baca notifikasi terbaru di bagian atas.",
      "Tandai dibaca setelah ditindak; tandai semua bila sudah selesai.",
    ],
  },
  "admin.analytics.store-performance": {
    title: "Performa Toko",
    summary: "Laporan analitik keuangan, arus kas, operasional, dan interaksi katalog produk.",
    steps: [
      "Pilih rentang waktu di baris filter untuk menganalisis periode tertentu.",
      "Pantau Rekonsiliasi Keuangan untuk melihat penjualan bersih toko dan status kas.",
      "Gunakan tab metrik grafik dan tabel produk terlaris untuk memantau performa penjualan.",
      "Unduh laporan lengkap berformat Excel (XLSX) melalui tombol Unduh Laporan di kanan atas.",
    ],
    notes: [
      "Penjualan Gross dihitung berdasarkan pesanan fulfillment yang masuk proses.",
      "COD yang barangnya belum sampai dihitung terpisah; sistem tidak melacak setoran uang dari kurir J&T.",
    ],
  },
  "admin.users.index": {
    title: "Manajemen Admin",
    summary: "Kelola akun admin yang boleh mengakses panel.",
    steps: [
      "Tambah admin baru dengan peran yang sesuai.",
      "Nonaktifkan akun yang tidak lagi digunakan, jangan dihapus.",
    ],
    notes: ["Nonaktif menjaga riwayat aktivitas tetap utuh."],
  },
  "admin.customers.index": {
    title: "Kelola Pelanggan",
    summary: "Basis data pelanggan terpadu yang disinkronkan otomatis dari transaksi pesanan toko.",
    steps: [
      "Gunakan kotak pencarian untuk mencari pelanggan berdasarkan nama, nomor WhatsApp, atau alamat.",
      "Gunakan menu urutkan untuk menyortir pelanggan terbaru, terlama, atau nama A-Z.",
      "Klik nama pelanggan atau tombol Edit untuk mengelola detail profil dan alamat.",
      "Gunakan tombol Unduh Excel untuk mengunduh laporan lengkap riwayat pesanan pelanggan.",
    ],
    notes: [
      "Status keaktifan pelanggan: Aktif (memiliki transaksi pesanan dalam 90 hari terakhir), Baru (belum pernah memesan), atau Tidak aktif (tidak ada pesanan selama lebih dari 90 hari).",
      "Nomor WhatsApp terhubung langsung dengan tombol aksi chat satu klik.",
    ],
  },
  "admin.customers.edit": {
    title: "Detail Pelanggan",
    summary: "Informasi kontak pelanggan, pemetaan alamat kirim, skor risiko, dan riwayat pesanan.",
    steps: [
      "Perbarui nama lengkap atau detail alamat pengiriman bila diperlukan.",
      "Tinjau daftar riwayat nomor pesanan pelanggan di panel samping.",
      "Simpan perubahan menggunakan tombol Simpan di kanan atas.",
    ],
    notes: [
      "Nomor WhatsApp dikunci sebagai identitas unik pelanggan dan tidak dapat diubah.",
      "Fitur email telah ditiadakan sesuai kontrak guest checkout berbasis nomor WhatsApp.",
    ],
  },
}
