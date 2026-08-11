import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  CART_EVENTS,
  dispatchCartBump,
  dispatchCartFly,
  dispatchCartUpdated,
  isCartFlyPayload,
  isCartUpdatedPayload,
  onCartBump,
  onCartFly,
  onCartUpdated,
} from "@/lib/cart-events"

// vitest env = "node" → window tidak ada. Stub dengan EventTarget nyata agar
// round-trip dispatch → subscribe bisa diuji tanpa jsdom.
const eventTarget = new EventTarget()

beforeEach(() => {
  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: EventListener) => {
      eventTarget.addEventListener(type, listener)
    },
    removeEventListener: (type: string, listener: EventListener) => {
      eventTarget.removeEventListener(type, listener)
    },
    dispatchEvent: (event: Event) => eventTarget.dispatchEvent(event),
    CustomEvent: globalThis.CustomEvent,
  })
})

describe("cart-events contract (§1 named events)", () => {
  it("exposes stable event names", () => {
    expect(CART_EVENTS).toEqual({
      updated: "cart:updated",
      bump: "cart:bump",
      fly: "cart:fly",
    })
  })
})

describe("type guards (§6 trust at boundary)", () => {
  it("accepts valid payloads", () => {
    expect(isCartUpdatedPayload({ lineId: "L1", quantity: 2, count: 3 })).toBe(true)
    expect(isCartFlyPayload({ image: "a.png", x: 1, y: 2, w: 3, h: 4 })).toBe(true)
  })

  it("rejects non-object, null, and arrays", () => {
    expect(isCartUpdatedPayload(null)).toBe(false)
    expect(isCartUpdatedPayload(undefined)).toBe(false)
    expect(isCartUpdatedPayload("payload")).toBe(false)
    expect(isCartUpdatedPayload(42)).toBe(false)
    expect(isCartUpdatedPayload(["L1", 2, 3])).toBe(false)
  })

  it("rejects missing fields", () => {
    expect(isCartUpdatedPayload({ quantity: 2, count: 3 })).toBe(false)
    expect(isCartUpdatedPayload({ lineId: "L1", count: 3 })).toBe(false)
    expect(isCartUpdatedPayload({ lineId: "L1", quantity: 2 })).toBe(false)
    expect(isCartFlyPayload({ image: "a.png", x: 1, y: 2, w: 3 })).toBe(false)
  })

  it("rejects wrong-typed and non-finite numbers", () => {
    expect(isCartUpdatedPayload({ lineId: 1, quantity: 2, count: 3 })).toBe(false)
    expect(isCartUpdatedPayload({ lineId: "L1", quantity: "2", count: 3 })).toBe(false)
    expect(isCartUpdatedPayload({ lineId: "L1", quantity: NaN, count: 3 })).toBe(false)
    expect(isCartUpdatedPayload({ lineId: "L1", quantity: Infinity, count: 3 })).toBe(false)
    expect(isCartFlyPayload({ image: "a.png", x: 1, y: 2, w: 3, h: "4" })).toBe(false)
  })
})

describe("dispatch → subscribe round-trip", () => {
  it("delivers validated payload to onCartUpdated", () => {
    const handler = vi.fn()
    const off = onCartUpdated(handler)

    dispatchCartUpdated({ lineId: "L1", quantity: 5, count: 9 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ lineId: "L1", quantity: 5, count: 9 })
    off()
  })

  it("does not call the handler for a malformed payload (guard at the edge)", () => {
    const handler = vi.fn()
    const off = onCartUpdated(handler)

    // Event mentah dengan detail rusak — harus ditolak type guard, bukan crash.
    window.dispatchEvent(
      new CustomEvent(CART_EVENTS.updated, { detail: { lineId: 123 } }),
    )

    expect(handler).not.toHaveBeenCalled()
    off()
  })

  it("fires onCartBump without a payload", () => {
    const handler = vi.fn()
    const off = onCartBump(handler)

    dispatchCartBump()

    expect(handler).toHaveBeenCalledTimes(1)
    off()
  })

  it("delivers validated fly payload", () => {
    const handler = vi.fn()
    const off = onCartFly(handler)

    dispatchCartFly({ image: "img.png", x: 0, y: 0, w: 100, h: 50 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ image: "img.png", x: 0, y: 0, w: 100, h: 50 })
    off()
  })

  it("unsubscribe stops further delivery (§8 cleanup)", () => {
    const handler = vi.fn()
    const off = onCartUpdated(handler)

    off()
    dispatchCartUpdated({ lineId: "L1", quantity: 1, count: 1 })

    expect(handler).not.toHaveBeenCalled()
  })
})
