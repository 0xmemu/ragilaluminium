import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga kontrak GAMBAR PER OPSI (17 Oktober 2026).
 *
 * Aturan yang dikunci, diambil dari perilaku Shopee:
 *  1. Gambar variasi menempel pada NILAI OPSI, bukan pada kombinasi.
 *  2. Hanya SATU sumbu per produk yang boleh bergambar.
 *  3. Memilih opsi pada sumbu lain (mis. Kaca) tidak boleh mengubah gambar.
 *
 * Alasan: sebelum perbaikan ini gambar disimpan per kombinasi, sehingga 4
 * warna x 3 kaca menulis 12 baris media. Penyaring media kembar di server
 * menyusutkannya menjadi 4 baris yang semuanya menunjuk kombinasi pertama,
 * lalu frontend memakai `media.find` (elemen pertama) sebagai cadangan.
 * Hasilnya: memilih Kaca Riben bisa menampilkan warna yang salah, tergantung
 * urutan baris Excel. Penjaga ini memastikan pola itu tidak kembali.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

const HOOK = "resources/js/hooks/use-product-purchase.ts"
const BUY_BOX = "resources/js/components/public/product-buy-box.tsx"
const IMPORTER = "app/Imports/CatalogProductsImportV2.php"
const VERIFIER = "app/Support/CatalogImportVerifierV2.php"

describe("gambar per opsi variasi", () => {
  it("hook tidak lagi menebak gambar lewat media.find berdasarkan varian", () => {
    const sumber = baca(HOOK)

    // Pola lama: cari media pertama yang menempel pada varian mana pun yang
    // memuat opsi yang diklik. Inilah yang membuat gambar bergantung urutan
    // baris Excel, bukan opsi yang dipilih.
    expect(sumber).not.toContain("pairs.get(lastPickedOption.axis)")
    expect(sumber).not.toContain("media.find((item) => {")

    // Penggantinya: gambar dipilih dari peta opsi pada sumbu bergambar.
    expect(sumber).toContain("optionMedia")
    expect(sumber).toContain("imageAxisSlot")
    expect(sumber).toContain("imageAxisName")
  })

  it("hook memakai sumbu bergambar, bukan sembarang sumbu", () => {
    const sumber = baca(HOOK)

    expect(sumber).toContain("variantSlotAxisName")
    expect(sumber).toContain("selections[imageAxisName]")
    // Wajib ada jalur cadangan untuk produk lama yang belum dimigrasikan,
    // supaya perilaku produk lama tidak rusak sebelum datanya dipindahkan.
    expect(sumber).toContain("legacyHighlightedMediaId")
  })

  it("chip storefront hanya bergambar pada sumbu bergambar", () => {
    const sumber = baca(BUY_BOX)

    expect(sumber).toContain("imageAxisName")
    expect(sumber).toContain("optionThumbs")
    expect(sumber).toContain("axis.name === imageAxisName")
  })

  it("importer menulis gambar opsi ke tabel opsi, bukan ke media kombinasi", () => {
    const sumber = baca(IMPORTER)

    expect(sumber).toContain("ProductVariationOptionMedia")
    expect(sumber).toContain("syncOptionMedia")

    // Baris lama yang menempelkan gambar ke varian tidak boleh kembali.
    expect(sumber).not.toContain('position: 50 + min(29, $this->variantMediaCount')
  })

  it("verifier menolak gambar di dua sumbu dan opsi dengan dua gambar", () => {
    const sumber = baca(VERIFIER)

    expect(sumber).toContain("lebih dari satu sumbu")
    expect(sumber).toContain("lebih dari satu gambar berbeda")
    expect(sumber).toContain("belum:")
  })
})
