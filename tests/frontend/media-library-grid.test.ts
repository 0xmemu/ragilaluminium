import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga susunan dan isi kartu Media Library (permintaan owner 2026-10-07).
 *
 * Dua hal yang ditahan di sini, keduanya nilai keputusan owner:
 *
 * 1. Susunan kartu: enam per layar di desktop lebar, mengecil bertingkat begitu
 *    lebar layar berkurang.
 * 2. Isi kartu: hanya nama aset. Jumlah pemakaian TIDAK lagi di kartu, cukup di
 *    dialog info, supaya baris kartu satu tinggi dan nama panjang tidak terdesak.
 *
 * Penjaga ini membaca sumber, bukan DOM, karena yang mudah terlupa adalah
 * seseorang mengembalikan nilai lama (lima kolom, atau keterangan pemakaian di
 * kartu) saat menyunting halaman ini, dan tidak ada test lain yang menahannya.
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

function sumberHalaman(): string {
  return readFileSync(join(akar, "resources/js/pages/Admin/Media/Library.tsx"), "utf8")
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
    expect(sumberHalaman()).toContain("aspect-square")
  })
})

describe("isi kartu Media Library", () => {
  it("kartu hanya memuat nama aset, tanpa keterangan jumlah pemakaian", () => {
    const sumber = sumberHalaman()

    expect(sumber).not.toContain("<p className=\"text-[10px] text-muted-foreground\">Dipakai ")
  })

  it("jumlah pemakaian tetap ada di dialog info", () => {
    const sumber = sumberHalaman()

    // Label barisnya di dialog info, bukan di kartu.
    expect(sumber).toContain("<dt className=\"text-muted-foreground\">Dipakai</dt>")
  })
})
