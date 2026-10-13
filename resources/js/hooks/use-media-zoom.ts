import * as React from "react"

import {
  MEDIA_ZOOM_IDLE,
  MEDIA_ZOOM_MAX,
  clampZoom,
  clampZoomOffset,
  containSize,
  isZoomed,
  nextZoomStep,
  toggleZoomTarget,
  zoomAtPoint,
  type MediaZoomState,
} from "@/lib/media-zoom"

type ClientPoint = { x: number; y: number }

const PAN_TRAVEL_LIMIT_PX = 6

/**
 * Zoom dan geser untuk foto di preview media.
 *
 * Menangani empat cara yang wajar di kedua perangkat:
 *   - roda tetikus: memperbesar tepat di posisi kursor, termasuk cubit trackpad
 *   - ketuk dua kali: masuk ke perbesaran dekat, ketuk dua kali lagi untuk utuh
 *   - cubit dua jari: memperbesar tepat di titik tengah cubitan (ponsel)
 *   - seret satu jari atau tetikus: menggeser foto saat sedang diperbesar
 *
 * Saat skala masih utuh, gerakan seret dibiarkan lewat supaya navigasi geser
 * antar media tetap bekerja seperti sebelumnya. Video tidak ikut di-zoom karena
 * punya kontrol putarnya sendiri.
 */
export function useMediaZoom({
  surfaceRef,
  imageRef,
  resetKey,
  enabled,
}: {
  surfaceRef: React.RefObject<HTMLElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  /** Berubah ketika pembeli pindah media, supaya zoom kembali utuh. */
  resetKey: string | number
  /** Hanya foto yang bisa di-zoom. */
  enabled: boolean
}) {
  const stateRef = React.useRef<MediaZoomState>({ ...MEDIA_ZOOM_IDLE })
  const [scaled, setScaled] = React.useState(false)
  const [percent, setPercent] = React.useState(100)
  const enabledRef = React.useRef(enabled)
  const gestureRef = React.useRef({
    /** Geser tetikus sedang berjalan. */
    pan: null as null | { x: number; y: number; offsetX: number; offsetY: number },
    /** Cubit dua jari sedang berjalan. */
    pinch: null as null | {
      distance: number
      scale: number
      offsetX: number
      offsetY: number
      point: ClientPoint
    },
    /** Jarak tempuh gesti terakhir, dipakai menahan klik palsu setelah geser. */
    travel: 0,
  })

  React.useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  /** Ukuran nyata media yang tergambar dan area preview di layar. */
  const readMetrics = React.useCallback(() => {
    const surface = surfaceRef.current
    const image = imageRef.current
    if (!surface || !image) return null

    const rect = surface.getBoundingClientRect()
    const painted = containSize(
      image.naturalWidth,
      image.naturalHeight,
      image.clientWidth,
      image.clientHeight,
    )

    return {
      containerW: rect.width,
      containerH: rect.height,
      contentW: painted.width,
      contentH: painted.height,
    }
  }, [imageRef, surfaceRef])

  /** Jepit skala dan geser agar media tidak bisa keluar dari area preview. */
  const clampState = React.useCallback(
    (next: MediaZoomState): MediaZoomState => {
      const scale = clampZoom(next.scale)
      const metrics = readMetrics()

      if (!metrics || !isZoomed(scale)) {
        return { scale, offsetX: 0, offsetY: 0 }
      }

      return {
        scale,
        offsetX: clampZoomOffset(
          next.offsetX,
          metrics.contentW,
          metrics.containerW,
          scale,
        ),
        offsetY: clampZoomOffset(
          next.offsetY,
          metrics.contentH,
          metrics.containerH,
          scale,
        ),
      }
    },
    [readMetrics],
  )

  /**
   * Terapkan ke DOM langsung, bukan lewat render, supaya geser dan cubit tetap
   * mulus. `commitUi` dimatikan selama gesti berjalan agar tidak memicu render
   * di setiap pergerakan jari.
   */
  const apply = React.useCallback(
    (next: MediaZoomState, smooth: boolean, commitUi = true) => {
      stateRef.current = next
      const image = imageRef.current

      if (image) {
        image.style.transition = smooth
          ? "transform 280ms cubic-bezier(0.22,1,0.36,1)"
          : "none"
        image.style.transform = isZoomed(next.scale)
          ? "translate3d(" +
            next.offsetX +
            "px, " +
            next.offsetY +
            "px, 0) scale(" +
            next.scale +
            ")"
          : ""
      }

      if (commitUi) {
        setScaled(isZoomed(next.scale))
        setPercent(Math.round(next.scale * 100))
      }
    },
    [imageRef],
  )

  /** Selaraskan tampilan kontrol dengan keadaan zoom yang sebenarnya. */
  const commitUi = React.useCallback(() => {
    const state = stateRef.current
    setScaled(isZoomed(state.scale))
    setPercent(Math.round(state.scale * 100))
  }, [])

  /** Zoom ke skala tertentu sambil menahan titik yang ditunjuk tetap di tempat. */
  const zoomTo = React.useCallback(
    (nextScale: number, clientPoint?: ClientPoint, smooth = true) => {
      if (!enabledRef.current) return
      const surface = surfaceRef.current
      if (!surface) return

      const rect = surface.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const point = clientPoint ?? { x: centerX, y: centerY }
      const current = stateRef.current

      const anchored = zoomAtPoint({
        scale: current.scale,
        offsetX: current.offsetX,
        offsetY: current.offsetY,
        nextScale,
        pointX: point.x - centerX,
        pointY: point.y - centerY,
      })

      apply(clampState(anchored), smooth)
    },
    [apply, clampState, surfaceRef],
  )

  const zoomIn = React.useCallback(() => {
    zoomTo(nextZoomStep(stateRef.current.scale, 1))
  }, [zoomTo])

  const zoomOut = React.useCallback(() => {
    zoomTo(nextZoomStep(stateRef.current.scale, -1))
  }, [zoomTo])

  const resetZoom = React.useCallback(
    (smooth = true) => {
      apply({ ...MEDIA_ZOOM_IDLE }, smooth)
    },
    [apply],
  )

  /** Ketuk dua kali: masuk ke perbesaran dekat, atau kembali ke utuh. */
  const toggleZoomAt = React.useCallback(
    (clientX: number, clientY: number) => {
      zoomTo(toggleZoomTarget(stateRef.current.scale), { x: clientX, y: clientY })
    },
    [zoomTo],
  )

  // Kembalikan zoom ke utuh setiap kali pembeli pindah media.
  // Bagian state direset saat render, mengikuti pola resmi React untuk
  // menyesuaikan state ketika prop berubah, supaya tidak ada render berganda
  // dari dalam effect.
  const [lastResetKey, setLastResetKey] = React.useState(resetKey)
  if (lastResetKey !== resetKey) {
    setLastResetKey(resetKey)
    setScaled(false)
    setPercent(100)
  }

  // Bagian ref dan transform imperatif dibersihkan lewat effect, supaya slide
  // lama tidak menyimpan perbesaran saat pembeli kembali ke sana.
  React.useEffect(() => {
    stateRef.current = { ...MEDIA_ZOOM_IDLE }

    const surface = surfaceRef.current
    if (!surface) return
    surface.querySelectorAll("img").forEach((node) => {
      const el = node as HTMLImageElement
      el.style.transition = "none"
      el.style.transform = ""
    })
  }, [resetKey, surfaceRef])

  // Roda tetikus, cubit, dan geser jari. Dipasang sebagai listener native supaya
  // `preventDefault` benar-benar bekerja (listener React bersifat pasif).
  // `enabled` ikut jadi dependensi karena elemen area preview baru terpasang saat
  // preview benar-benar terbuka; tanpa ini listener terpasang ke elemen kosong.
  React.useEffect(() => {
    const surface = surfaceRef.current
    if (!surface || !enabled) return

    const gesture = gestureRef.current

    const distanceOf = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.hypot(dx, dy)
    }

    const midpointOf = (touches: TouchList): ClientPoint => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    })

    const onWheel = (event: WheelEvent) => {
      if (!enabledRef.current) return
      event.preventDefault()
      // Cubit trackpad mengirim ctrlKey dengan delta kecil, roda biasa delta besar.
      const intensity = event.ctrlKey ? 0.012 : 0.0022
      const factor = Math.exp(-event.deltaY * intensity)
      zoomTo(stateRef.current.scale * factor, {
        x: event.clientX,
        y: event.clientY,
      })
    }

    const onTouchStart = (event: TouchEvent) => {
      if (!enabledRef.current) return

      if (event.touches.length === 2) {
        const current = stateRef.current
        gesture.pinch = {
          distance: distanceOf(event.touches),
          scale: current.scale,
          offsetX: current.offsetX,
          offsetY: current.offsetY,
          point: midpointOf(event.touches),
        }
        gesture.pan = null
        gesture.travel = 0
        event.preventDefault()
        return
      }

      if (event.touches.length === 1 && isZoomed(stateRef.current.scale)) {
        const current = stateRef.current
        gesture.pan = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
          offsetX: current.offsetX,
          offsetY: current.offsetY,
        }
        gesture.travel = 0
      }
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!enabledRef.current) return

      if (gesture.pinch && event.touches.length === 2) {
        event.preventDefault()
        const rect = surface.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const base = gesture.pinch
        const ratio = distanceOf(event.touches) / (base.distance || 1)

        const anchored = zoomAtPoint({
          scale: base.scale,
          offsetX: base.offsetX,
          offsetY: base.offsetY,
          nextScale: base.scale * ratio,
          pointX: base.point.x - centerX,
          pointY: base.point.y - centerY,
        })

        apply(clampState(anchored), false, false)
        gesture.travel = PAN_TRAVEL_LIMIT_PX + 1
        return
      }

      if (gesture.pan && event.touches.length === 1) {
        event.preventDefault()
        const dx = event.touches[0].clientX - gesture.pan.x
        const dy = event.touches[0].clientY - gesture.pan.y
        gesture.travel = Math.max(
          gesture.travel,
          Math.abs(dx) + Math.abs(dy),
        )
        apply(
          clampState({
            scale: stateRef.current.scale,
            offsetX: gesture.pan.offsetX + dx,
            offsetY: gesture.pan.offsetY + dy,
          }),
          false,
          false,
        )
      }
    }

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length === 0) {
        gesture.pinch = null
        gesture.pan = null
        // Penanda "sudah menggeser" HARUS dibersihkan di sini. Tanpa ini, sisa
        // jarak dari cubitan membuat ketuk dua kali berikutnya diabaikan, sehingga
        // pembeli tidak punya cara mengembalikan zoom saat tombol disembunyikan.
        gesture.travel = 0
        commitUi()
        return
      }

      if (event.touches.length === 1) {
        gesture.pinch = null
        if (!isZoomed(stateRef.current.scale)) {
          gesture.travel = 0
        }
        if (isZoomed(stateRef.current.scale)) {
          const current = stateRef.current
          gesture.pan = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY,
            offsetX: current.offsetX,
            offsetY: current.offsetY,
          }
        }
        commitUi()
      }
    }

    surface.addEventListener("wheel", onWheel, { passive: false })
    surface.addEventListener("touchstart", onTouchStart, { passive: false })
    surface.addEventListener("touchmove", onTouchMove, { passive: false })
    surface.addEventListener("touchend", onTouchEnd)
    surface.addEventListener("touchcancel", onTouchEnd)

    return () => {
      surface.removeEventListener("wheel", onWheel)
      surface.removeEventListener("touchstart", onTouchStart)
      surface.removeEventListener("touchmove", onTouchMove)
      surface.removeEventListener("touchend", onTouchEnd)
      surface.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [apply, clampState, commitUi, enabled, surfaceRef, zoomTo])

  // Geser dengan tetikus saat foto sedang diperbesar.
  const panHandlers = {
    onPointerDown(event: React.PointerEvent<HTMLImageElement>) {
      if (!enabledRef.current) return
      if (event.pointerType === "touch") return
      const current = stateRef.current
      if (!isZoomed(current.scale)) return

      event.stopPropagation()
      event.preventDefault()
      gestureRef.current.pan = {
        x: event.clientX,
        y: event.clientY,
        offsetX: current.offsetX,
        offsetY: current.offsetY,
      }
      gestureRef.current.travel = 0
      event.currentTarget.setPointerCapture?.(event.pointerId)
    },
    onPointerMove(event: React.PointerEvent<HTMLImageElement>) {
      const pan = gestureRef.current.pan
      if (!pan) return

      const dx = event.clientX - pan.x
      const dy = event.clientY - pan.y
      gestureRef.current.travel = Math.max(
        gestureRef.current.travel,
        Math.abs(dx) + Math.abs(dy),
      )
      apply(
        clampState({
          scale: stateRef.current.scale,
          offsetX: pan.offsetX + dx,
          offsetY: pan.offsetY + dy,
        }),
        false,
      )
      event.currentTarget.style.cursor = "grabbing"
    },
    onPointerUp(event: React.PointerEvent<HTMLImageElement>) {
      if (!gestureRef.current.pan) return
      gestureRef.current.pan = null
      event.currentTarget.style.cursor = isZoomed(stateRef.current.scale)
        ? "grab"
        : "zoom-in"
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    },
  }

  /** Klik palsu setelah menggeser tidak boleh dianggap klik biasa. */
  const wasDragged = React.useCallback(
    () => gestureRef.current.travel > PAN_TRAVEL_LIMIT_PX,
    [],
  )

  /**
   * Catat jarak geser dari luar hook (dipakai saat menggeser antar media).
   * Tanpa ini, geser navigasi di skala utuh bisa disusul ketukan yang salah
   * dibaca sebagai ketuk dua kali, sehingga foto tiba-tiba ikut diperbesar.
   */
  const noteDrag = React.useCallback((travel: number) => {
    gestureRef.current.travel = Math.max(gestureRef.current.travel, travel)
  }, [])

  const clearDrag = React.useCallback(() => {
    gestureRef.current.travel = 0
  }, [])

  return {
    scaled,
    percent,
    // Diturunkan dari `percent` (state) supaya ikut berubah saat keadaan zoom
    // berubah, bukan dibaca dari ref yang tidak memicu render.
    canZoomIn: percent < Math.round(MEDIA_ZOOM_MAX * 100),
    canZoomOut: percent > 100,
    zoomIn,
    zoomOut,
    resetZoom,
    toggleZoomAt,
    panHandlers,
    wasDragged,
    noteDrag,
    clearDrag,
  }
}
