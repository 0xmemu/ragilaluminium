import { describe, expect, it } from "vitest"

import { barisBandingkan } from "@/lib/delta-comparison"

describe("keterangan pembanding badge perubahan", () => {
  it("menyebut nilai periode sebelumnya, bukan hanya persentasenya", () => {
    const baris = barisBandingkan({
      current: "Rp 83.869.346",
      previous: "Rp 17.480.000",
      period: "24 Jul 2026 - 22 Agt 2026",
    })

    expect(baris).toEqual([
      "Periode ini: Rp 83.869.346",
      "Periode sebelumnya: Rp 17.480.000",
      "Rentang pembanding: 24 Jul 2026 - 22 Agt 2026",
    ])
  })

  it("tetap menyebut kedua nilai saat rentang pembanding tidak diketahui", () => {
    const baris = barisBandingkan({ current: "13 produk", previous: "4 produk" })

    expect(baris).toEqual(["Periode ini: 13 produk", "Periode sebelumnya: 4 produk"])
    expect(baris.some((t) => t.startsWith("Rentang pembanding:"))).toBe(false)
  })

  it("menyebut periode sebelumnya walau nilainya nol, supaya asal angkanya jelas", () => {
    // Naik dari nol dan naik dari angka besar sama-sama bisa berarti 100 persen,
    // jadi nilai asalnya wajib terbaca.
    const baris = barisBandingkan({ current: "Rp 6.617.000", previous: "Rp 0" })

    expect(baris).toContain("Periode sebelumnya: Rp 0")
  })
})
