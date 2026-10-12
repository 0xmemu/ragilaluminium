import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga CAKUPAN gerbang isi tombol simpan (Tahap 4 rencana owner).
 *
 * Pembagian tugas dengan tests/frontend/submit-gate.test.ts: berkas itu menguji
 * PERILAKU keputusan gerbang (masukan ke keputusan, dan apakah kiriman benar
 * benar ditahan). Berkas ini menjaga SAMBUNGANNYA: form yang wajib bergerbang
 * tidak boleh kehilangan gerbangnya, dan gerbang tidak boleh menyentuh pesan
 * error server. Keduanya dibutuhkan: perilaku benar tapi tidak dipasang sama
 * dengan tidak ada gerbang, dan sebaliknya.
 *
 * Daftar berkas di bawah adalah hasil audit 13 Oktober 2026 (Tahap 0): setiap
 * tombol submit pada halaman admin diklasifikasikan, lalu kolom wajibnya
 * dicocokkan ke aturan `required` controller. Yang TIDAK masuk daftar ini dan
 * memang tidak perlu gerbang: form pencarian dan filter, tombol aksi satu
 * tindakan (terbit, arsip, prune log, ubah status, kirim ulang), form yang sudah
 * punya gerbang lebih dulu (Bar Promo, Banner, Impor, Media Library, form retur),
 * halaman yang tidak punya aturan wajib sama sekali (Tentang Kami), dan satu
 * berkas kode mati yang tidak diimpor siapa pun.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

/** Berkas yang tombol simpan/pencatatnya WAJIB bergerbang isi. */
const GERBANG_WAJIB = [
  // Katalog
  "resources/js/pages/Admin/Categories/Form.tsx",
  "resources/js/pages/Admin/ProductForm.tsx",
  "resources/js/pages/Admin/ModelProducts/Form.tsx",
  "resources/js/pages/Admin/SubModelForm.tsx",
  // CMS
  "resources/js/pages/Admin/Faq/Index.tsx",
  "resources/js/pages/Admin/ApaKata/Index.tsx",
  "resources/js/pages/Admin/MasalahSolusi/Index.tsx",
  "resources/js/pages/Admin/MasalahSolusi/Form.tsx",
  "resources/js/pages/Admin/CmsPageForm.tsx",
  "resources/js/pages/Admin/CmsDocument/Edit.tsx",
  "resources/js/pages/Admin/CaraPemesanan/Edit.tsx",
  "resources/js/pages/Admin/Beranda/HowToOrderForm.tsx",
  "resources/js/pages/Admin/InstallationGallery/Form.tsx",
  // Pengaturan
  "resources/js/pages/Admin/Profile/Edit.tsx",
  "resources/js/pages/Admin/CodSettings/Edit.tsx",
  "resources/js/pages/Admin/ShippingSubsidy/Edit.tsx",
  "resources/js/pages/Admin/WhatsApp/Edit.tsx",
  "resources/js/pages/Admin/StorefrontPlatforms/Edit.tsx",
  // Transaksi
  "resources/js/pages/Admin/Orders/Index.tsx",
  "resources/js/pages/Admin/Orders/Show.tsx",
  "resources/js/pages/Admin/Payments/Index.tsx",
  "resources/js/components/admin/resource-context-panel.tsx",
  // Promo
  "resources/js/pages/Admin/Vouchers/Form.tsx",
  "resources/js/pages/Admin/PromotionForm.tsx",
  "resources/js/pages/Admin/Testimonials/Form.tsx",
  "resources/js/pages/Admin/Testimonials/GalleryForm.tsx",
  "resources/js/pages/Admin/Products/PopularityBoosts.tsx",
  // Admin
  "resources/js/pages/Admin/Users/Form.tsx",
]

/**
 * Berkas di daftar wajib yang TIDAK punya penjaga kiriman di atribut onSubmit,
 * dengan alasannya. Form Voucher menetralkan onSubmit-nya sendiri
 * (`preventDefault` saja) dan seluruh penyimpanannya lewat tombol biasa, jadi
 * tidak ada jalur "tekan Enter" yang perlu ditahan.
 */
const TANPA_PENJAGA_KIRIMAN: Record<string, string> = {
  "resources/js/pages/Admin/Vouchers/Form.tsx":
    "formnya menetralkan onSubmit, semua simpan lewat tombol biasa",
}

const gerbang = baca("resources/js/lib/submit-gate.ts")
const tombol = baca("resources/js/components/admin/ui/submit-gate-button.tsx")

describe("cakupan gerbang isi tombol simpan", () => {
  it("setiap berkas wajib benar benar memakai gerbang", () => {
    const lupa = GERBANG_WAJIB.filter((rel) => {
      expect(existsSync(join(akar, rel)), `${rel} tidak ditemukan`).toBe(true)
      return !baca(rel).includes("<SubmitGateButton")
    })
    expect(lupa).toEqual([])
  })

  it("setiap berkas wajib menahan kiriman kosong lewat jalur onSubmit", () => {
    // Tombol mati saja tidak cukup: menekan Enter di dalam isian tetap mengirim
    // form. Halaman harus memakai penjaga kiriman, kecuali yang memang tidak
    // punya jalur itu (lihat TANPA_PENJAGA_KIRIMAN).
    const lupa = GERBANG_WAJIB.filter((rel) => {
      if (TANPA_PENJAGA_KIRIMAN[rel]) return false
      const kode = baca(rel)
      return !kode.includes("jagaGerbang(") && !kode.includes("gerbangBolehLanjut(")
    })
    expect(lupa).toEqual([])
  })

  it("alasan terkunci selalu ikut dirender di dekat tombol", () => {
    // Komponen wajib menyalurkan alasan ke hint, dan gerbang wajib punya alasan
    // setiap kali terkunci (perilakunya diuji di submit-gate.test.ts).
    expect(tombol).toContain("hint={alasan}")
    expect(gerbang).toContain("ALASAN_TANPA_PERUBAHAN")
    expect(gerbang).toMatch(/terkunci: true, alasan:/)
  })

  it("gerbang tidak pernah menyentuh pesan error server", () => {
    // Penolakan yang bukan soal kolom kosong (mis. nama sudah dipakai) harus
    // tetap terbaca dan bisa dicoba ulang. Karena itu modul gerbang dan
    // komponennya dilarang memanggil apa pun yang menghapus atau menimpa error.
    for (const [nama, kode] of [["lib", gerbang], ["komponen", tombol]] as const) {
      expect(kode, `${nama} memanggil setError`).not.toContain("setError")
      expect(kode, `${nama} memanggil clearErrors`).not.toContain("clearErrors")
      expect(kode, `${nama} menulis ke errors`).not.toMatch(/errors\s*=[^=]/)
    }
  })
})
