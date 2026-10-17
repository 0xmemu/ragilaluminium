import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga matriks harga & stok admin (17 Oktober 2026).
 *
 * Matriks WAJIB menampilkan thumbnail opsi pada sumbu bergambar, membentang
 * satu kelompok kombinasi (pola Shopee), supaya admin yang mengisi 12 harga
 * melihat warna yang sedang diisi tanpa membaca label teks.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")
const FORM = "resources/js/pages/Admin/ProductForm.tsx"

describe("matriks harga dan stok", () => {
  it("menampilkan thumbnail hanya untuk sumbu bergambar", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("buildAxisThumbMap")
    expect(sumber).toContain("axisThumbs.thumbs")
    expect(sumber).toContain("imageAxisSlot")
  })

  it("menggabungkan sel gambar per kelompok opsi, bukan per baris", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("rowSpan={groupSpan}")
    expect(sumber).toContain("isGroupStart")
    expect(sumber).toContain("groupSpan++")
  })

  it("menjaga jumlah kolom saat opsi belum punya gambar", () => {
    const sumber = baca(FORM)

    // Tanpa sel kosong pengganti, kolom harga bergeser satu ke kiri.
    expect(sumber).toContain("belum punya gambar")
    expect(sumber).toContain('<td className="border-r border-border/60 px-3 py-2" />')
  })

  it("harga dan stok tetap per kombinasi, bukan per opsi", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("combinations[key]")
    expect(sumber).toContain("combo.label")
  })
})
