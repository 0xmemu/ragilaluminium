import * as React from "react"

/**
 * Suppress click after a horizontal swipe on a native-overflow scroll row.
 *
 * Without this, a swipe that starts on a button inside the row (e.g. the
 * Filter / Kategori / Model / Desain triggers) can register as a click once
 * the gesture ends — dropping open a dropdown sheet mid-swipe. We mark the
 * gesture as a swipe once horizontal movement dominates, then swallow the
 * follow-up click for a short window.
 */
export function useSwipeClickSuppression(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  React.useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let suppressClick = false
    let startX = 0
    let startY = 0
    let swiped = false
    let clearTimer = 0

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      suppressClick = false
      swiped = false
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
    }

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const dx = event.touches[0].clientX - startX
      const dy = event.touches[0].clientY - startY
      // Horizontal intent = swipe, not a tap on the trigger button.
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        swiped = true
      }
    }

    const onTouchEnd = () => {
      if (!swiped) return
      suppressClick = true
      window.clearTimeout(clearTimer)
      clearTimer = window.setTimeout(() => {
        suppressClick = false
      }, 400)
    }

    el.addEventListener("click", onClickCapture, true)
    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: true })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("click", onClickCapture, true)
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
      window.clearTimeout(clearTimer)
    }
  }, [ref, enabled])
}
