import { describe, expect, it } from "vitest"

import {
  MEDIA_ZOOM_IDLE,
  MEDIA_ZOOM_MAX,
  MEDIA_ZOOM_MIN,
  MEDIA_ZOOM_TAP_TARGET,
  clampZoom,
  clampZoomOffset,
  containSize,
  isZoomed,
  maxZoomOffset,
  nextZoomStep,
  toggleZoomTarget,
  zoomAtPoint,
  zoomPercentLabel,
} from "@/lib/media-zoom"

/**
 * Kontrak owner 2026-09-18: foto di preview bisa diperbesar di ponsel maupun
 * desktop. Matematika di bawah yang menjaga zoom tetap terkendali: tidak bisa
 * melewati batas, dan berlabuh di titik yang ditunjuk.
 */
describe("clampZoom", () => {
  it("menjepit skala ke rentang yang diizinkan", () => {
    expect(clampZoom(0.2)).toBe(MEDIA_ZOOM_MIN)
    expect(clampZoom(9)).toBe(MEDIA_ZOOM_MAX)
    expect(clampZoom(2.5)).toBe(2.5)
  })

  it("nilai tidak wajar jatuh ke skala utuh", () => {
    expect(clampZoom(Number.NaN)).toBe(MEDIA_ZOOM_MIN)
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(MEDIA_ZOOM_MAX)
  })
})

describe("isZoomed", () => {
  it("skala utuh dianggap belum diperbesar", () => {
    expect(isZoomed(MEDIA_ZOOM_MIN)).toBe(false)
    expect(isZoomed(1.2)).toBe(true)
  })
})

describe("nextZoomStep", () => {
  it("naik dan turun satu langkah", () => {
    expect(nextZoomStep(1, 1)).toBe(1.5)
    expect(nextZoomStep(1.5, -1)).toBe(1)
  })

  it("tidak melewati batas atas maupun bawah", () => {
    expect(nextZoomStep(MEDIA_ZOOM_MAX, 1)).toBe(MEDIA_ZOOM_MAX)
    expect(nextZoomStep(MEDIA_ZOOM_MIN, -1)).toBe(MEDIA_ZOOM_MIN)
  })
})

describe("toggleZoomTarget", () => {
  it("dari utuh langsung ke perbesaran dekat", () => {
    expect(toggleZoomTarget(MEDIA_ZOOM_MIN)).toBe(MEDIA_ZOOM_TAP_TARGET)
  })

  it("dari keadaan diperbesar kembali ke utuh", () => {
    expect(toggleZoomTarget(2)).toBe(MEDIA_ZOOM_MIN)
    expect(toggleZoomTarget(MEDIA_ZOOM_TAP_TARGET)).toBe(MEDIA_ZOOM_MIN)
  })
})

describe("containSize", () => {
  it("foto lebar dibatasi oleh lebar kotak", () => {
    expect(containSize(1600, 800, 800, 800)).toEqual({ width: 800, height: 400 })
  })

  it("foto tinggi dibatasi oleh tinggi kotak", () => {
    expect(containSize(800, 1600, 800, 800)).toEqual({ width: 400, height: 800 })
  })

  it("ukuran tidak wajar jatuh ke ukuran kotak, bukan NaN", () => {
    expect(containSize(0, 0, 800, 600)).toEqual({ width: 800, height: 600 })
    expect(containSize(Number.NaN, 100, 800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe("maxZoomOffset", () => {
  it("belum ada ruang geser saat skala utuh", () => {
    expect(maxZoomOffset(800, 800, 1)).toBe(0)
  })

  it("ruang geser tumbuh saat diperbesar", () => {
    expect(maxZoomOffset(800, 800, 2)).toBe(400)
    expect(maxZoomOffset(400, 800, 2)).toBe(0)
  })
})

describe("clampZoomOffset", () => {
  it("geser dijepit supaya tepi media tidak lewat tepi layar", () => {
    expect(clampZoomOffset(9999, 800, 800, 2)).toBe(400)
    expect(clampZoomOffset(-9999, 800, 800, 2)).toBe(-400)
    expect(clampZoomOffset(120, 800, 800, 2)).toBe(120)
  })

  it("saat skala utuh geser selalu nol", () => {
    expect(clampZoomOffset(300, 800, 800, 1)).toBe(0)
  })
})

describe("zoomAtPoint", () => {
  it("menahan titik yang ditunjuk tetap di tempatnya", () => {
    // Diperbesar 2x dengan titik di 100px kanan tengah: offset jadi -100.
    const hasil = zoomAtPoint({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      nextScale: 2,
      pointX: 100,
      pointY: 0,
    })
    expect(hasil.scale).toBe(2)
    expect(hasil.offsetX).toBe(-100)
    expect(hasil.offsetY).toBe(0)
  })

  it("titik di tengah tidak menggeser apa pun", () => {
    const hasil = zoomAtPoint({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      nextScale: 3,
      pointX: 0,
      pointY: 0,
    })
    expect(hasil).toEqual({ scale: 3, offsetX: 0, offsetY: 0 })
  })

  it("kembali ke skala utuh selalu menghapus geser", () => {
    const hasil = zoomAtPoint({
      scale: 2,
      offsetX: -120,
      offsetY: 80,
      nextScale: 1,
      pointX: 10,
      pointY: 10,
    })
    expect(hasil).toEqual(MEDIA_ZOOM_IDLE)
  })

  it("skala sama tidak mengubah geser", () => {
    const hasil = zoomAtPoint({
      scale: 2,
      offsetX: -50,
      offsetY: 20,
      nextScale: 2,
      pointX: 100,
      pointY: 100,
    })
    expect(hasil).toEqual({ scale: 2, offsetX: -50, offsetY: 20 })
  })

  it("menghormati batas atas skala", () => {
    const hasil = zoomAtPoint({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      nextScale: 99,
      pointX: 0,
      pointY: 0,
    })
    expect(hasil.scale).toBe(MEDIA_ZOOM_MAX)
  })
})

describe("zoomPercentLabel", () => {
  it("menampilkan persentase bulat", () => {
    expect(zoomPercentLabel(1)).toBe("100%")
    expect(zoomPercentLabel(1.5)).toBe("150%")
    expect(zoomPercentLabel(2.44)).toBe("244%")
  })
})
