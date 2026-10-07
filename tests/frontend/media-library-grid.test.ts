import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga susunan kartu Media Library (permintaan owner 2026-10-07): enam kartu
 * per layar di desktop lebar, mengecil bertingkat begitu lebar layar berkurang.
 *
 * Penjaga ini membaca sumber, bukan DOM, karena yang mudah terlupa adalah
 * seseorang mengembalikan susunannya ke lima kolom (nilai lama) saat menyunting
 * halaman ini, dan tidak ada test lain yang menahan angka itu.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

function kelasGridMedia(): string {
  const sumber = readFileSync(join(akar, "resources/js/pages/Admin/Media/Library.tsx"), "utf8")
  const baris = sumber
    .split("\n")
    .find((b) => b.includes("grid-cols-2") && b.includes("sm:grid-cols-3"))

  if (!baris) throw new Error("Baris grid kartu media tidak ditemukan di Library.tsx")

  return baris
}

describe("susunan kartu Media Library", () => {
  it("bertingkat dari dua sampai enam kolom", () => {
    const baris = kelasGridMedia()

    expect(baris).toContain("grid-cols-2")
    expect(baris).toContain("sm:grid-cols-3")
    expect(baris).toContain("md:grid-cols-4")
    expect(baris).toContain("lg:grid-cols-5")
    expect(baris).toContain("xl:grid-cols-6")
  })

  it("tidak lagi berhenti di lima kolom seperti sebelumnya", () => {
    expect(kelasGridMedia()).not.toContain("xl:grid-cols-5")
  })

  it("memakai aspek persegi supaya tinggi kartu mengikuti lebarnya", () => {
    const sumber = readFileSync(join(akar, "resources/js/pages/Admin/Media/Library.tsx"), "utf8")

    expect(sumber).toContain("aspect-square")
  })
})
