import { describe, expect, it } from "vitest"

import {
  SUGGESTION_CHIPS,
  isSuggestionSelected,
  toggleSuggestion,
} from "@/lib/review-suggestion"

const cepat = "Pengiriman cepat"
const kualitas = "Barang berkualitas"

describe("chip saran ulasan", () => {
  it("menyediakan lima teks siap pakai", () => {
    expect(SUGGESTION_CHIPS).toHaveLength(5)
    expect(SUGGESTION_CHIPS).toContain(cepat)
  })

  it("chip pertama apa adanya, berikutnya dihuruf-kecilkan", () => {
    expect(toggleSuggestion("", cepat)).toBe(cepat)
    expect(toggleSuggestion(cepat, kualitas)).toBe(`${cepat}, barang berkualitas`)
  })

  /**
   * Regresi cacat 2026-09-21: penjaga "sudah dipilih" dulu membaca nilai dari
   * render terakhir, sehingga dua klik cepat pada chip yang sama menumpuk teks
   * berulang. Nilai masukan di sini adalah nilai TERBARU, sesuai cara
   * pemanggil memakai updater.
   */
  it("dua kali pilih pada chip yang sama menghasilkan teks kosong, bukan duplikat", () => {
    const sekali = toggleSuggestion("", cepat)
    expect(sekali).toBe(cepat)
    expect(toggleSuggestion(sekali, cepat)).toBe("")
  })

  it("tidak pernah menumpuk chip yang sama walau ditekan berkali-kali", () => {
    let teks = ""
    for (let i = 0; i < 5; i++) teks = toggleSuggestion(teks, cepat)
    expect(teks).toBe(cepat)

    let lagi = ""
    for (let i = 0; i < 4; i++) lagi = toggleSuggestion(lagi, cepat)
    expect(lagi).toBe("")
  })

  /**
   * Chip kedua dan seterusnya tampil huruf kecil. Pencocokan harus tetap
   * mengenalinya, kalau tidak chip yang sudah tampil akan ditambahkan lagi.
   */
  it("mengenali chip yang sudah tersambung dalam huruf kecil", () => {
    const teks = `${cepat}, barang berkualitas`
    expect(isSuggestionSelected(teks, kualitas)).toBe(true)
    expect(toggleSuggestion(teks, kualitas)).toBe(cepat)
  })

  it("menerima huruf besar-kecil apa pun saat mencocokkan", () => {
    expect(isSuggestionSelected(cepat.toLowerCase(), cepat)).toBe(true)
    expect(isSuggestionSelected(cepat.toUpperCase(), cepat)).toBe(true)
  })

  it("tidak salah mengenali chip di tengah kalimat", () => {
    expect(isSuggestionSelected("pengiriman cepat banget sampai besok", cepat)).toBe(false)
    expect(isSuggestionSelected("barang berkualitas menurut saya", kualitas)).toBe(false)
  })

  it("merapikan koma saat chip di tengah daftar dilepas", () => {
    const teks = `${cepat}, barang berkualitas, pelayanan ramah`
    expect(toggleSuggestion(teks, kualitas)).toBe(`${cepat}, pelayanan ramah`)
  })

  it("teks tanpa chip tidak berubah", () => {
    const teks = "ukuran pas dan packing rapi"
    expect(toggleSuggestion(teks, cepat)).toBe(`${teks}, pengiriman cepat`)
  })
})
