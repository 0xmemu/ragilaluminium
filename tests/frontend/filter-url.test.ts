import { describe, expect, it } from "vitest"

import { buildFilterQuery } from "@/lib/filter-url"

describe("buildFilterQuery", () => {
  it("membuang nilai kosong dan penanda all", () => {
    const hasil = buildFilterQuery(
      { q: "", status: "all", payment_status: "paid" },
      {},
    )
    expect(hasil).toEqual({ payment_status: "paid" })
  })

  it("membuang kata kunci yang hanya berisi spasi", () => {
    const hasil = buildFilterQuery({ q: "   " }, {})
    expect(hasil).toEqual({})
  })

  it("mempertahankan kata kunci yang berisi teks", () => {
    const hasil = buildFilterQuery({}, { q: "jendela" })
    expect(hasil).toEqual({ q: "jendela" })
  })

  it("parameter baru menimpa keadaan saat ini", () => {
    const hasil = buildFilterQuery({ status: "processing" }, { status: "shipped" })
    expect(hasil).toEqual({ status: "shipped" })
  })

  it("membuang nilai yang sama dengan default server", () => {
    const hasil = buildFilterQuery(
      { per_page: "20", status: "active" },
      {},
      { defaults: { per_page: "20" } },
    )
    expect(hasil).toEqual({ status: "active" })
  })

  it("mempertahankan nilai default bila diminta eksplisit berbeda", () => {
    const hasil = buildFilterQuery({ per_page: "50" }, {}, { defaults: { per_page: "20" } })
    expect(hasil).toEqual({ per_page: "50" })
  })

  it("membuang nilai yang diubah menjadi kosong lewat parameter", () => {
    const hasil = buildFilterQuery({ q: "lama" }, { q: "" })
    expect(hasil).toEqual({})
  })

  it("mengabaikan nilai null dan undefined", () => {
    const hasil = buildFilterQuery({ a: null, b: undefined, c: "ada" }, {})
    expect(hasil).toEqual({ c: "ada" })
  })

  it("tidak mengubah objek masukan", () => {
    const current = { status: "all" }
    const params = { q: "x" }
    buildFilterQuery(current, params)
    expect(current).toEqual({ status: "all" })
    expect(params).toEqual({ q: "x" })
  })
})

describe("buildFilterQuery dengan shouldDrop", () => {
  it("membuang kunci sesuai aturan lintas kunci", () => {
    const hasil = buildFilterQuery(
      { date_preset: "today", date_from: "", date_to: "" },
      { date_from: "2026-01-01" },
      {
        shouldDrop: (key, _value, merged) =>
          (key === "date_from" || key === "date_to") && merged.date_preset !== "range",
      },
    )
    expect(hasil).toEqual({ date_preset: "today" })
  })

  it("mempertahankan kunci saat aturan lintas kunci terpenuhi", () => {
    const hasil = buildFilterQuery(
      { date_preset: "range" },
      { date_from: "2026-01-01" },
      {
        shouldDrop: (key, _value, merged) =>
          (key === "date_from" || key === "date_to") && merged.date_preset !== "range",
      },
    )
    expect(hasil).toEqual({ date_preset: "range", date_from: "2026-01-01" })
  })

  it("membuang nilai urutan default lewat shouldDrop", () => {
    const hasil = buildFilterQuery(
      { sort: "newest", status: "processing" },
      {},
      { shouldDrop: (key, value) => key === "sort" && value === "newest" },
    )
    expect(hasil).toEqual({ status: "processing" })
  })
})
