import { describe, expect, it } from "vitest"

import {
  buildReorderItems,
  moveRow,
  numberRows,
} from "@/hooks/use-reorder-mode"

/**
 * Mesin mode Urutkan dipakai sembilan halaman admin, dan dua di antaranya
 * pernah mengalami bug sinkronisasi snapshot. Tes ini mengunci bagian murninya:
 * geser baris, penomoran ulang, dan penyusunan payload.
 */
describe("moveRow", () => {
  const baris = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]

  it("memindahkan baris ke depan", () => {
    expect(moveRow(baris, 0, 2).map((r) => r.id)).toEqual([2, 3, 1, 4])
  })

  it("memindahkan baris ke belakang", () => {
    expect(moveRow(baris, 3, 1).map((r) => r.id)).toEqual([1, 4, 2, 3])
  })

  it("mengembalikan array yang sama saat posisi tidak berubah", () => {
    expect(moveRow(baris, 2, 2)).toBe(baris)
  })

  it("mengabaikan indeks di luar rentang", () => {
    expect(moveRow(baris, -1, 2)).toBe(baris)
    expect(moveRow(baris, 0, 9)).toBe(baris)
    expect(moveRow(baris, 4, 0)).toBe(baris)
  })

  it("tidak mengubah array asal", () => {
    moveRow(baris, 0, 3)
    expect(baris.map((r) => r.id)).toEqual([1, 2, 3, 4])
  })
})

describe("numberRows", () => {
  it("menulis ulang nomor tampil dan nomor urut sesuai posisi", () => {
    const hasil = numberRows([{ id: 9, no: 7, sort_order: 7 }, { id: 3, no: 2, sort_order: 2 }])
    expect(hasil).toEqual([
      { id: 9, no: 1, sort_order: 0 },
      { id: 3, no: 2, sort_order: 1 },
    ])
  })

  it("mempertahankan kolom lain pada baris", () => {
    const hasil = numberRows([{ id: 1, nama: "bracket" }])
    expect(hasil[0]).toMatchObject({ id: 1, nama: "bracket", no: 1, sort_order: 0 })
  })
})

describe("buildReorderItems", () => {
  it("menyusun payload id dan sort_order berurutan", () => {
    expect(buildReorderItems([{ id: 5 }, { id: 2 }, { id: 8 }])).toEqual([
      { id: 5, sort_order: 0 },
      { id: 2, sort_order: 1 },
      { id: 8, sort_order: 2 },
    ])
  })

  it("menerima kunci bertipe teks", () => {
    expect(buildReorderItems([{ id: "sub-1" }])).toEqual([{ id: "sub-1", sort_order: 0 }])
  })

  it("mengembalikan daftar kosong untuk daftar kosong", () => {
    expect(buildReorderItems([])).toEqual([])
  })
})
