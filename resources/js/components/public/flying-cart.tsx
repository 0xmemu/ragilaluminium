import * as React from "react"

import { dispatchCartBump, onCartFly, type CartFlyPayload } from "@/lib/cart-events"

/**
 * Animasi "produk terbang ke keranjang": mendengarkan event `cart:fly`
 * lalu menerbangkan gambar produk dari titik asal (tombol Keranjang / kartu
 * produk) menuju ikon keranjang di header ([data-cart-target]). Sesampai di
 * tujuan, event `cart:bump` dipancarkan agar badge keranjang beranimasi.
 *
 * Dipasang sekali di PublicLayout.
 */
export function FlyingCart() {
  const [fly, setFly] = React.useState<{
    image: string
    origin: { x: number; y: number; w: number; h: number }
    target: { x: number; y: number; w: number; h: number }
  } | null>(null)

  React.useEffect(() => {
    function handleFly(detail: CartFlyPayload) {
      const target = document.querySelector<HTMLElement>("[data-cart-target]")
      if (!detail.image || !target) return

      // Reduced motion: lewati animasi terbang; badge cukup berdenyut.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        dispatchCartBump()
        return
      }

      const targetRect = target.getBoundingClientRect()
      setFly({
        image: detail.image,
        origin: {
          x: detail.x + detail.w / 2,
          y: detail.y + detail.h / 2,
          w: detail.w,
          h: detail.h,
        },
        target: {
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2,
          w: 28,
          h: 28,
        },
      })
    }

    return onCartFly(handleFly)
  }, [])

  React.useEffect(() => {
    if (!fly) return
    const frame = window.requestAnimationFrame(() => {
      dispatchCartBump()
    })
    const timer = window.setTimeout(() => setFly(null), 720)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [fly])

  if (!fly) return null

  const dx = fly.target.x - fly.origin.x
  const dy = fly.target.y - fly.origin.y
  const arc = Math.min(140, Math.abs(dy) * 0.35 + 60)
  const originSize = Math.min(fly.origin.w, 64)
  const targetSize = Math.min(fly.target.w, 30)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90]"
    >
      {/* Jejak kurva: transformasi pada elemen luar, imutasi ukuran di dalam. */}
      <div
        className="absolute left-0 top-0 will-change-transform"
        style={{
          transform: `translate3d(${fly.origin.x - originSize / 2}px, ${fly.origin.y - originSize / 2}px, 0)`,
          transition: "transform 620ms cubic-bezier(0.3, 0.75, 0.35, 1)",
        }}
        data-fly-path
      >
        <div
          className="will-change-transform"
          style={{
            transform: `translate3d(${dx}px, ${dy - arc}px, 0) scale(${targetSize / originSize})`,
            transition: "transform 620ms cubic-bezier(0.3, 0.75, 0.35, 1)",
          }}
        >
          <img
            src={fly.image}
            alt=""
            className="rounded-md border border-border object-cover shadow-lg"
            style={{ width: originSize, height: originSize }}
          />
        </div>
      </div>
    </div>
  )
}
