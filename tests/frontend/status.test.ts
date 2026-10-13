import { describe, expect, it } from "vitest"

import { hasIcon } from "@/components/shared/icon"
import {
  ORDER_STEPS,
  STATUS_ICONS,
  orderStepIndex,
  statusIcon,
  statusMeta,
} from "@/lib/status"

describe("status vocabulary", () => {
  it("maps contracted statuses to Indonesian labels and tones", () => {
    expect(statusMeta("pending_payment")).toEqual({
      label: "Menunggu Konfirmasi",
      tone: "warning",
    })
    expect(statusMeta("awaiting_confirmation")).toEqual({
      label: "Menunggu Konfirmasi",
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

  it("gives every secondary status a meaningful icon instead of a bare circle", () => {
    expect(statusIcon("draft")).toBe("pencil-simple")
    expect(statusIcon("scheduled")).toBe("calendar")
    expect(statusIcon("ended")).toBe("archive")
    expect(statusIcon("finished")).toBe("check-circle")
    expect(statusIcon("tidak_ada_di_peta")).toBeNull()

    // Kontrak anti-regresi: lingkaran kosong tidak boleh kembali jadi ikon status.
    for (const [status, icon] of Object.entries(STATUS_ICONS)) {
      expect(statusIcon(status)).toBe(icon)
      expect(icon).not.toBe("circle")
      expect(hasIcon(icon)).toBe(true)
    }
  })

  it("keeps the order timeline deterministic", () => {
    expect(ORDER_STEPS).toEqual([
      "awaiting_confirmation",
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
