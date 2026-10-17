import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga matriks harga & stok admin (17 Oktober 2026).
 *
 * Pola Shopee yang dikunci:
 *  1. Thumbnail hanya untuk opsi pada sumbu bergambar.
 *  2. Nama opsi sumbu itu ikut di sel gambar dan DIGABUNG satu kelompok,
 *     sehingga "Putih" tidak diulang di setiap kombinasi.
 *  3. Kolom Kombinasi hanya berisi sumbu lain, dan hilang bila tidak ada.
 *  4. Urutan tampil dikelompokkan per sumbu bergambar, walau sumbunya bukan
 *     slot pertama. Tanpa ini penggabungan sel gagal saat sumbu = slot 2.
 *  5. Harga dan stok tetap per kombinasi, bukan per opsi.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")
const FORM = "resources/js/pages/Admin/ProductForm.tsx"

describe("matriks harga dan stok", () => {
  it("menampilkan thumbnail hanya untuk sumbu bergambar", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("buildAxisThumbMap")
    expect(sumber).toContain("hasAxisColumn")
    expect(sumber).toContain("imageAxisSlot")
  })

  it("menggabungkan sel gambar DAN nama opsi per kelompok", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("rowSpan={groupSpan}")
    expect(sumber).toContain("isGroupStart")
    expect(sumber).toContain("groupSpan++")
    expect(sumber).toContain("{axisValue}")
  })

  it("kolom Kombinasi hanya berisi sumbu selain sumbu bergambar", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("secondaryLabel")
    expect(sumber).toContain("combo.options.filter((_, i) => i !== axisIndex)")
    expect(sumber).toContain("showCombinationColumn")
  })

  it("urutan tampil dikelompokkan per sumbu bergambar", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("displayCombos")
    // Kunci state harga/stok tetap indeks asli, bukan indeks tampil.
    expect(sumber).toContain("index: comboIndex")
  })

  it("opsi tanpa gambar tetap tampil sebagai placeholder", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("border-dashed")
    expect(sumber).toContain('name="image"')
  })


  it("tombol sumbu bergambar memakai token tema, bukan putih di atas putih", () => {
    const sumber = baca(FORM)

    // Tema gelap admin: --foreground adalah PUTIH 96%. Kombinasi
    // bg-foreground + text-white menghasilkan teks putih di atas latar putih,
    // sehingga label tombol hilang sama sekali.
    expect(sumber).not.toContain("bg-foreground text-white")

    // Penggantinya token pasangan primary/primary-foreground, yang di tema
    // gelap berarti latar putih dengan teks gelap.
    expect(sumber).toContain("bg-primary text-primary-foreground")
    expect(sumber).toContain("aria-pressed={isImageAxis}")
  })

  it("sumbu bergambar bisa dimatikan lagi", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("setImageAxisSlot(isImageAxis ? null : defIndex + 1)")
  })

  it("harga dan stok tetap per kombinasi", () => {
    const sumber = baca(FORM)

    expect(sumber).toContain("combinations[key]")
    expect(sumber).toContain("aria-label={`Harga untuk ${combo.label}`}")
  })
})

/**
 * Simulasi pengelompokan baris matriks untuk 4 warna x 3 kaca.
 * Meniru logika di ProductForm: urutkan per sumbu bergambar, gabungkan
 * sel selama nilainya sama berturut-turut.
 */
describe("pengelompokan baris matriks", () => {
  const WARNA = ["Putih", "Hitam", "Cokelat", "Serat Kayu"]
  const KACA = ["Kaca Bening", "Kaca Riben", "Kaca Es"]

  function buildCombos(): string[][] {
    let combos: string[][] = [[]]
    for (const options of [WARNA, KACA]) {
      const next: string[][] = []
      for (const combo of combos) {
        for (const option of options) next.push([...combo, option])
      }
      combos = next
    }
    return combos
  }

  /** Tiruan displayCombos: urutkan per nilai pada sumbu bergambar. */
  function orderForAxis(combos: string[][], axisIndex: number, order: string[]): string[][] {
    const rank = new Map(order.map((v, i) => [v, i]))
    return [...combos].sort(
      (a, b) => (rank.get(a[axisIndex]) ?? 0) - (rank.get(b[axisIndex]) ?? 0),
    )
  }

  function group(ordered: string[][], axisIndex: number) {
    return ordered.map((options, index) => {
      const axisValue = options[axisIndex]
      const prev = index > 0 ? ordered[index - 1][axisIndex] : null
      const isGroupStart = prev !== axisValue

      let groupSpan = 0
      if (isGroupStart) {
        groupSpan = 1
        for (let i = index + 1; i < ordered.length; i++) {
          if (ordered[i][axisIndex] !== axisValue) break
          groupSpan++
        }
      }

      return {
        axisValue,
        isGroupStart,
        groupSpan,
        secondaryLabel: options.filter((_, i) => i !== axisIndex).join(" / "),
      }
    })
  }

  it("sumbu bergambar di slot 1: 4 kelompok berisi 3 baris", () => {
    const rows = group(orderForAxis(buildCombos(), 0, WARNA), 0)
    const starts = rows.filter((r) => r.isGroupStart)

    expect(rows).toHaveLength(12)
    expect(starts).toHaveLength(4)
    expect(starts.map((r) => r.axisValue)).toEqual(WARNA)
    expect(starts.map((r) => r.groupSpan)).toEqual([3, 3, 3, 3])
  })

  it("nama warna tidak diulang: hanya 4 baris yang membawa nama", () => {
    const rows = group(orderForAxis(buildCombos(), 0, WARNA), 0)

    expect(rows.filter((r) => r.isGroupStart).map((r) => r.axisValue)).toEqual(WARNA)
  })

  it("kolom Kombinasi berisi kaca saja", () => {
    const rows = group(orderForAxis(buildCombos(), 0, WARNA), 0)

    expect(rows.slice(0, 3).map((r) => r.secondaryLabel)).toEqual(KACA)
    expect(rows.slice(3, 6).map((r) => r.secondaryLabel)).toEqual(KACA)
  })

  it("sumbu bergambar di slot 2 tetap terkelompok setelah urutan ditata", () => {
    const rows = group(orderForAxis(buildCombos(), 1, KACA), 1)
    const starts = rows.filter((r) => r.isGroupStart)

    expect(starts).toHaveLength(3)
    expect(starts.map((r) => r.axisValue)).toEqual(KACA)
    expect(starts.map((r) => r.groupSpan)).toEqual([4, 4, 4])
    expect(rows[0].secondaryLabel).toBe("Putih")
  })

  it("tanpa pengurutan ulang, sumbu slot 2 akan gagal berkelompok", () => {
    // Bukti bahwa pengurutan itu wajib: urutan asli membuat setiap baris
    // menjadi kelompok sendiri, sehingga nama berulang 12 kali.
    const rows = group(buildCombos(), 1)

    expect(rows.filter((r) => r.isGroupStart)).toHaveLength(12)
  })
})
