import { describe, expect, it } from "vitest"

import { reviewSyncKey } from "@/lib/review-sync-key"

/** Bentuk data yang dibandingkan; disalin lokal karena tipe itu tidak diekspor. */
interface ReviewLike {
  id: number
  rating?: number | null
  message?: string | null
  moderation_status?: string | null
  media_items?: Array<{ url?: string | null }> | null
}

function review(overrides: Partial<ReviewLike> = {}): ReviewLike {
  return {
    id: 1,
    rating: 5,
    message: "Pengiriman cepat",
    moderation_status: "pending",
    media_items: [{ url: "https://media.test/a.jpg" }],
    ...overrides,
  }
}

describe("kunci sinkronisasi ulasan", () => {
  /**
   * Inti perbaikan 2026-09-21: halaman lacak pesanan memperbarui data tiap 10
   * detik dan tiap pembaruan menghasilkan objek ulasan BARU. Kunci harus tetap
   * sama bila isinya sama, supaya efek penyelarasan di form tidak terpicu dan
   * isian pembeli tidak terhapus.
   */
  it("menghasilkan kunci sama untuk isi yang sama, walau objeknya berbeda", () => {
    const a = reviewSyncKey([review()], [98], "RA-SIM-2609-01")
    const b = reviewSyncKey([review()], [98], "RA-SIM-2609-01")
    expect(a).toBe(b)
  })

  it("kunci sama saat daftar dibangun ulang dari sumber berbeda", () => {
    const dariServer: ReviewLike[] = [{ ...review() }]
    const dariPolling: ReviewLike[] = [{ ...review() }]
    expect(reviewSyncKey(dariServer, [98], "OD1")).toBe(reviewSyncKey(dariPolling, [98], "OD1"))
  })

  it("kunci berubah saat ada ulasan baru masuk", () => {
    const sebelum = reviewSyncKey([], [98], "OD1")
    const sesudah = reviewSyncKey([review()], [98], "OD1")
    expect(sebelum).not.toBe(sesudah)
  })

  it("kunci berubah saat status moderasi berubah", () => {
    const pending = reviewSyncKey([review({ moderation_status: "pending" })], [98], "OD1")
    const disetujui = reviewSyncKey([review({ moderation_status: "approved" })], [98], "OD1")
    expect(pending).not.toBe(disetujui)
  })

  it("kunci berubah saat isi pesan atau rating berubah", () => {
    const dasar = reviewSyncKey([review()], [98], "OD1")
    expect(reviewSyncKey([review({ message: "lain" })], [98], "OD1")).not.toBe(dasar)
    expect(reviewSyncKey([review({ rating: 4 })], [98], "OD1")).not.toBe(dasar)
    expect(reviewSyncKey([review({ media_items: [] })], [98], "OD1")).not.toBe(dasar)
  })

  it("kunci berubah saat daftar produk pesanan berubah", () => {
    expect(reviewSyncKey([], [98], "OD1")).not.toBe(reviewSyncKey([], [98, 51], "OD1"))
  })

  it("kunci berbeda antar pesanan", () => {
    expect(reviewSyncKey([], [98], "OD1")).not.toBe(reviewSyncKey([], [98], "OD2"))
  })

  it("aman saat data ulasan kosong atau tidak ada", () => {
    expect(() => reviewSyncKey(undefined, [], "OD1")).not.toThrow()
    expect(reviewSyncKey(undefined, [], "OD1")).toBe(reviewSyncKey([], [], "OD1"))
  })
})
