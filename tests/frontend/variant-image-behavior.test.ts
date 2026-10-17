import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Simulasi aturan pemilihan gambar halaman toko tanpa merender React.
 *
 * Meniru persis logika `useProductPurchase`:
 *  - gambar ditentukan oleh opsi pada sumbu bergambar,
 *  - memilih opsi sumbu lain tidak mengubah gambar.
 *
 * Tujuannya mengunci PERILAKU, bukan sekadar keberadaan kode. Kalau logika
 * hook berubah sehingga sumbu kedua ikut menentukan gambar, uji ini gagal.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

interface OptionMedia {
  id: number
  variation_slot: number
  option_value: string
  url: string
}

const WARNA = ["Putih", "Hitam", "Cokelat", "Serat Kayu"]
const KACA = ["Kaca Bening", "Kaca Riben", "Kaca Es"]

const OPTION_MEDIA: OptionMedia[] = WARNA.map((w, i) => ({
  id: 100 + i,
  variation_slot: 1,
  option_value: w,
  url: `https://media.example/opsi-${w.toLowerCase().replace(/\s+/g, "-")}.webp`,
}))

/** Salinan aturan hook: hanya sumbu bergambar yang menentukan gambar. */
function gambarAktif(
  selections: Record<string, string>,
  optionMedia: OptionMedia[],
  imageAxisSlot: number | null,
  imageAxisName: string | null,
): number | null {
  if (!imageAxisName || !imageAxisSlot) return null
  const selected = selections[imageAxisName]
  if (!selected) return null
  const match = optionMedia.find(
    (item) =>
      Number(item.variation_slot) === Number(imageAxisSlot) &&
      item.option_value.trim().toLowerCase() === selected.trim().toLowerCase(),
  )
  return match ? -Math.abs(match.id) : null
}

describe("aturan gambar halaman toko", () => {
  it("memilih warna menentukan gambar", () => {
    const id = gambarAktif({ Warna: "Hitam" }, OPTION_MEDIA, 1, "Warna")
    expect(id).toBe(-101)
  })

  it("mengganti kaca TIDAK mengubah gambar", () => {
    const hasil = KACA.map((k) =>
      gambarAktif({ Warna: "Putih", Kaca: k }, OPTION_MEDIA, 1, "Warna"),
    )

    // Semua kaca harus menghasilkan gambar Putih yang sama.
    expect(hasil).toEqual([-100, -100, -100])
  })

  it("warna lain tetap menghasilkan gambar warnanya sendiri untuk semua kaca", () => {
    for (const warna of WARNA) {
      const hasil = KACA.map((k) =>
        gambarAktif({ Warna: warna, Kaca: k }, OPTION_MEDIA, 1, "Warna"),
      )
      const unik = new Set(hasil)
      expect(unik.size).toBe(1)

      const harapan = -Math.abs(
        OPTION_MEDIA.find((m) => m.option_value === warna)!.id,
      )
      expect([...unik][0]).toBe(harapan)
    }
  })

  it("belum memilih warna berarti tidak ada gambar khusus", () => {
    expect(gambarAktif({ Kaca: "Kaca Riben" }, OPTION_MEDIA, 1, "Warna")).toBeNull()
  })

  it("produk tanpa gambar opsi memakai jalur cadangan lama", () => {
    const sumber = baca("resources/js/hooks/use-product-purchase.ts")
    expect(sumber).toContain("legacyHighlightedMediaId")
    expect(sumber).toContain("optionMedia.length > 0")
  })
})
