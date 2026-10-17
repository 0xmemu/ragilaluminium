import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga isian turunan di form taksonomi (kategori dan model produk).
 *
 * Dua cacat nyata yang ditutup penjaga ini, keduanya 17 Oktober 2026:
 *
 * 1. Slug kategori membeku di huruf pertama. Form mengisi slug dari nama hanya
 *    ketika slug masih kosong, sehingga ketukan pertama "G" menulis "g" lalu
 *    kolom dianggap sudah terisi. Kategori "Gerbang" berakhir di /products/g.
 *    Perbaikannya: penanda slugTouched yang hanya menyala bila admin sendiri
 *    menyunting kolom slug.
 *
 * 2. Kode model mengulang kata kategori. Kode selalu berpasangan dengan
 *    kategori, jadi "Jendela Jungkit Satu Daun" di kategori Jendela cukup
 *    menjadi JUNGKIT_SATU_DAUN, bukan JENDELA_JUNGKIT_SATU_DAUN.
 *
 * Penjaga membaca SUMBER, bukan DOM, karena yang mudah terlupa adalah
 * mengembalikan pola lama saat form disunting lagi.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

describe("form kategori: slug mengikuti nama sampai admin menyentuhnya", () => {
  const sumber = baca("resources/js/pages/Admin/Categories/Form.tsx")

  it("memakai penanda sentuh, bukan cek slug kosong", () => {
    expect(sumber).toContain("slugTouched")
    expect(sumber).not.toMatch(/!category\s*&&\s*!prev\.slug/)
  })

  it("menyalakan penanda hanya saat kolom slug disunting admin", () => {
    expect(sumber).toMatch(/slugTouched\.current\s*=\s*true/)
  })

  it("memakai satu pembentuk slug yang sama untuk isi dan placeholder", () => {
    const pemakaian = sumber.match(/toSlug\(/g) ?? []
    expect(pemakaian.length).toBeGreaterThanOrEqual(3)
  })
})

describe("form model produk: kode otomatis tanpa kata kategori", () => {
  const sumber = baca("resources/js/pages/Admin/ModelProducts/Form.tsx")

  it("membuang kata kategori dari kode yang dibentuk", () => {
    expect(sumber).toContain("buildModelCode")
    expect(sumber).toContain("categoryWords")
  })

  it("kode ikut berubah saat nama atau kategori berubah, selama belum disentuh", () => {
    expect(sumber).toContain("codeTouched")
    expect(sumber).toMatch(/!codeTouched\.current/)
  })

  it("kode tetap bisa diubah admin di halaman tambah", () => {
    expect(sumber).toMatch(/codeTouched\.current\s*=\s*true/)
  })

  it("keterangan menganjurkan kode satu kata", () => {
    expect(sumber).toContain("JUNGKIT")
  })

  it("nama model diminta memakai nama yang tampil di toko", () => {
    expect(sumber).toContain("nama yang tampil di toko")
  })
})
