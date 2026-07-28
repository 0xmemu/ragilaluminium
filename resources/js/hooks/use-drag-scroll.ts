import * as React from "react"

const DRAG_THRESHOLD_PX = 6
const CLICK_SUPPRESS_PX = 8
const MOMENTUM_FRICTION = 0.92
const MOMENTUM_MIN_VELOCITY = 0.05

type DragState = {
  active: boolean
  startX: number
  startScroll: number
  dragged: boolean
  pointerId: number | null
  lastX: number
  lastT: number
  velocity: number
}

/**
 * Smooth horizontal rail scrolling:
 * - Touch: native overflow scroll (momentum / inertia OS)
 * - Mouse: drag-to-scroll + light momentum (desktop)
 * - Both: suppress click on cards after a real swipe
 */
export function useDragScroll(
  trackRef: React.RefObject<HTMLElement | null>,
  enabled = true,
) {
  React.useEffect(() => {
    const el = trackRef.current
    if (!el || !enabled) return

    const state: DragState = {
      active: false,
      startX: 0,
      startScroll: 0,
      dragged: false,
      pointerId: null,
      lastX: 0,
      lastT: 0,
      velocity: 0,
    }

    let suppressClick = false
    let momentumRaf = 0
    let touchStartScroll = 0

    const stopMomentum = () => {
      if (momentumRaf) {
        window.cancelAnimationFrame(momentumRaf)
        momentumRaf = 0
      }
    }

    const runMomentum = (initialVelocity: number) => {
      stopMomentum()
      let v = initialVelocity
      const step = () => {
        if (Math.abs(v) < MOMENTUM_MIN_VELOCITY) {
          momentumRaf = 0
          delete el.dataset.dragging
          return
        }
        el.scrollLeft -= v * 16
        v *= MOMENTUM_FRICTION
        const max = el.scrollWidth - el.clientWidth
        if (el.scrollLeft <= 0 || el.scrollLeft >= max) {
          momentumRaf = 0
          delete el.dataset.dragging
          return
        }
        momentumRaf = window.requestAnimationFrame(step)
      }
      momentumRaf = window.requestAnimationFrame(step)
    }

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
      suppressClick = false
    }

    // --- Mouse drag (desktop) ---
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return
      stopMomentum()
      state.active = true
      state.startX = event.clientX
      state.startScroll = el.scrollLeft
      state.dragged = false
      state.pointerId = event.pointerId
      state.lastX = event.clientX
      state.lastT = performance.now()
      state.velocity = 0
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!state.active || state.pointerId !== event.pointerId) return
      const dx = event.clientX - state.startX
      if (!state.dragged) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
        state.dragged = true
        suppressClick = true
        el.dataset.dragging = "true"
        try {
          el.setPointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }
      const now = performance.now()
      const dt = Math.max(now - state.lastT, 1)
      state.velocity = ((event.clientX - state.lastX) / dt) * 16
      state.lastX = event.clientX
      state.lastT = now
      el.scrollLeft = state.startScroll - dx
      event.preventDefault()
    }

    const onPointerUp = (event: PointerEvent) => {
      if (state.pointerId !== null && state.pointerId !== event.pointerId) return
      const wasDragged = state.dragged
      const velocity = state.velocity
      state.active = false
      state.pointerId = null
      state.dragged = false
      if (!wasDragged) return
      try {
        el.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }
      if (Math.abs(velocity) >= MOMENTUM_MIN_VELOCITY) {
        runMomentum(velocity)
      } else {
        delete el.dataset.dragging
      }
    }

    // --- Touch: native scroll; only suppress accidental clicks after swipe ---
    const onTouchStart = () => {
      stopMomentum()
      touchStartScroll = el.scrollLeft
    }

    const onTouchEnd = () => {
      if (Math.abs(el.scrollLeft - touchStartScroll) >= CLICK_SUPPRESS_PX) {
        suppressClick = true
        window.setTimeout(() => {
          suppressClick = false
        }, 350)
      }
    }

    el.addEventListener("click", onClickCapture, true)
    el.addEventListener("pointerdown", onPointerDown)
    el.addEventListener("pointermove", onPointerMove, { passive: false })
    el.addEventListener("pointerup", onPointerUp)
    el.addEventListener("pointercancel", onPointerUp)
    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchend", onTouchEnd, { passive: true })
    el.addEventListener("touchcancel", onTouchEnd, { passive: true })

    return () => {
      stopMomentum()
      el.removeEventListener("click", onClickCapture, true)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", onPointerUp)
      el.removeEventListener("pointercancel", onPointerUp)
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
      delete el.dataset.dragging
    }
  }, [trackRef, enabled])
}
