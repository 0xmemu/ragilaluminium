import { describe, expect, it } from "vitest"

import { shouldPlayGalleryVideo, shouldPlayPreviewVideo } from "@/lib/gallery-video"

/**
 * Kontrak owner 2026-09-18: autoplay boleh, tetapi video TIDAK boleh berputar
 * saat sedang tidak terlihat.
 *
 * Kasus yang dikunci di sini persis dua keluhan owner:
 *   - video di galeri utama tidak boleh jalan saat galeri tergulir keluar layar,
 *   - video di mode preview tidak boleh jalan saat pembeli melihat foto lain.
 */
describe("shouldPlayGalleryVideo", () => {
  const dasar = {
    isActive: true,
    galleryInView: true,
    isPreviewOpen: false,
    pageVisible: true,
  }

  it("memutar video hanya saat slide video aktif dan galeri terlihat", () => {
    expect(shouldPlayGalleryVideo(dasar)).toBe(true)
  })

  it("tidak memutar video saat slide video tidak aktif", () => {
    expect(shouldPlayGalleryVideo({ ...dasar, isActive: false })).toBe(false)
  })

  it("tidak memutar video saat galeri tergulir keluar layar", () => {
    expect(shouldPlayGalleryVideo({ ...dasar, galleryInView: false })).toBe(false)
  })

  it("tidak memutar video saat mode preview sedang dibuka", () => {
    expect(shouldPlayGalleryVideo({ ...dasar, isPreviewOpen: true })).toBe(false)
  })

  it("tidak memutar video saat tab atau jendela tidak aktif", () => {
    expect(shouldPlayGalleryVideo({ ...dasar, pageVisible: false })).toBe(false)
  })

  it("wajib keempat syarat terpenuhi sekaligus", () => {
    expect(
      shouldPlayGalleryVideo({
        isActive: true,
        galleryInView: true,
        isPreviewOpen: true,
        pageVisible: true,
      }),
    ).toBe(false)
    expect(
      shouldPlayGalleryVideo({
        isActive: true,
        galleryInView: false,
        isPreviewOpen: false,
        pageVisible: true,
      }),
    ).toBe(false)
    expect(
      shouldPlayGalleryVideo({
        isActive: true,
        galleryInView: true,
        isPreviewOpen: false,
        pageVisible: false,
      }),
    ).toBe(false)
  })
})

describe("shouldPlayPreviewVideo", () => {
  it("memutar video di preview saat slide videonya aktif", () => {
    expect(shouldPlayPreviewVideo(true)).toBe(true)
  })

  it("tidak memutar video di preview saat pembeli melihat foto lain", () => {
    expect(shouldPlayPreviewVideo(false)).toBe(false)
  })
})
