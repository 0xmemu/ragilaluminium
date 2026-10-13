import { describe, expect, it } from "vitest"

import {
  buildVisiblePages,
  PAGINATION_MIDDLE_DESKTOP,
  PAGINATION_MIDDLE_MOBILE,
} from "@/lib/pagination"

/**
 * Kontrak owner 2026-09-16: nomor halaman tampil di semua ukuran layar,
 * cakupannya menyesuaikan lebar (desktop `1 2 3 4 … 8`, mobile `1 2 3 … 8`).
 */
describe("buildVisiblePages", () => {
  it("menampilkan semua nomor tanpa ellipsis bila halaman sedikit", () => {
    expect(buildVisiblePages(3, 1, PAGINATION_MIDDLE_DESKTOP)).toEqual([1, 2, 3])
    expect(buildVisiblePages(5, 3, PAGINATION_MIDDLE_DESKTOP)).toEqual([1, 2, 3, 4, 5])
  })

  it("cakupan desktop: 1 2 3 4 … 8 di halaman pertama", () => {
    expect(buildVisiblePages(8, 1, PAGINATION_MIDDLE_DESKTOP)).toEqual([1, 2, 3, 4, "gap", 8])
  })

  it("cakupan mobile: 1 2 3 … 8 di halaman pertama (lebih sedikit nomor)", () => {
    expect(buildVisiblePages(8, 1, PAGINATION_MIDDLE_MOBILE)).toEqual([1, 2, 3, "gap", 8])
  })

  it("selalu menampilkan halaman pertama dan terakhir", () => {
    for (const current of [1, 2, 4, 7, 12, 20]) {
      const items = buildVisiblePages(20, current, PAGINATION_MIDDLE_MOBILE)
      expect(items[0]).toBe(1)
      expect(items[items.length - 1]).toBe(20)
    }
  })

  it("menjepit halaman terakhir pada cakupan mobile", () => {
    expect(buildVisiblePages(8, 8, PAGINATION_MIDDLE_MOBILE)).toEqual([1, "gap", 6, 7, 8])
  })

  it("tidak pernah memuat nomor di luar rentang halaman", () => {
    for (const middle of [PAGINATION_MIDDLE_MOBILE, PAGINATION_MIDDLE_DESKTOP]) {
      for (const current of [1, 2, 3, 9, 10]) {
        const items = buildVisiblePages(10, current, middle)
        const numbers = items.filter((item): item is number => item !== "gap")
        expect(numbers.every((page) => page >= 1 && page <= 10)).toBe(true)
        // Nomor unik dan terurut naik.
        expect([...new Set(numbers)]).toEqual(numbers)
      }
    }
  })

  it("menyertakan halaman aktif di dalam daftar", () => {
    for (const current of [1, 5, 10]) {
      const items = buildVisiblePages(10, current, PAGINATION_MIDDLE_DESKTOP)
      expect(items).toContain(current)
    }
  })

  it("mengembalikan daftar kosong untuk input tidak valid", () => {
    expect(buildVisiblePages(0, 1, PAGINATION_MIDDLE_DESKTOP)).toEqual([])
    expect(buildVisiblePages(-3, 1, PAGINATION_MIDDLE_MOBILE)).toEqual([])
  })

  it("tidak pernah menaruh dua gap berurutan", () => {
    for (const middle of [PAGINATION_MIDDLE_MOBILE, PAGINATION_MIDDLE_DESKTOP]) {
      for (let current = 1; current <= 12; current++) {
        const items = buildVisiblePages(12, current, middle)
        const gapIndexes = items
          .map((item, index) => (item === "gap" ? index : -1))
          .filter((index) => index >= 0)
        gapIndexes.forEach((index, position) => {
          if (position > 0) expect(index - gapIndexes[position - 1]).toBeGreaterThan(1)
        })
      }
    }
  })
})
