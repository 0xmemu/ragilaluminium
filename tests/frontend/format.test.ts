import { describe, expect, it } from "vitest"

import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRentangTanggal,
  formatRentangWaktu,
  formatWaktuRingkas,
  humanize,
  productName,
  stripHtml,
  formatPhoneLocal,
  telephoneHref,
} from "@/lib/format"

describe("format helpers", () => {
  it("formats IDR without fractional digits", () => {
    expect(formatCurrency(1250000)).toMatch(/Rp\s?1\.250\.000/)
    expect(formatCurrency("invalid")).toMatch(/Rp\s?0/)
  })

  it("formats numbers and unavailable values predictably", () => {
    expect(formatNumber(12000)).toBe("12.000")
    expect(formatDate(null)).toBe("Belum tersedia")
    expect(formatDate("not-a-date")).toBe("not-a-date")
  })

  it("humanizes status keys and booleans", () => {
    expect(humanize("pending_payment")).toBe("Pending Payment")
    expect(humanize("cod")).toBe("COD")
    expect(humanize("COD")).toBe("COD")
    expect(humanize(true)).toBe("Ya")
    expect(humanize("")).toBe("Belum tersedia")
  })

  it("strips markup and prefers full catalog name over short_name", () => {
    expect(stripHtml("<p>Pintu <strong>minimalis</strong></p>")).toBe("Pintu minimalis")
    expect(productName("Nama panjang", " Nama pendek ")).toBe("Nama panjang")
    expect(productName(" ", " Nama pendek ")).toBe("Nama pendek")
    expect(productName("Nama panjang", " ")).toBe("Nama panjang")
  })

  it("compacts size units so cm does not orphan onto the next line", () => {
    expect(productName("Tinggi 100 Cm X Panjang 80 Cm Jendela Jungkit")).toBe(
      "Tinggi 100Cm × Panjang 80Cm Jendela Jungkit",
    )
    expect(productName("Tinggi 50 cm x Panjang 80 cm")).toBe("Tinggi 50cm × Panjang 80cm")
  })

  it("builds a safe telephone href from a formatted phone number", () => {
    const formattedPhone = ["+62", "(800)", "1234-5678"].join(" ")
    expect(telephoneHref(formattedPhone)).toBe(["tel:+62", "80012345678"].join(""))
    expect(telephoneHref("0812 3456 7890")).toBe("tel:081234567890")
  })

  it("rejects unusable or masked telephone values", () => {
    expect(telephoneHref(null)).toBeNull()
    expect(telephoneHref("   ")).toBeNull()
    expect(telephoneHref("+---()")).toBeNull()
    expect(telephoneHref("+62 812 **** 7890")).toBeNull()
    expect(telephoneHref("123456")).toBeNull()
  })
  it("formats phone number for customer display in 08xxx format", () => {
    expect(formatPhoneLocal("6285725116817")).toBe("085725116817")
    expect(formatPhoneLocal("6285725116817", true)).toBe("0857-2511-6817")
    expect(formatPhoneLocal("+62 857-2511-6817")).toBe("085725116817")
    expect(formatPhoneLocal("+62 857-2511-6817", true)).toBe("0857-2511-6817")
    expect(formatPhoneLocal("085725116817", true)).toBe("0857-2511-6817")
    expect(formatPhoneLocal(null)).toBe("")
    expect(formatPhoneLocal("")).toBe("")
  })
})

describe("rentang berlaku entitas berjadwal", () => {
  it("menulis kedua tanggal dengan tanda panah saat keduanya terisi", () => {
    const teks = formatRentangTanggal("2026-07-01", "2026-09-30")

    expect(teks).toMatch(/^1\s?(Jul|Juli)\s?2026\s→\s30\s?(Sep|September)\s?2026$/)
  })

  it("menulis Tanpa batas sekali saja saat kedua sisi kosong, bukan tanda hubung", () => {
    // Bar promo tanpa tanggal berlaku terus: penyaring tayang memperlakukan
    // tanggal mulai kosong sebagai "sudah boleh tampil" dan tanggal akhir
    // kosong sebagai "tanpa batas akhir".
    expect(formatRentangTanggal(null, null)).toBe("Tanpa batas")
    expect(formatRentangTanggal("", undefined)).toBe("Tanpa batas")
    expect(formatRentangTanggal(null, null)).not.toContain("-")
  })

  it("menyebut sisi yang kosong dengan kata, bukan tanda hubung", () => {
    expect(formatRentangTanggal("2026-07-01", null)).toMatch(/^Mulai 1\s?(Jul|Juli)\s?2026$/)
    expect(formatRentangTanggal(null, "2026-09-30")).toMatch(/^Sampai 30\s?(Sep|September)\s?2026$/)
  })

  it("tidak menampilkan teks tanggal rusak apa adanya", () => {
    expect(formatRentangTanggal("bukan tanggal", null)).toBe("Tanpa batas")
  })
})

describe("rentang waktu entitas berjadwal (beserta jam)", () => {
  it("menulis tanggal dan jam dalam gaya baku tabel admin", () => {
    // Waktu bervariasi menurut zona, jadi yang dikunci bentuknya, bukan jamnya.
    expect(formatWaktuRingkas("2026-09-16T22:27:00+07:00")).toMatch(
      /^\d{1,2}\s?(Sep|September)\s?2026,\s?\d{2}\.\d{2}$/,
    )
  })

  it("mengembalikan null untuk nilai kosong atau rusak", () => {
    expect(formatWaktuRingkas(null)).toBeNull()
    expect(formatWaktuRingkas(undefined)).toBeNull()
    expect(formatWaktuRingkas("bukan tanggal")).toBeNull()
    expect(formatWaktuRingkas("")).toBeNull()
  })

  it("menulis kedua sisi dengan tanda panah saat keduanya terisi", () => {
    const teks = formatRentangWaktu("2026-09-16T22:27:00+07:00", "2026-10-16T22:37:00+07:00")

    expect(teks).toContain("→")
    expect(teks).not.toContain("Tanpa batas")
    expect(teks).toMatch(/\d{4},\s?\d{2}\.\d{2}\s→\s\d{1,2}/)
  })

  it("menulis Tanpa batas sekali saja saat kedua sisi kosong", () => {
    expect(formatRentangWaktu(null, null)).toBe("Tanpa batas")
    expect(formatRentangWaktu(null, null)).not.toContain("→")
    expect(formatRentangWaktu("", undefined)).toBe("Tanpa batas")
  })

  it("menyebut sisi yang kosong dengan kata, bukan tanda hubung", () => {
    expect(formatRentangWaktu("2026-09-16T22:27:00+07:00", null)).toMatch(/^Mulai /)
    expect(formatRentangWaktu(null, "2026-10-16T22:37:00+07:00")).toMatch(/^Sampai /)
  })

  it("tidak pernah menampilkan kata kembar tanpa arti", () => {
    // Dulu kolom periode bisa berbunyi "tanpa batas → tanpa batas".
    expect(formatRentangWaktu("bukan tanggal", "juga bukan")).toBe("Tanpa batas")
    expect(formatRentangWaktu("2026-09-16T22:27:00+07:00", "rusak")).toMatch(/^Mulai /)
  })
})
