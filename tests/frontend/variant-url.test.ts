import { describe, expect, it } from "vitest"

import { variantUrl } from "@/lib/variants"

const PRODUCT = "https://ra.333labs.tech/product/RAQASE2KLQY3"

describe("variantUrl", () => {
  it("menulis parameter variant saat varian sudah terpilih", () => {
    expect(variantUrl(PRODUCT, "RA6ZSC47P")).toBe(`${PRODUCT}?variant=RA6ZSC47P`)
  })

  it("menghapus parameter variant saat belum ada varian terpilih", () => {
    expect(variantUrl(`${PRODUCT}?variant=RA6ZSC47P`, null)).toBe(PRODUCT)
  })

  it("membuang sisa variant dari tautan lama produk lain", () => {
    expect(variantUrl(`${PRODUCT}?variant=RA6ZSC47P&utm_source=wa`, null)).toBe(
      `${PRODUCT}?utm_source=wa`,
    )
  })

  it("mengganti variant lama, bukan menumpuknya", () => {
    expect(variantUrl(`${PRODUCT}?variant=LAMA`, "BARU")).toBe(
      `${PRODUCT}?variant=BARU`,
    )
  })

  it("tidak mengubah tautan produk tanpa varian", () => {
    expect(variantUrl(PRODUCT, null)).toBe(PRODUCT)
  })

  it("tetap menulis variant walau tanpa varian terpilih saat href kosong", () => {
    expect(variantUrl(PRODUCT, undefined)).toBe(PRODUCT)
  })
})
