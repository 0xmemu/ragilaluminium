import { describe, expect, it } from "vitest"

import { filterSearchOptions, markGroupRows, withCreatableRow } from "@/lib/search-select"

describe("filterSearchOptions", () => {
  const options = [
    { value: "JUNGKIT_1_DAUN", label: "Jungkit Satu Daun" },
    { value: "JUNGKIT_2_DAUN", label: "Jungkit Dua Daun" },
    { value: "KACA_MATI", label: "Kaca Mati" },
    { value: "ZIGZAG", label: "Zigzag" },
  ]

  it("returns all options when query is empty or blank", () => {
    expect(filterSearchOptions(options, "")).toHaveLength(4)
    expect(filterSearchOptions(options, "   ")).toHaveLength(4)
  })

  it("matches label case-insensitively", () => {
    expect(filterSearchOptions(options, "kaca")).toEqual([
      { value: "KACA_MATI", label: "Kaca Mati" },
    ])
  })

  it("matches partial labels", () => {
    expect(filterSearchOptions(options, "daun")).toHaveLength(2)
  })

  it("returns empty for unknown query", () => {
    expect(filterSearchOptions(options, "sliding")).toEqual([])
  })
})

describe("withCreatableRow", () => {
  const options = [
    { value: "POLOS", label: "Polos" },
    { value: "ORNAMEN", label: "Ornamen" },
  ]

  it("tidak menambah baris saat creatable dimatikan", () => {
    expect(withCreatableRow(options, "KOMBINASI", false)).toHaveLength(0)
  })

  it("tidak menambah baris saat ketikan kosong", () => {
    expect(withCreatableRow(options, "", true)).toHaveLength(2)
    expect(withCreatableRow(options, "   ", true)).toHaveLength(2)
  })

  it("tidak menambah baris bila ketikan sudah ada di daftar", () => {
    // Cocok tanpa peduli besar-kecil huruf, jadi tidak boleh jadi baris ganda.
    expect(withCreatableRow(options, "polos", true)).toHaveLength(1)
    expect(withCreatableRow(options, "POLOS", true)).toHaveLength(1)
    expect(withCreatableRow(options, "Ornamen", true)).toHaveLength(1)
  })

  it("menambah baris nilai baru saat ketikan belum terdaftar", () => {
    // Ketikan menyaring label lebih dulu, jadi hasilnya baris baru itu sendiri.
    const rows = withCreatableRow(options, "KOMBINASI", true)
    expect(rows).toEqual([{ value: "KOMBINASI", label: "KOMBINASI", custom: true }])
  })

  it("menaruh baris nilai baru di akhir setelah hasil filter", () => {
    // "o" cocok dengan Polos dan Ornamen, lalu baris baru menyusul di akhir.
    const rows = withCreatableRow(options, "o", true)
    expect(rows.map((row) => row.value)).toEqual(["POLOS", "ORNAMEN", "o"])
    expect(rows[2].custom).toBe(true)
  })

  it("menandai baris opsi biasa tanpa tanda custom", () => {
    const rows = withCreatableRow(options, "", true)
    expect(rows.every((row) => row.custom === undefined)).toBe(true)
  })

  it("memfilter dulu lalu menambah baris baru di akhir", () => {
    // Ketikan "orn" menyaring ke Ornamen; kode baru "ORNAMEN_BARU" belum ada
    // padanannya sehingga muncul sebagai baris terakhir.
    const rows = withCreatableRow(options, "ORNAMEN_BARU", true)
    expect(rows).toHaveLength(1)
    expect(rows[0].custom).toBe(true)
    expect(rows[0].value).toBe("ORNAMEN_BARU")
  })

  it("menerima kode sub model bebas seperti ZIGZAG + ORNAMEN", () => {
    // Kasus nyata: model ZIGZAG tidak punya sub model terdaftar sama sekali,
    // jadi daftar opsi kosong dan admin mengetik kodenya sendiri.
    const rows = withCreatableRow([], "ORNAMEN", true)
    expect(rows).toEqual([{ value: "ORNAMEN", label: "ORNAMEN", custom: true }])
  })
})

describe("markGroupRows", () => {
  const rows = [
    { product_model: "JUNGKIT_1_DAUN", model_label: "Jungkit 1 Daun", code: "JALUSI" },
    { product_model: "SWING_2_DAUN", model_label: "Swing 2 Daun", code: "JALUSI" },
    { product_model: "SWING_2_DAUN", model_label: "Swing 2 Daun", code: "SERIES_D" },
    { product_model: "SWING_2_DAUN", model_label: "Swing 2 Daun", code: "ORNA" },
  ]

  it("marks first row of each model as group header", () => {
    const result = markGroupRows(rows)
    expect(result[0].groupHeader).toBe(true)
    expect(result[1].groupHeader).toBe(true)
    expect(result[2].groupHeader).toBe(false)
    expect(result[3].groupHeader).toBe(false)
  })

  it("numbers rows within their group, restarting per model", () => {
    const result = markGroupRows(rows)
    expect(result.map((row) => row.displayNumber)).toEqual([1, 1, 2, 3])
  })

  it("does not mutate input rows", () => {
    const original = [...rows]
    markGroupRows(rows)
    expect(rows).toEqual(original)
  })
})
