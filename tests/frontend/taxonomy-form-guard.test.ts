import { readFileSync, readdirSync } from "node:fs"
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

/** Semua berkas .tsx di bawah sebuah folder, sebagai path relatif ke akar repo. */
function daftarBerkas(folder: string): string[] {
  return readdirSync(join(akar, folder), { withFileTypes: true }).flatMap((entri) => {
    const rel = `${folder}/${entri.name}`
    if (entri.isDirectory()) return daftarBerkas(rel)
    return entri.name.endsWith(".tsx") ? [rel] : []
  })
}

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

describe("form model produk: kode diisi admin dengan pendeteksi salah ketik", () => {
  const sumber = baca("resources/js/pages/Admin/ModelProducts/Form.tsx")

  it("memakai pendeteksi bagian kode asing, bukan pengisi otomatis", () => {
    expect(sumber).toContain("cariBagianKodeAsing")
    // Auto-fill dari nama sudah dihapus atas keputusan owner 2026-10-17.
    expect(sumber).not.toContain("buildModelCode")
  })

  it("menolak simpan bila ada bagian kode yang tidak ada di nama", () => {
    expect(sumber).toMatch(/if \(!editing && kodeAsing\)/)
  })

  it("angka boleh menggantikan kata bilangan", () => {
    expect(sumber).toContain("ANGKA_KE_KATA")
    expect(sumber).toContain('"1": "satu"')
  })

  it("nama model diminta memakai nama yang tampil di toko", () => {
    expect(sumber).toContain("nama yang tampil di toko")
  })

  it("tidak lagi menampilkan pilihan status di form", () => {
    expect(sumber).not.toContain('id="model-status"')
    expect(sumber).toContain('status: modelProduct?.status ?? "active"')
  })
})

describe("form kategori tidak lagi punya pilihan status", () => {
  const sumber = baca("resources/js/pages/Admin/Categories/Form.tsx")

  it("tidak menampilkan kotak centang Aktif di form", () => {
    expect(sumber).not.toContain('id="cat-is-active"')
  })

  it("kategori baru tetap dikirim aktif", () => {
    expect(sumber).toContain("is_active: category?.is_active ?? true")
  })
})

/**
 * Form taksonomi wajib memakai primitif bersama admin, bukan markup sendiri.
 * Kontrak ADR-022: Field, FieldGrid, CheckboxField, FieldAction, dan section
 * dengan padding p-5 sm:p-6. Markup tabel buatan sendiri melanggar kontrak itu
 * karena label dan kontrol tidak ikut aturan content-start, dan padatnya
 * berbeda dari form admin lain.
 */
describe("form taksonomi memakai primitif bersama admin", () => {
  const formTaksonomi = [
    "resources/js/pages/Admin/Categories/Form.tsx",
    "resources/js/pages/Admin/ModelProducts/Form.tsx",
    "resources/js/pages/Admin/SubModelForm.tsx",
  ]

  it.each(formTaksonomi)("%s memakai Field dan FieldGrid", (berkas) => {
    const sumber = baca(berkas)
    expect(sumber).toContain("<FieldGrid>")
    expect(sumber).toContain("<Field")
    expect(sumber).toContain("SectionCard")
  })

  it.each(formTaksonomi)("%s tidak lagi memakai baris tabel buatan sendiri", (berkas) => {
    const sumber = baca(berkas)
    expect(sumber).not.toMatch(/w-64 px-4 py-2\.5/)
    expect(sumber).not.toMatch(/w-64 px-4 py-3/)
  })

  it("SectionCard memakai skala padding ADR-022", () => {
    const sumber = baca("resources/js/components/admin/section-card.tsx")
    expect(sumber).toContain("p-5 sm:p-6")
  })
})

/**
 * Sapuan menyeluruh: tidak boleh ada lagi form admin yang merakit baris isian
 * sendiri dengan tabel. Pola <th class="w-64 px-4 py-2.5"> adalah tanda markup
 * lama yang melanggar ADR-022 karena label dan kontrolnya tidak ikut aturan
 * content-start milik Field, dan kepadatannya berbeda dari form lain.
 *
 * Pengecualian: tabel yang memang DAFTAR, bukan baris isian. CaraPemesanan
 * memakai tabel untuk mendaftar langkah (thead + tbody berisi baris data),
 * jadi polanya wajar di sana.
 */
describe("tidak ada form admin yang merakit baris isian sendiri", () => {
  const pengecualian = ["resources/js/pages/Admin/CaraPemesanan/Edit.tsx"]
  const akarHalaman = "resources/js/pages/Admin"

  it("tidak ada berkas di luar pengecualian yang memakai th w-64 px-4 py-2.5 atau py-3", () => {
    const tersisa = daftarBerkas(akarHalaman)
      .filter((berkas) => !pengecualian.includes(berkas))
      .filter((berkas) => {
        const sumber = baca(berkas)
        return /w-64 px-4 py-2\.5|w-64 px-4 py-3/.test(sumber)
      })

    expect(tersisa).toEqual([])
  })
})
