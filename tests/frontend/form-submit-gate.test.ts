import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga gerbang tombol simpan form (kontrak owner 2026-10-12).
 *
 * Tombol simpan tidak boleh aktif saat memang belum ada yang bisa dikirim:
 * di form tambah kolom wajibnya masih kosong, atau di form edit belum ada
 * perubahan sama sekali. Membiarkan tombol aktif padahal permintaannya pasti
 * ditolak membuat admin menebak kenapa tidak terjadi apa apa.
 *
 * Sebelumnya hanya `form.processing` yang mengunci tombol, jadi form kosong
 * tetap bisa ditekan dan baru ketahuan salah setelah server menolaknya.
 * Penjaga ini membaca sumber karena aturannya hidup di ekspresi JSX, bukan di
 * fungsi yang bisa diimpor.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

const berkas = [
  {
    nama: "resources/js/pages/Admin/Announcements/Form.tsx",
    // Kolom wajib form Bar Promo, sejajar aturan server: text required.
    syaratWajib: "form.data.text.trim()",
  },
  {
    nama: "resources/js/pages/Admin/Banners/Form.tsx",
    // Gambar wajib saat tambah; saat edit yang dihitung ada tidaknya gambar.
    syaratWajib: "!previewUrl",
  },
]

describe("gerbang tombol simpan form", () => {
  it.each(berkas)("$nama mengunci tombol saat belum ada yang bisa dikirim", ({ nama, syaratWajib }) => {
    const kode = baca(nama)

    // Syarat kolom wajib dihitung, bukan diserahkan ke server.
    expect(kode).toContain(syaratWajib)
    expect(kode).toContain("const terkunci")

    // Gerbang perubahan (form edit) wajib ada, bukan hanya syarat kolom.
    expect(kode).toContain("isEdit && !form.isDirty")

    // Tombol benar benar memakai gerbang, tidak berhenti di processing.
    expect(kode).toMatch(/disabled=\{form\.processing \|\| terkunci\}/)
  })

  it.each(berkas)("$nama memberi alasan lewat hint di tombol yang sama", ({ nama }) => {
    const kode = baca(nama)
    expect(kode).toContain('from "@/components/admin/ui/hint-tip"')
    expect(kode).toContain("<HintTip")
    expect(kode).toContain("alasanTerkunci")
  })
})
