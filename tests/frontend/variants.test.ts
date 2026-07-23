import { describe, expect, it } from "vitest"

import {
  firstAvailableSelections,
  resolveVariant,
  variantAxes,
} from "@/lib/variants"
import type { ProductVariant } from "@/types"

const variants: ProductVariant[] = [
  {
    id: 1,
    variant_sku: "WIN-BLK-120",
    price: 1500000,
    stock: 0,
    variation_1_name: "Warna",
    variation_1_option: "Hitam",
    dimension_label: "120 × 100 cm",
    label: "Hitam · 120 × 100 cm",
  },
  {
    id: 2,
    variant_sku: "WIN-WHT-140",
    price: 1700000,
    stock: 5,
    variation_1_name: "Warna",
    variation_1_option: "Putih",
    dimension_label: "140 × 100 cm",
    label: "Putih · 140 × 100 cm",
  },
]

describe("product variant resolution", () => {
  it("derives option and dimension axes from backend variants", () => {
    expect(variantAxes(variants)).toEqual([
      { name: "Warna", options: ["Hitam", "Putih"] },
      { name: "Ukuran", options: ["120 × 100 cm", "140 × 100 cm"] },
    ])
  })

  it("resolves only a complete, matching selection", () => {
    expect(resolveVariant(variants, { Warna: "Putih" })).toBeNull()
    expect(
      resolveVariant(variants, {
        Warna: "Putih",
        Ukuran: "140 × 100 cm",
      })?.variant_sku,
    ).toBe("WIN-WHT-140")
  })

  it("starts with the first in-stock variant", () => {
    expect(firstAvailableSelections(variants)).toEqual({
      Warna: "Putih",
      Ukuran: "140 × 100 cm",
    })
  })

  it("returns the only variant without requiring selectors", () => {
    expect(resolveVariant([variants[0]], {})).toBe(variants[0])
    expect(firstAvailableSelections([])).toEqual({})
  })
})
