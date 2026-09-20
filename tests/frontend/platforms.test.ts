import { describe, expect, it } from "vitest"

import { channelOf, isLiveHref } from "@/lib/platforms"

/**
 * Logika daftar platform dipakai dua tempat (komponen StorefrontPlatforms dan
 * halaman Tentang Kami). Test ini mengunci aturannya supaya kedua pemakai tidak
 * pernah berbeda perilaku.
 */
describe("channelOf", () => {
  it("memakai field channel bila admin mengisinya", () => {
    expect(channelOf({ key: "apa-saja", label: "X", href: "#", channel: "marketplace" })).toBe("marketplace")
    expect(channelOf({ key: "shopee", label: "Shopee", href: "#", channel: "social" })).toBe("social")
  })

  it("menyimpulkan marketplace dari key bila channel kosong", () => {
    // Data lama belum punya field channel.
    for (const key of ["shopee", "tokopedia", "lazada", "tiktok_shop"]) {
      expect(channelOf({ key, label: key, href: "#" })).toBe("marketplace")
    }
  })

  it("menganggap key lain sebagai media sosial", () => {
    for (const key of ["instagram", "tiktok", "youtube", "facebook", "twitter"]) {
      expect(channelOf({ key, label: key, href: "#" })).toBe("social")
    }
  })

  it("field channel kosong tidak menimpa simpulan dari key", () => {
    expect(channelOf({ key: "instagram", label: "IG", href: "#", channel: undefined })).toBe("social")
    expect(channelOf({ key: "shopee", label: "Shopee", href: "#", channel: undefined })).toBe("marketplace")
  })
})

describe("isLiveHref", () => {
  it("menganggap tautan http sebagai hidup", () => {
    expect(isLiveHref("https://shopee.co.id/toko")).toBe(true)
  })

  it("menolak placeholder #, tautan kosong, dan null", () => {
    expect(isLiveHref("#")).toBe(false)
    expect(isLiveHref("")).toBe(false)
    expect(isLiveHref(null)).toBe(false)
    expect(isLiveHref(undefined)).toBe(false)
  })

  it("tautan relatif tetap dianggap hidup", () => {
    // Bukan placeholder, jadi tetap dianggap kanal aktif.
    expect(isLiveHref("/contact")).toBe(true)
  })
})
