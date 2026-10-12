import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga dua teks bar promo (owner 2026-10-13): kolom desktop sampai 64 huruf
 * dan kolom ponsel sampai 40 huruf, masing-masing dengan penghitung huruf dan
 * batas yang ditegakkan paksa di isian.
 *
 * Penjaga ini membaca sumber karena batasnya hidup di atribut JSX dan di
 * komponen penghitung, bukan di fungsi yang bisa diimpor.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

const form = baca("resources/js/pages/Admin/Announcements/Form.tsx")
const bar = baca("resources/js/components/public/announcement-bar.tsx")
const penghitung = baca("resources/js/components/admin/ui/char-count.tsx")

describe("dua teks bar promo", () => {
  it("form punya kolom desktop dan ponsel dengan batas berbeda", () => {
    expect(form).toContain('id="text"')
    expect(form).toContain('id="text_mobile"')
    expect(form).toContain("maxLength={64}")
    expect(form).toContain("maxLength={40}")
  })

  it("setiap kolom punya penghitung dengan batas yang sama seperti isiannya", () => {
    expect(form).toContain("value={form.data.text} max={64}")
    expect(form).toContain("value={form.data.text_mobile} max={40}")
    expect(penghitung).toContain("export function CharCount")
  })

  it("penghitung dihitung per titik kode supaya cocok dengan server", () => {
    // PHP memakai mb_strlen (titik kode), sedangkan `.length` di JS menghitung
    // satuan kode UTF-16. Selisihnya membuat angka di layar berbeda dari batas
    // yang benar-benar ditegakkan untuk huruf di luar ASCII.
    expect(penghitung).toContain("Array.from(value).length")
    expect(penghitung).not.toContain("value.length")
  })

  it("storefront jatuh ke teks desktop bila teks ponsel kosong", () => {
    // Bar promo lama tidak punya teks ponsel; tanpa jatuhan ini, bar itu hilang
    // di layar sempit.
    expect(bar).toContain("announcement.text_mobile?.trim() || announcement.text")
  })

  it("kedua teks benar-benar disembunyikan per ukuran layar", () => {
    // Harus display none, bukan sekadar tidak tampak, supaya pembaca layar
    // tidak membaca dua teks sekaligus.
    expect(bar).toContain("block sm:hidden")
    expect(bar).toContain("hidden sm:block")
  })
})
