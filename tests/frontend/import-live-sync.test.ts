import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * Guard live sync halaman import.
 *
 * Halaman detail job WAJIB memberi tanda proses masih hidup selagi status
 * berjalan. Tanpa itu bar terlihat statis dan admin menduga import menggantung.
 *
 * Render test tidak dipakai karena animasi CSS dan polling berkala tidak bisa
 * dipercaya di jsdom; bukti perilakunya diuji di sisi PHP (penghitung cache
 * naik bertahap) dan dibaca dari sumber di sini.
 */
const showSource = readFileSync(
  fileURLToPath(new URL("../../resources/js/pages/Admin/ImportShow.tsx", import.meta.url)),
  "utf8",
)

const createSource = readFileSync(
  fileURLToPath(new URL("../../resources/js/pages/Admin/ImportCreate.tsx", import.meta.url)),
  "utf8",
)

describe("ImportShow live sync", () => {
  it("menampilkan indikator bergerak selama import berjalan", () => {
    // Lapisan berdenyut pada progress bar.
    expect(showSource).toMatch(/animate-pulse/)
  })

  it("menampilkan spinner pada keterangan penyegaran otomatis", () => {
    expect(showSource).toMatch(/animate-spin/)
    expect(showSource).toMatch(/diperbarui otomatis setiap 1 detik/)
  })

  it("menyegarkan data secara berkala selama status berjalan", () => {
    // Polling partial reload dengan interval 1000 ms.
    expect(showSource).toMatch(/setInterval\(/)
    expect(showSource).toMatch(/1000/)
    expect(showSource).toMatch(/only: \["importJob"\]/)
  })

  it("menampilkan daftar produk yang berhasil diimpor", () => {
    expect(showSource).toMatch(/imported_products/)
    expect(showSource).toMatch(/Produk yang berhasil diimpor/)
  })

  it("tidak lagi menampilkan sumber stok", () => {
    // Sumber stok selalu dari berkas, jadi baris itu dihapus dari halaman.
    expect(showSource).not.toMatch(/Sumber stok/)
  })
})

describe("ImportCreate indikator periksa berkas", () => {
  it("menampilkan spinner berputar saat memeriksa berkas", () => {
    expect(createSource).toMatch(/animate-spin/)
    expect(createSource).toMatch(/Memeriksa berkas/)
  })

  it("meneruskan backUrl ke layout supaya tombol Kembali dirender", () => {
    // backUrl dikirim controller, tetapi layout hanya merender tombol Kembali
    // bila halaman meneruskan prop itu. Tanpa ini halaman detail tidak punya
    // jalan kembali ke daftar import.
    expect(showSource).toMatch(/backUrl/)
    expect(showSource).toMatch(/backUrl=\{backUrl\}/)
  })
})
