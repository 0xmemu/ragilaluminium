import { describe, expect, it } from "vitest"

import {
  MASALAH_SOLUSI_MAX_MEDIA,
  MASALAH_SOLUSI_WIDE_RATIO,
  isMediaLimitReached,
  mediaLayout,
  mediaLayoutClass,
  remainingMedia,
} from "@/lib/masalah-solusi-media"

/**
 * Kontrak owner 2026-09-30: media di Masalah & Solusi TIDAK dipisah foto dan
 * video. Admin memakai satu tombol "Tambah media" dan bebas memilih dua video,
 * dua foto, atau campuran keduanya. Yang dijaga hanya jumlahnya.
 */
describe("MASALAH_SOLUSI_MAX_MEDIA", () => {
  it("batasnya dua media per item", () => {
    expect(MASALAH_SOLUSI_MAX_MEDIA).toBe(2)
  })
})

describe("isMediaLimitReached", () => {
  it("belum penuh saat baru satu media", () => {
    expect(isMediaLimitReached(1)).toBe(false)
  })

  it("penuh tepat di batas dua media", () => {
    expect(isMediaLimitReached(2)).toBe(true)
  })

  it("tetap penuh bila sudah melewati batas", () => {
    expect(isMediaLimitReached(3)).toBe(true)
  })
})

describe("remainingMedia", () => {
  it("menyisakan satu slot setelah satu media", () => {
    expect(remainingMedia(1)).toBe(1)
  })

  it("dua media berarti tidak ada sisa", () => {
    expect(remainingMedia(2)).toBe(0)
  })

  it("tidak pernah negatif", () => {
    expect(remainingMedia(5)).toBe(0)
  })
})

/**
 * Kontrak owner 2026-09-20: media dipakai seperti pasangan before dan after.
 * Foto lebar (banner, landscape) berdiri sendiri selebar penuh karena kalau
 * dipasangkan akan terhimpit separuh lebar. Foto persegi atau tegak justru
 * dipasangkan berjejer dua kolom. Dimensi di bawah adalah dimensi asli aset.
 */
describe("mediaLayout", () => {
  it("banner memanjang berdiri sendiri", () => {
    expect(mediaLayout(1400, 584)).toBe("full")
    expect(mediaLayout(1400, 480)).toBe("full")
  })

  it("landscape 16:9 dan 3:2 juga berdiri sendiri", () => {
    expect(mediaLayout(1600, 900)).toBe("full")
    expect(mediaLayout(1200, 800)).toBe("full")
  })

  it("foto persegi dipasangkan berjejer", () => {
    expect(mediaLayout(1024, 1024)).toBe("half")
    expect(mediaLayout(1040, 1040)).toBe("half")
  })

  it("foto tegak dipasangkan berjejer", () => {
    expect(mediaLayout(800, 1200)).toBe("half")
  })

  it("4:3 masih dianggap dipasangkan, belum lebar", () => {
    expect(mediaLayout(1200, 900)).toBe("half")
  })

  it("tepat di ambang rasio dianggap lebar", () => {
    expect(mediaLayout(1500, 1000)).toBe("full")
  })

  it("ukurannya belum diketahui mengembalikan null supaya bisa diukur ulang", () => {
    expect(mediaLayout(null, null)).toBe(null)
    expect(mediaLayout(undefined, 100)).toBe(null)
    expect(mediaLayout(0, 0)).toBe(null)
    expect(mediaLayout(Number.NaN, 100)).toBe(null)
  })
})

describe("mediaLayoutClass", () => {
  it("media lebar membentang dua kolom", () => {
    expect(mediaLayoutClass("full")).toBe("col-span-2")
  })

  it("media yang dipasangkan cukup satu kolom", () => {
    expect(mediaLayoutClass("half")).toBe("")
  })

  it("ukuran belum diketahui tidak memaksa lebar penuh", () => {
    expect(mediaLayoutClass(null)).toBe("")
  })
})

describe("MASALAH_SOLUSI_WIDE_RATIO", () => {
  it("ambangnya 1.5", () => {
    expect(MASALAH_SOLUSI_WIDE_RATIO).toBe(1.5)
  })
})
