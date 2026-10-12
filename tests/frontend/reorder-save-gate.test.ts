import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga gerbang tombol Simpan urutan (kontrak owner 2026-10-12).
 *
 * Tombol Simpan urutan hanya boleh tampil setelah ada urutan yang benar-benar
 * digeser. Dua halaman, Bar Promo dan Banner, menulis tombolnya sendiri tanpa
 * penanda geseran, sehingga Simpan urutan sudah muncul begitu mode urut menyala
 * padahal belum ada yang perlu disimpan, dan terasa seperti tombol yang tidak
 * melakukan apa pun.
 *
 * Penjaga ini membaca sumber, bukan DOM, karena yang mudah terlupa adalah
 * halaman baru yang menulis ulang tombolnya alih-alih memakai komponen bersama.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

/** Buang baris komentar supaya teks penjelas tidak dihitung sebagai kode. */
function tanpaKomentar(teks: string): string {
  const pemisah = String.fromCharCode(10)
  return teks
    .split(pemisah)
    .filter((baris) => {
      const bersih = baris.trim()
      return !bersih.startsWith("*") && !bersih.startsWith("//") && !bersih.startsWith("/*")
    })
    .join(pemisah)
}

/** Semua halaman admin yang merender tombol Simpan urutan. */
function halamanSimpanUrutan(): string[] {
  const dasar = join(akar, "resources/js/pages/Admin")
  const hasil: string[] = []

  const telusuri = (dir: string) => {
    for (const isi of readdirSync(dir, { withFileTypes: true })) {
      if (isi.name.includes(".bak-")) continue
      const penuh = join(dir, isi.name)
      if (isi.isDirectory()) {
        telusuri(penuh)
      } else if (isi.name.endsWith(".tsx")) {
        if (readFileSync(penuh, "utf8").includes("Simpan urutan")) hasil.push(penuh)
      }
    }
  }

  telusuri(dasar)
  return hasil
}

describe("gerbang tombol Simpan urutan", () => {
  it("komponen bersama hanya merender Simpan urutan di cabang sudah digeser", () => {
    const kode = tanpaKomentar(baca("resources/js/components/admin/reorder-action-button.tsx"))
    const iGerbang = kode.indexOf("if (dirty) {")
    const iSimpan = kode.indexOf('"Simpan urutan"')

    expect(iGerbang).toBeGreaterThan(-1)
    expect(iSimpan).toBeGreaterThan(iGerbang)
  })

  it("setiap halaman pemakai komponen bersama menyerahkan penanda geseran", () => {
    const lupa = halamanSimpanUrutan()
      .filter((berkas) => {
        const kode = tanpaKomentar(readFileSync(berkas, "utf8"))
        return kode.includes("<ReorderActionButton") && !kode.includes("dirty=")
      })
      .map((berkas) => berkas.slice(akar.length))

    expect(lupa).toEqual([])
  })

  it("halaman yang menulis tombolnya sendiri tetap punya gerbang geseran", () => {
    const halaman = halamanSimpanUrutan()
    expect(halaman.length).toBeGreaterThanOrEqual(11)

    const lupa: string[] = []
    for (const berkas of halaman) {
      const kode = tanpaKomentar(readFileSync(berkas, "utf8"))
      if (kode.includes("<ReorderActionButton")) continue

      const iHitung = kode.indexOf("const dirty")
      const iGerbang = kode.indexOf("{dirty ? (")
      const iSimpan = kode.indexOf('"Simpan urutan"')

      if (iHitung === -1 || iGerbang === -1 || iSimpan === -1) {
        lupa.push(berkas.slice(akar.length) + " (penanda geseran tidak lengkap)")
        continue
      }
      if (!(iHitung < iGerbang && iGerbang < iSimpan)) {
        lupa.push(berkas.slice(akar.length) + " (gerbang tidak mendahului tombol)")
      }
    }

    expect(lupa).toEqual([])
  })
})
