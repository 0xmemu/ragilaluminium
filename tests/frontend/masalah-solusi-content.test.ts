import { describe, expect, it } from "vitest"

import {
  hasExampleContent,
  normalizeWhatsappNumber,
  splitOptionDescription,
} from "@/lib/masalah-solusi-content"

/**
 * Aturan isi teks Masalah & Solusi (kontrak owner 2026-10-01).
 *
 * Dua hal yang dijaga di sini: judul bagian contoh hanya tampil bila memang ada
 * isinya, dan nomor WhatsApp di keterangan opsi dikenali supaya bisa menjadi
 * tombol CTA. Keduanya dulu adalah cacat yang lolos ke halaman publik.
 */
describe("normalizeWhatsappNumber", () => {
  it("menerima nomor lokal dan mengubah awalan nol menjadi 62", () => {
    expect(normalizeWhatsappNumber("085725116817")).toBe("6285725116817")
  })

  it("menerima nomor yang sudah internasional", () => {
    expect(normalizeWhatsappNumber("6285725116817")).toBe("6285725116817")
  })

  it("menerima tanda plus dan pemisah spasi atau tanda hubung", () => {
    expect(normalizeWhatsappNumber("+62 857-2511-6817")).toBe("6285725116817")
    expect(normalizeWhatsappNumber("0857 2511 6817")).toBe("6285725116817")
    expect(normalizeWhatsappNumber("0857.2511.6817")).toBe("6285725116817")
  })

  it("menolak nomor rumah atau kantor karena tautannya menuju WhatsApp", () => {
    expect(normalizeWhatsappNumber("021-1234567")).toBe(null)
    expect(normalizeWhatsappNumber("0271 123456")).toBe(null)
  })

  it("menolak deretan angka yang terlalu pendek atau terlalu panjang", () => {
    expect(normalizeWhatsappNumber("0812345")).toBe(null)
    expect(normalizeWhatsappNumber("0812345678901234567")).toBe(null)
  })

  it("menolak teks biasa dan nilai kosong", () => {
    expect(normalizeWhatsappNumber("")).toBe(null)
    expect(normalizeWhatsappNumber("Hubungi admin")).toBe(null)
  })
})

describe("splitOptionDescription", () => {
  it("keterangan yang hanya berisi nomor menjadi satu potongan nomor", () => {
    expect(splitOptionDescription("085725116817")).toEqual([
      { kind: "phone", display: "085725116817", href: "https://wa.me/6285725116817" },
    ])
  })

  it("teks di sekitar nomor tetap ikut terbawa", () => {
    const potongan = splitOptionDescription("Hubungi 0812-3456-7890 untuk klaim")

    expect(potongan.map((p) => p.kind)).toEqual(["text", "phone", "text"])
    expect(potongan[0]).toEqual({ kind: "text", text: "Hubungi" })
    expect(potongan[1]).toEqual({
      kind: "phone",
      display: "0812-3456-7890",
      href: "https://wa.me/6281234567890",
    })
    expect(potongan[2]).toEqual({ kind: "text", text: "untuk klaim" })
  })

  it("keterangan tanpa nomor tetap satu potongan teks", () => {
    expect(splitOptionDescription("Kirim foto kerusakan lewat chat")).toEqual([
      { kind: "text", text: "Kirim foto kerusakan lewat chat" },
    ])
  })

  it("keterangan kosong tidak menghasilkan potongan", () => {
    expect(splitOptionDescription("")).toEqual([])
    expect(splitOptionDescription("   ")).toEqual([])
  })

  it("tanda kurung di ujung tidak ikut terbaca sebagai bagian nomor", () => {
    const potongan = splitOptionDescription("085725116817 (WA)")

    expect(potongan[0]).toEqual({
      kind: "phone",
      display: "085725116817",
      href: "https://wa.me/6285725116817",
    })
    expect(potongan[1]).toEqual({ kind: "text", text: "(WA)" })
  })

  it("nomor rumah tidak dijadikan tautan WhatsApp", () => {
    expect(splitOptionDescription("Telepon 021-1234567")).toEqual([
      { kind: "text", text: "Telepon 021-1234567" },
    ])
  })
})

describe("hasExampleContent", () => {
  it("benar bila ada media", () => {
    expect(hasExampleContent({ media: [{ src: "a.jpg" }] })).toBe(true)
  })

  it("benar bila ada teks pengganti", () => {
    expect(hasExampleContent({ media: [], examples_hint: "retak pada bingkai" })).toBe(true)
  })

  it("salah bila media kosong dan teks pengganti kosong atau hanya spasi", () => {
    expect(hasExampleContent({ media: [], examples_hint: "" })).toBe(false)
    expect(hasExampleContent({ examples_hint: "   " })).toBe(false)
    expect(hasExampleContent({})).toBe(false)
    expect(hasExampleContent()).toBe(false)
  })
})
