import { describe, expect, it } from "vitest"

import {
  formatCurrency,
  formatDate,
  formatNumber,
  humanize,
  productName,
  stripHtml,
} from "@/lib/format"

describe("format helpers", () => {
  it("formats IDR without fractional digits", () => {
    expect(formatCurrency(1250000)).toMatch(/Rp\s?1\.250\.000/)
    expect(formatCurrency("invalid")).toMatch(/Rp\s?0/)
  })

  it("formats numbers and unavailable values predictably", () => {
    expect(formatNumber(12000)).toBe("12.000")
    expect(formatDate(null)).toBe("Belum tersedia")
    expect(formatDate("not-a-date")).toBe("not-a-date")
  })

  it("humanizes status keys and booleans", () => {
    expect(humanize("pending_payment")).toBe("Pending Payment")
    expect(humanize(true)).toBe("Ya")
    expect(humanize("")).toBe("Belum tersedia")
  })

  it("strips markup and chooses a meaningful product name", () => {
    expect(stripHtml("<p>Pintu <strong>minimalis</strong></p>")).toBe("Pintu minimalis")
    expect(productName("Nama panjang", " Nama pendek ")).toBe("Nama pendek")
    expect(productName("Nama panjang", " ")).toBe("Nama panjang")
  })
})
