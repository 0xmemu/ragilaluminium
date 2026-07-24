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

const doorVariants: ProductVariant[] = [
  {
    id: 10,
    variant_sku: "DOOR-R-WHT",
    price: 2190000,
    stock: 4,
    variation_1_name: "Warna",
    variation_1_option: "Buka Kanan",
    variation_2_name: "Kaca",
    variation_2_option: "Putih Kaca Bening",
    label: "Buka Kanan / Putih Kaca Bening",
  },
  {
    id: 11,
    variant_sku: "DOOR-L-BLK",
    price: 2190000,
    stock: 2,
    variation_1_name: "Warna",
    variation_1_option: "Buka Kiri",
    variation_2_name: "Kaca",
    variation_2_option: "Hitam Kaca Es",
    label: "Buka Kiri / Hitam Kaca Es",
  },
  {
    id: 12,
    variant_sku: "DOOR-R-TYPO",
    price: 2190000,
    stock: 1,
    variation_1_name: "Warna",
    variation_1_option: "Buka Kanan",
    variation_2_name: "Kaca",
    variation_2_option: "Serat Kayu KcaBening",
    label: "Buka Kanan / Serat Kayu KcaBening",
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

  it("keeps door Shopee axes as Arah Buka + Warna & Kaca (not window Warna/Kaca split)", () => {
    expect(variantAxes(doorVariants)).toEqual([
      { name: "Arah Buka", options: ["Buka Kanan", "Buka Kiri"] },
      {
        name: "Warna & Kaca",
        options: ["Putih Kaca Bening", "Hitam Kaca Es", "Serat Kayu Kaca Bening"],
      },
    ])
    expect(
      resolveVariant(doorVariants, {
        "Arah Buka": "Buka Kanan",
        "Warna & Kaca": "Putih Kaca Bening",
      })?.variant_sku,
    ).toBe("DOOR-R-WHT")
    expect(
      resolveVariant(doorVariants, {
        "Arah Buka": "Buka Kanan",
        "Warna & Kaca": "Serat Kayu Kaca Bening",
      })?.variant_sku,
    ).toBe("DOOR-R-TYPO")
  })
})
