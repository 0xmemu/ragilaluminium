import { Head } from "@inertiajs/react"

import PublicLayout from "@/layouts/public-layout"

interface Bagian {
  judul: string
  isi: string[]
}

const BAGIAN: Bagian[] = [
  {
    judul: "Syarat retur",
    isi: [
      "Retur hanya dapat dicatat untuk pesanan berstatus Sampai. Pesanan yang sudah Selesai tidak bisa diretur di sistem; tindak lanjutinya dibicarakan langsung melalui WhatsApp.",
      "Imbauan batas retur adalah 48 jam sejak paket tercatat sampai. Melewatinya bukan penghalang: admin tetap menilai setiap kasus melalui percakapan.",
      "Satu pesanan memiliki satu kasus retur. Setelah kasus selesai, pesanan tidak dapat diretur kembali.",
      "Pembayaran yang belum tercatat lunas tetap dapat diretur dengan catatan admin; barang yang ditolak kurir sebelum dibayar ditangani sebagai pembatalan, bukan retur.",
    ],
  },
  {
    judul: "Cara mengajukan",
    isi: [
      "Buka halaman status pesanan Anda, lalu tekan tombol Pengembalian Barang pada kartu status Sampai. Tombol itu membuka percakapan WhatsApp dengan nomor pesanan Anda sudah terisi.",
      "Bicarakan kronologi dengan admin melalui percakapan tersebut. Belum ada apa pun yang tercatat di sistem pada tahap ini.",
      "Setelah disepakati, admin mencatat kasus retur dan pesanan berstatus Retur Diproses.",
      "Kirim barang kembali. Admin memeriksa kondisinya, lalu menentukan penyelesaiannya.",
    ],
  },
  {
    judul: "Alasan retur",
    isi: [
      "Barang rusak",
      "Kaca pecah / barang pecah",
      "Salah ukuran",
      "Salah produk",
      "Barang kurang",
      "Lainnya (dengan keterangan)",
    ],
  },
  {
    judul: "Jenis penyelesaian",
    isi: [
      "Refund: pengembalian dana, penuh atau sebagian, bila memenuhi kelayakan di bawah.",
      "Ganti barang baru.",
      "Kirim ulang barang yang sama.",
      "Kompensasi atau tanpa kompensasi, sesuai kesepakatan.",
      "Biaya kirim pengembalian ditanggung toko bila penyebabnya dari toko (barang rusak, pecah, salah produk, atau kurang).",
    ],
  },
  {
    judul: "Kapan refund diberikan",
    isi: [
      "Paket sudah tercatat sampai dan diterima pembeli.",
      "Pembayaran sudah diterima toko: untuk COD, dianggap lunas saat paket sampai; untuk transfer, setelah bukti transfer dikonfirmasi.",
      "Pengajuan masih dalam masa retur.",
      "Refund diproses setelah barang diterima kembali dan kondisinya diperiksa admin.",
    ],
  },
  {
    judul: "Yang perlu diketahui",
    isi: [
      "Barang retur tidak dimasukkan kembali ke stok dan tidak dijual kembali sebagai barang baru.",
      "Notifikasi setiap perubahan dikirim ke WhatsApp Anda: saat kasus dicatat, dan saat retur selesai.",
      "Untuk pertanyaan di luar halaman ini, hubungi kami melalui WhatsApp atau halaman Kontak.",
    ],
  },
]

export default function ReturnPolicy() {
  return (
    <PublicLayout>
      <Head title="Kebijakan Retur" />
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Kebijakan Retur</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Kebijakan ini berlaku untuk pesanan Ragil Aluminium. Intinya: retur dimulai dari
          percakapan WhatsApp, dicatat admin setelah disepakati, dan hanya untuk pesanan
          berstatus Sampai.
        </p>

        <div className="mt-8 space-y-8">
          {BAGIAN.map((bagian) => (
            <section key={bagian.judul} aria-label={bagian.judul}>
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {bagian.judul}
              </h2>
              <ul className="mt-3 space-y-2">
                {bagian.isi.map((baris) => (
                  <li key={baris} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                    <span aria-hidden="true" className="text-primary">•</span>
                    <span>{baris}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </PublicLayout>
  )
}
