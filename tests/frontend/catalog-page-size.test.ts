import { describe, expect, it } from "vitest"

import {
  CATALOG_MOBILE_BREAKPOINT,
  catalogPageSizeParam,
  clampCatalogPage,
  resolveCatalogPageSize,
} from "@/lib/catalog-page-size"

const sizes = { desktop: 15, mobile: 16 }

describe("resolveCatalogPageSize", () => {
  it("memakai ukuran mobile di bawah breakpoint sm", () => {
    expect(resolveCatalogPageSize(320, sizes)).toBe(16)
    expect(resolveCatalogPageSize(390, sizes)).toBe(16)
    expect(resolveCatalogPageSize(CATALOG_MOBILE_BREAKPOINT - 1, sizes)).toBe(16)
  })

  it("memakai ukuran desktop sejak breakpoint sm", () => {
    expect(resolveCatalogPageSize(CATALOG_MOBILE_BREAKPOINT, sizes)).toBe(15)
    expect(resolveCatalogPageSize(768, sizes)).toBe(15)
    expect(resolveCatalogPageSize(1280, sizes)).toBe(15)
    expect(resolveCatalogPageSize(1920, sizes)).toBe(15)
  })

  it("memakai ukuran desktop saat lebar belum terukur", () => {
    // 0 = belum diukur. Harus sama dengan default server supaya render pertama
    // tidak memicu permintaan ulang yang tidak perlu.
    expect(resolveCatalogPageSize(0, sizes)).toBe(15)
    expect(resolveCatalogPageSize(Number.NaN, sizes)).toBe(15)
    expect(resolveCatalogPageSize(-10, sizes)).toBe(15)
  })
})

describe("catalogPageSizeParam", () => {
  it("tidak mengirim parameter untuk ukuran desktop", () => {
    expect(catalogPageSizeParam(15, sizes)).toBeUndefined()
  })

  it("mengirim parameter untuk ukuran mobile", () => {
    expect(catalogPageSizeParam(16, sizes)).toBe(16)
  })
})

describe("clampCatalogPage", () => {
  it("mempertahankan halaman yang masih ada", () => {
    expect(clampCatalogPage(1, 100, 16)).toBe(1)
    expect(clampCatalogPage(3, 100, 16)).toBe(3)
  })

  it("menjepit halaman yang melewati jumlah halaman baru", () => {
    // 31 produk: 15 per halaman = 3 halaman, 16 per halaman = 2 halaman.
    // Halaman 3 tidak ada lagi, jadi harus turun ke 2 supaya tidak kosong.
    expect(clampCatalogPage(3, 31, 16)).toBe(2)
    expect(clampCatalogPage(9, 31, 16)).toBe(2)
  })

  it("menjaga halaman minimal 1", () => {
    expect(clampCatalogPage(0, 100, 16)).toBe(1)
    expect(clampCatalogPage(-4, 100, 16)).toBe(1)
    expect(clampCatalogPage(Number.NaN, 100, 16)).toBe(1)
  })

  it("aman saat total atau ukuran tidak valid", () => {
    expect(clampCatalogPage(4, 0, 16)).toBe(1)
    expect(clampCatalogPage(4, 100, 0)).toBe(1)
  })

  it("halaman terakhir selalu tepat di batas", () => {
    expect(clampCatalogPage(7, 100, 15)).toBe(7)
    expect(clampCatalogPage(8, 100, 15)).toBe(7)
  })
})
