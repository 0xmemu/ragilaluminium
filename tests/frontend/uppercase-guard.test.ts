import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga keputusan desain kapitalisasi (13 Oktober 2026).
 *
 * Huruf besar semua lewat kelas `uppercase` HANYA boleh untuk nilai sistem:
 * kode SKU, kode voucher, nomor pesanan, nomor resi, dan ID, termasuk isian
 * yang mengubah ketikan pengguna menjadi huruf besar. Semua label UI (judul
 * kolom tabel, label grup baris, kategori, judul seksi, judul grup sidebar,
 * label dropdown, label metrik) memakai Kapital Per Kata tanpa paksaan CSS.
 *
 * Kontrak lengkap: `frontend/docs/UI-CONSISTENCY-CONTRACT.md` bagian "Shape,
 * type, and interaction".
 *
 * Cakupan penjaga adalah lapisan ADMIN saja. Storefront punya aturannya sendiri
 * di BRAND-KIT (mis. akronim status seperti FLASH SALE), jadi berkas public
 * tidak diperiksa di sini.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

/**
 * Satu-satunya pemakaian `uppercase` yang diizinkan di lapisan admin, beserta
 * alasannya. Berkas di luar daftar ini yang menambah `uppercase` akan gagal.
 */
const IZIN: Array<{ berkas: string; alasan: string }> = [
  {
    berkas: "resources/js/pages/Admin/Vouchers/Form.tsx",
    alasan: "isian kode voucher: mengubah ketikan pengguna menjadi huruf besar (nilai sistem)",
  },
]

function berkasAdmin(): string[] {
  const hasil: string[] = []
  const telusuri = (rel: string) => {
    const dir = join(akar, rel)
    for (const isi of readdirSync(dir, { withFileTypes: true })) {
      if (isi.name.includes(".bak")) continue
      const relAnak = `${rel}/${isi.name}`
      if (isi.isDirectory()) {
        telusuri(relAnak)
      } else if (isi.name.endsWith(".tsx") || isi.name.endsWith(".ts")) {
        hasil.push(relAnak)
      }
    }
  }
  telusuri("resources/js/pages/Admin")
  telusuri("resources/js/components/admin")
  telusuri("resources/js/layouts")
  return hasil
}

const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

/** Kelas Tailwind `uppercase` sebagai kata utuh, bukan bagian nama lain. */
function memakaiUppercase(teks: string): boolean {
  return /\buppercase\b/.test(teks)
}

describe("keputusan desain kapitalisasi di panel admin", () => {
  it("label UI tidak memakai kelas uppercase", () => {
    const izin = new Set(IZIN.map((x) => x.berkas))
    const pelanggar = berkasAdmin().filter((rel) => !izin.has(rel) && memakaiUppercase(baca(rel)))
    expect(pelanggar, `lepas kelas "uppercase" atau daftarkan di IZIN dengan alasan: ${pelanggar.join(", ")}`).toEqual([])
  })

  it("berkas yang diizinkan memang masih memakai uppercase (daftar tidak basi)", () => {
    for (const { berkas, alasan } of IZIN) {
      expect(memakaiUppercase(baca(berkas)), `${berkas} tidak lagi memakai uppercase, hapus dari IZIN (${alasan})`).toBe(true)
    }
  })

  it("keputusannya tercatat di kontrak desain kanonik", () => {
    // Kontrak UI lintas halaman; berlaku juga untuk lapisan admin (lihat bagian
    // "Hubungan dengan dokumen lain" di dokumen itu).
    expect(baca("frontend/docs/UI-CONSISTENCY-CONTRACT.md")).toContain(
      "huruf besar semua HANYA untuk nilai sistem",
    )
  })
})