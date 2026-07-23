import { describe, expect, it } from "vitest"

import { ORDER_STEPS, orderStepIndex, statusMeta } from "@/lib/status"

describe("status vocabulary", () => {
  it("maps contracted statuses to Indonesian labels and tones", () => {
    expect(statusMeta("pending_payment")).toEqual({
      label: "Menunggu pembayaran",
      tone: "warning",
    })
    expect(statusMeta("delivered")).toEqual({ label: "Sampai", tone: "success" })
  })

  it("provides a readable neutral fallback", () => {
    expect(statusMeta("awaiting_review")).toEqual({
      label: "Awaiting Review",
      tone: "neutral",
    })
    expect(statusMeta(null).label).toBe("Belum tersedia")
  })

  it("keeps the order timeline deterministic", () => {
    expect(ORDER_STEPS).toEqual([
      "pending_payment",
      "processing",
      "shipped",
      "delivered",
      "completed",
    ])
    expect(orderStepIndex("shipped")).toBe(2)
    expect(orderStepIndex("cancelled")).toBe(-1)
    expect(orderStepIndex("unknown")).toBe(-1)
  })
})
