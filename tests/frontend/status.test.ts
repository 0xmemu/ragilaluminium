import { describe, expect, it } from "vitest"

import { hasIcon } from "@/components/shared/icon"
import {
  mediaKindLabel,
  mediaStatusMeta,
  ORDER_STEPS,
  paymentMethodLabel,
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

  it("tidak membocorkan penanda sistem pada status yang belum terdaftar", () => {
    // Kontrak owner 2026-10-16: status baru tidak boleh tampil sebagai
    // Title Case Inggris. Labelnya netral, dan tidak ada garis bawah yang
    // ikut terbawa ke layar.
    const meta = statusMeta("awaiting_review")
    expect(meta).toEqual({ label: "Status lain", tone: "neutral" })
    expect(meta.label).not.toContain("_")
    expect(statusMeta("model_product_created").label).toBe("Status lain")
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

  it("menerjemahkan status media tanpa tertukar dengan status pesanan", () => {
    // Kunci "pending" berarti dua hal berbeda: pada media "Menunggu diproses",
    // pada pesanan "Menunggu pembayaran". Keduanya wajib tetap berbeda.
    expect(mediaStatusMeta("pending").label).toBe("Menunggu diproses")
    expect(statusMeta("pending").label).toBe("Menunggu pembayaran")
    expect(mediaStatusMeta("ready").label).toBe("Siap digunakan")
    expect(mediaStatusMeta("failed").label).toBe("Gagal diproses")
    expect(mediaStatusMeta("tidak_ada_di_peta").label).toBe("Status lain")
  })

  it("menerjemahkan jenis aset dan metode pembayaran", () => {
    expect(mediaKindLabel("image")).toBe("Gambar")
    expect(mediaKindLabel("video")).toBe("Video")
    expect(mediaKindLabel("audio")).toBe("Media")
    expect(paymentMethodLabel("cod")).toBe("COD")
    expect(paymentMethodLabel("transfer")).toBe("Transfer Bank")
    expect(paymentMethodLabel("entah_apa")).toBe("Lainnya")
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
