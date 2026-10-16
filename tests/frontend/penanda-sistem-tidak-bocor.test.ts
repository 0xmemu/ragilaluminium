import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga agar penanda sistem tidak bocor ke layar pengguna.
 *
 * Kontrak owner 2026-10-16: nilai yang tampil ke pengguna tidak boleh memuat
 * penanda sistem bergaya kode, yaitu snake_case (model_product_created) atau
 * bertitik (metric_basis.anchor, cms.model_product_deleted). Istilah serapan
 * yang sudah lazim seperti Slug atau Update tetap boleh.
 *
 * Bahayanya bukan teks yang salah hari ini, melainkan pengulangan pola lama:
 * mencetak nilai mentah dari server, atau menambah cadangan otomatis yang
 * mengubah kode menjadi kalimat Inggris. Penjaga ini membaca sumber, karena
 * itulah bentuk yang paling mudah terulang saat berkas disunting.
 */

const root = fileURLToPath(new URL("../../", import.meta.url))
const baca = (relatif: string) => readFileSync(join(root, relatif), "utf8")

/** Berkas yang teksnya berhadapan langsung dengan pengguna. */
const BERKAS_TAMPIL = [
  ["Log Aktivitas", "resources/js/pages/Admin/ActivityLogs/Index.tsx"],
  ["Template WhatsApp daftar", "resources/js/pages/Admin/WhatsApp/Index.tsx"],
  ["Template WhatsApp sunting", "resources/js/pages/Admin/WhatsApp/Edit.tsx"],
  ["Resource index", "resources/js/pages/Admin/ResourceIndex.tsx"],
  ["Pustaka media", "resources/js/pages/Admin/Media/Library.tsx"],
  ["Detail pesanan", "resources/js/pages/Admin/Orders/Show.tsx"],
  ["Panel konteks resource", "resources/js/components/admin/resource-context-panel.tsx"],
  ["Panel media produk", "resources/js/components/admin/product-edit/media-panel.tsx"],
] as const

/** Penanda sistem yang tidak boleh muncul di kalimat yang tampil. */
const PENANDA_SISTEM = [
  "id_key",
  "parent_sku",
  "variant_sku",
  "image_1",
  "metric_basis",
  "derivatives_failed",
  "internal_key",
  "JNT_ENABLED",
  "JNT_API_ACCOUNT",
  "JNT_PRIVATE_KEY",
] as const

/**
 * Berkas yang SENGAJA dikecualikan: penjaga konfigurasi saat aplikasi boot.
 *
 * Pesan di AppServiceProvider hanya muncul bila konfigurasi produksi salah
 * (mis. APP_DEBUG menyala di produksi), dan pembacanya operator server yang
 * memang mengatur berkas .env. Menghapus nama variabelnya justru membuat
 * operator tidak tahu apa yang harus diperbaiki, jadi berkas ini dikecualikan
 * dengan sadar, bukan karena terlewat.
 */
const DIKECUALIKAN = ["app/Providers/AppServiceProvider.php"] as const

/**
 * Ambil seluruh literal teks dari sebuah berkas, lalu kembalikan yang memuat
 * penanda sistem DAN berbentuk kalimat (mengandung spasi). Kunci kode seperti
 * "parent_sku" tanpa spasi bukan kalimat tampil, jadi tidak dihitung.
 */
function kalimatBocor(isi: string): string[] {
  // Komentar kode bukan teks yang tampil, jadi dibuang lebih dulu. Tanpa ini
  // komentar penjelas seperti "// V7: foto utama (image_1) wajib" ikut terbaca
  // sebagai kebocoran.
  const tanpaKomentar = isi
    .split("\n")
    .filter((baris) => {
      const t = baris.trim()
      return !(
        t.startsWith("//") ||
        t.startsWith("*") ||
        t.startsWith("/*") ||
        t.startsWith("#") ||
        t.startsWith("<!--")
      )
    })
    .join("\n")

  const hasil: string[] = []
  for (const literal of tanpaKomentar.split(/[\u0022\u0027]/)) {
    if (!literal.includes(" ")) continue
    if (literal.length > 400) continue
    // Bagian yang masih memuat tanda kode bukan kalimat tampil.
    if (/[;{}()=]/.test(literal)) continue
    for (const penanda of PENANDA_SISTEM) {
      if (literal.includes(penanda)) {
        hasil.push(penanda + " :: " + literal.trim().slice(0, 140))
        break
      }
    }
  }
  return hasil
}

describe("penanda sistem tidak bocor ke layar", () => {
  it.each(BERKAS_TAMPIL)(
    "%s tidak mencetak field penanda sistem tanpa label",
    (_nama, relatif) => {
      const isi = baca(relatif)

      expect(isi).not.toMatch(/\{row\.event_type\}/)
      expect(isi).not.toMatch(/\{job\.type\}/)
      expect(isi).not.toMatch(/\{asset\.status\}/)
      expect(isi).not.toMatch(/\{asset\.kind\}/)
      expect(isi).not.toMatch(/\{payment\.payment_method\}/)
      expect(isi).not.toMatch(/\{payment\.status\}/)
      expect(isi).not.toMatch(/humanize\(/)
      expect(isi).not.toMatch(/\{row\.internal_key\}/)
      expect(isi).not.toMatch(/Key: \{/)
      // Teks tooltip tetap ada di DOM untuk pembaca layar, jadi penanda
      // sistem di dalam hint juga terbaca. Dilarang sama seperti teks utama.
      expect(isi).not.toMatch(/Kunci internal/)
      expect(isi).not.toMatch(/Rujukan teknis/)
      expect(isi).not.toMatch(/env [A-Z_]{4,}/)
      expect(isi).not.toMatch(/jangan ganti jadi nama seperti/)
      expect(isi).not.toMatch(/>Payment #/)
    },
  )

  it("cadangan label status tidak mengubah kode menjadi kalimat Inggris", () => {
    const isi = baca("resources/js/lib/status.ts")
    expect(isi).not.toMatch(/replace\(\/_\/g/)
    expect(isi).toContain("Status lain")
  })

  it("cadangan label pesanan tidak memakai pemisah penanda sistem", () => {
    const isi = baca("app/Support/OrderEventLabels.php")
    expect(isi).not.toContain("str_replace")
    for (const jenis of [
      "payment.reconciled",
      "system/cod_completion",
      "whatsapp.logged_out",
    ]) {
      expect(isi, jenis + " wajib punya label manusia").toContain(jenis)
    }
  })

  it("pesan integrasi yang tampil di panel admin tidak menyebut nama variabel", () => {
    // Pesan ini sampai ke layar admin lewat flash error dan ringkasan
    // Pengaturan Sistem, jadi tidak boleh memuat nama variabel lingkungan.
    const berkas = [
      "app/Services/ShippingService.php",
      "app/Services/SystemHealthService.php",
    ]
    for (const relatif of berkas) {
      const isi = baca(relatif)
      for (const nama of ["JNT_ENABLED", "JNT_API_ACCOUNT", "JNT_PRIVATE_KEY", "JNT_CUSTOMER_CODE"]) {
        expect(isi, relatif + " menyebut " + nama).not.toContain(nama)
      }
      expect(isi).not.toContain("di .env")
    }
  })

  it("penjaga konfigurasi boot tetap boleh menyebut nama variabel", () => {
    // Kebalikan dari uji di atas: berkas ini memang untuk operator server,
    // jadi nama variabelnya dipertahankan dan tidak boleh ikut dibersihkan.
    const isi = baca("app/Providers/AppServiceProvider.php")
    expect(isi).toContain("APP_DEBUG")
    expect(DIKECUALIKAN).toContain("app/Providers/AppServiceProvider.php")
  })

  it("pesan batas ukuran berkas memakai satuan yang mudah dibaca", () => {
    // Angka byte mentah ("52428800B") memaksa admin menghitung sendiri.
    // Semua pesan ukuran wajib lewat helper ByteSize.
    const berkas = [
      "app/Http/Controllers/Admin/MediaUploadController.php",
      "app/Http/Controllers/Admin/MediaLibraryUploadController.php",
      "app/Jobs/ProcessUploadedMediaAsset.php",
      "app/Jobs/DownloadMediaAsset.php",
      "app/Jobs/DownloadProductMedia.php",
    ]
    for (const relatif of berkas) {
      const isi = baca(relatif)
      expect(isi, relatif + " memuat angka byte mentah").not.toMatch(/\{\$[a-zA-Z]+\}B/)
      expect(isi, relatif + " memuat kata byte mentah").not.toMatch(/\{\$[a-zA-Z]+\} byte/)
    }
    // Helper-nya wajib ada supaya pesan tetap bisa dibaca manusia.
    const helper = baca("app/Support/ByteSize.php")
    expect(helper).toContain("MB")
    expect(helper).toContain("KB")
  })

  it("pesan galat tidak menyebut nama kolom basis data", () => {
    const berkas = [
      "app/Support/CatalogImportVerifier.php",
      "app/Http/Controllers/Admin/ImportJobController.php",
      "app/Imports/ImportStockPriceUpdate.php",
      "app/Imports/ImportMediaUpdate.php",
      "app/Imports/CatalogProductsImport.php",
      "app/Jobs/DownloadProductMedia.php",
      "app/Services/StorePerformanceService.php",
      "app/Support/WhatsAppAutomationCatalog.php",
      "app/Http/Controllers/Admin/MediaLibraryUploadController.php",
      "app/Jobs/DownloadMediaAsset.php",
      "app/Jobs/DownloadProductMedia.php",
      "app/Imports/archive/ShopeeMediaExport.php",
    ]
    for (const relatif of berkas) {
      expect(kalimatBocor(baca(relatif)), relatif).toEqual([])
    }
  })
})
