import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga titik jangkar menu aksi folder di sidebar Media Library.
 *
 * Masalah yang dicegah: panel menu dulu dipasang sebagai anak langsung dari
 * <li> folder, dan <li> itu juga memuat daftar subfolder yang sedang terbuka.
 * Karena panel memakai top-full, yang artinya "100 persen tinggi wadah
 * penempatan", tinggi <li> yang ikut membesar membuat panel melompat jauh ke
 * bawah, bukan muncul di bawah tombol titik tiga yang ditekan.
 *
 * Perbaikannya: tombol dan panel dibungkus satu div kecil berposisi relative,
 * sehingga wadah penempatan panel hanya setinggi baris folder itu sendiri.
 *
 * Penjaga ini membaca sumber, bukan DOM, karena yang mudah terlupa adalah
 * seseorang menyunting ulang blok menu ini dan mengembalikan panel ke luar
 * pembungkusnya.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

const BERKAS = "resources/js/pages/Admin/Media/Library.tsx"

function sumberHalaman(): string {
  return readFileSync(join(akar, BERKAS), "utf8")
}

/** Ambil satu blok <div ...> sampai </div> penutupnya, mulai dari tag pembuka. */
function blokDiv(sumber: string, mulai: number): string {
  let kedalaman = 1
  let i = mulai + 4

  while (i < sumber.length) {
    const buka = sumber.indexOf("<div", i)
    const tutup = sumber.indexOf("</div>", i)

    if (tutup === -1) throw new Error("penutup </div> tidak ditemukan")

    if (buka !== -1 && buka < tutup) {
      kedalaman += 1
      i = buka + 4
    } else {
      kedalaman -= 1
      i = tutup + 6
      if (kedalaman === 0) return sumber.slice(mulai, i)
    }
  }

  throw new Error("blok div tidak selesai")
}

const PEMBUNGKUS = 'className="relative mr-1 flex shrink-0 items-center self-stretch"'

const PEMICU = [
  { nama: "daftar folder", penanda: "ref={isOpen ? menuContainerRef : null}" },
  { nama: "hasil pencarian folder", penanda: "ref={isMenuOpen ? searchMenuRef : null}" },
]

describe("menu aksi folder di sidebar Media Library", () => {
  it("membungkus kedua tombol titik tiga dengan pembungkus relative", () => {
    const sumber = sumberHalaman()
    const jumlah = sumber.split(PEMBUNGKUS).length - 1

    expect(jumlah).toBe(2)
  })

  it("menaruh panel menu di dalam pembungkus tombol, bukan di baris folder", () => {
    const sumber = sumberHalaman()

    for (const { nama, penanda } of PEMICU) {
      const mulaiPenanda = sumber.indexOf(penanda)
      expect(mulaiPenanda, "penanda " + nama + " tidak ditemukan").toBeGreaterThan(-1)

      const awalPembungkus = sumber.lastIndexOf("<div", mulaiPenanda)
      const blok = blokDiv(sumber, awalPembungkus)

      expect(blok, "pembungkus " + nama + " harus relative").toContain("relative")
      expect(blok, "pembungkus " + nama + " harus setinggi baris folder").toContain("self-stretch")
      expect(blok, "tombol pemicu " + nama + " harus di dalam pembungkus").toContain("Menu folder")
      expect(blok, "panel " + nama + " harus di dalam pembungkus").toContain("absolute right-0 top-full")
    }
  })

  it("tidak memotong panel menu dengan overflow-hidden pada kontainer sidebar", () => {
    const sumber = sumberHalaman()

    // Kontainer flex pembungkus sidebar dan galeri dulu memakai overflow-hidden,
    // sehingga panel menu yang turun melewati batas bawah kontainer terpotong.
    // overflow-x-clip tetap memotong mendatar tetapi membiarkan isi turun tampil.
    expect(sumber).toContain("flex min-w-0 max-w-full gap-4 overflow-x-clip")
    expect(sumber).not.toContain("flex min-w-0 max-w-full gap-4 overflow-hidden")
  })

  it("hanya punya dua panel menu folder di seluruh halaman", () => {
    const sumber = sumberHalaman()
    const jumlahPanel = sumber.split("absolute right-0 top-full").length - 1

    expect(jumlahPanel).toBe(2)
  })
})
