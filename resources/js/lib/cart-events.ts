/**
 * Kontrak terpusat untuk event cart berbasis `window` CustomEvent.
 *
 * Sebelumnya setiap komponen membuat/membaca payload dengan cast manual
 * (`(event as CustomEvent<...>).detail`) — mengganti field payload lolos
 * typecheck tapi runtime diam-diam rusak. Di sini payload didefinisikan
 * sekali, divalidasi di tepi (type guard), dan dipancarkan/didengarkan
 * lewat helper — §1 "errors are named, not strings" + §6 trust at boundary.
 */

export interface CartUpdatedPayload {
  lineId: string
  quantity: number
  count: number
}

export interface CartFlyPayload {
  image: string
  x: number
  y: number
  w: number
  h: number
}

export const CART_EVENTS = {
  updated: "cart:updated",
  bump: "cart:bump",
  fly: "cart:fly",
} as const

export type CartEventName = (typeof CART_EVENTS)[keyof typeof CART_EVENTS]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/** Validasi runtime payload di tepi — data dari event tak tepercaya. */
export function isCartUpdatedPayload(value: unknown): value is CartUpdatedPayload {
  return (
    isRecord(value) &&
    typeof value.lineId === "string" &&
    isFiniteNumber(value.quantity) &&
    isFiniteNumber(value.count)
  )
}

export function isCartFlyPayload(value: unknown): value is CartFlyPayload {
  return (
    isRecord(value) &&
    typeof value.image === "string" &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.w) &&
    isFiniteNumber(value.h)
  )
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                           */
/* ------------------------------------------------------------------ */

export function dispatchCartUpdated(payload: CartUpdatedPayload): void {
  window.dispatchEvent(new CustomEvent(CART_EVENTS.updated, { detail: payload }))
}

export function dispatchCartBump(): void {
  window.dispatchEvent(new CustomEvent(CART_EVENTS.bump))
}

export function dispatchCartFly(payload: CartFlyPayload): void {
  window.dispatchEvent(new CustomEvent(CART_EVENTS.fly, { detail: payload }))
}

/* ------------------------------------------------------------------ */
/* Subscribe — mengembalikan unsubscribe agar pas untuk useEffect     */
/* ------------------------------------------------------------------ */

export function onCartUpdated(handler: (payload: CartUpdatedPayload) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail
    if (isCartUpdatedPayload(detail)) handler(detail)
  }
  window.addEventListener(CART_EVENTS.updated, listener)
  return () => window.removeEventListener(CART_EVENTS.updated, listener)
}

export function onCartBump(handler: () => void): () => void {
  window.addEventListener(CART_EVENTS.bump, handler)
  return () => window.removeEventListener(CART_EVENTS.bump, handler)
}

export function onCartFly(handler: (payload: CartFlyPayload) => void): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail
    if (isCartFlyPayload(detail)) handler(detail)
  }
  window.addEventListener(CART_EVENTS.fly, listener)
  return () => window.removeEventListener(CART_EVENTS.fly, listener)
}
