/**
 * Matematika zoom untuk preview media (lightbox).
 *
 * Dipisah ke modul murni supaya bisa diuji tanpa render React: batas zoom,
 * penjepitan geser, dan zoom yang berlabuh di titik yang ditunjuk pembeli.
 *
 * Kontrak owner 2026-09-18: foto di preview bisa diperbesar di ponsel maupun
 * desktop. Zoom berlabuh di titik yang ditunjuk, bukan selalu ke tengah, supaya
 * bagian yang ingin dilihat tidak melompat keluar layar.
 */

export const MEDIA_ZOOM_MIN = 1
export const MEDIA_ZOOM_MAX = 4
export const MEDIA_ZOOM_STEP = 0.5
/** Sasaran perbesaran saat diketuk dua kali. */
export const MEDIA_ZOOM_TAP_TARGET = 2.5

export type MediaZoomState = {
  scale: number
  offsetX: number
  offsetY: number
}

export const MEDIA_ZOOM_IDLE: MediaZoomState = {
  scale: MEDIA_ZOOM_MIN,
  offsetX: 0,
  offsetY: 0,
}

/** Jepit skala ke rentang yang diizinkan: di luar rentang dijepit, NaN jadi utuh. */
export function clampZoom(scale: number): number {
  // NaN dibandingkan dengan apa pun selalu bernilai salah, jadi diperiksa dulu.
  if (Number.isNaN(scale)) return MEDIA_ZOOM_MIN
  if (scale < MEDIA_ZOOM_MIN) return MEDIA_ZOOM_MIN
  if (scale > MEDIA_ZOOM_MAX) return MEDIA_ZOOM_MAX
  return scale
}

export function isZoomed(scale: number): boolean {
  return clampZoom(scale) > MEDIA_ZOOM_MIN
}

/** Skala berikutnya untuk tombol perbesar atau perkecil. */
export function nextZoomStep(scale: number, direction: number): number {
  if (!direction) return clampZoom(scale)
  const step = direction > 0 ? MEDIA_ZOOM_STEP : -MEDIA_ZOOM_STEP
  return clampZoom(scale + step)
}

/** Sasaran zoom saat diketuk dua kali: masuk ke dekat, atau kembali ke utuh. */
export function toggleZoomTarget(scale: number): number {
  return isZoomed(scale) ? MEDIA_ZOOM_MIN : MEDIA_ZOOM_TAP_TARGET
}

/**
 * Ukuran gambar yang benar-benar tergambar di dalam kotaknya, mengikuti
 * perilaku `object-fit: contain`. Dipakai menghitung batas geser supaya tepi
 * media tidak bisa ditarik melewati tepi area preview.
 */
export function containSize(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
): { width: number; height: number } {
  const wajar =
    Number.isFinite(naturalW) &&
    Number.isFinite(naturalH) &&
    Number.isFinite(boxW) &&
    Number.isFinite(boxH) &&
    naturalW > 0 &&
    naturalH > 0 &&
    boxW > 0 &&
    boxH > 0

  if (!wajar) {
    return { width: Math.max(0, boxW || 0), height: Math.max(0, boxH || 0) }
  }

  const fit = Math.min(boxW / naturalW, boxH / naturalH)
  return { width: naturalW * fit, height: naturalH * fit }
}

/** Jarak geser maksimum agar tepi media tidak melewati tepi area preview. */
export function maxZoomOffset(
  contentSize: number,
  containerSize: number,
  scale: number,
): number {
  if (
    !Number.isFinite(contentSize) ||
    !Number.isFinite(containerSize) ||
    !Number.isFinite(scale)
  ) {
    return 0
  }
  return Math.max(0, (contentSize * scale - containerSize) / 2)
}

export function clampZoomOffset(
  value: number,
  contentSize: number,
  containerSize: number,
  scale: number,
): number {
  const limit = maxZoomOffset(contentSize, containerSize, scale)
  if (limit === 0 || !Number.isFinite(value)) return 0
  if (value > limit) return limit
  if (value < -limit) return -limit
  return value
}

/**
 * Perbesar atau perkecil sambil menahan satu titik tetap di bawah kursor.
 * `pointX` dan `pointY` diukur dari titik tengah area preview.
 */
export function zoomAtPoint({
  scale,
  offsetX,
  offsetY,
  nextScale,
  pointX,
  pointY,
}: {
  scale: number
  offsetX: number
  offsetY: number
  nextScale: number
  pointX: number
  pointY: number
}): MediaZoomState {
  const from = clampZoom(scale)
  const to = clampZoom(nextScale)

  if (to === from) return { scale: to, offsetX, offsetY }
  if (to === MEDIA_ZOOM_MIN) return { ...MEDIA_ZOOM_IDLE }

  const ratio = to / from
  return {
    scale: to,
    offsetX: pointX - (pointX - offsetX) * ratio,
    offsetY: pointY - (pointY - offsetY) * ratio,
  }
}

/** Label persentase untuk kontrol zoom. */
export function zoomPercentLabel(scale: number): string {
  return Math.round(clampZoom(scale) * 100) + "%"
}
