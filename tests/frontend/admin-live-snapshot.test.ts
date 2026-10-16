import { describe, expect, it } from "vitest"

import { readAdminLiveSnapshot } from "@/lib/admin-live-connection"

/**
 * Penjaga kestabilan snapshot status live (16 Okt 2026).
 *
 * Latar kejadian nyata: `useSyncExternalStore` membandingkan hasil getSnapshot
 * dengan Object.is. Versi pertama fungsi ini SELALU mengembalikan objek baru dan
 * memanggil Date.now(), sehingga React melihat "store berubah" pada setiap
 * pemeriksaan, render berulang tanpa henti (React error 185), lalu error boundary
 * menangkapnya dan SELURUH panel admin menampilkan halaman "500 Terjadi gangguan
 * sementara". Hook ini dipakai di layout admin, jadi dampaknya seluruh panel.
 *
 * Penjaga ini menuntut dua hal:
 * 1. Pemanggilan berulang mengembalikan objek yang SAMA (identitas stabil).
 * 2. Isinya tetap benar (bukan objek kosong atau nilai yang salah tipe).
 *
 * Kalau seseorang mengubah fungsi ini menjadi mengembalikan objek baru lagi,
 * tes ini gagal sebelum bug itu sampai ke produksi.
 */
describe("kestabilan snapshot status live", () => {
  it("pemanggilan berulang mengembalikan objek yang sama persis", () => {
    const a = readAdminLiveSnapshot()
    const b = readAdminLiveSnapshot()
    const c = readAdminLiveSnapshot()

    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it("identitas stabil walau waktu berjalan beberapa saat", async () => {
    const a = readAdminLiveSnapshot()
    // Snapshot tidak boleh berubah hanya karena waktu bergerak sedikit; kalau
    // berubah, React akan menganggap store terus berubah.
    await new Promise((resolve) => setTimeout(resolve, 30))
    const b = readAdminLiveSnapshot()

    expect(a).toBe(b)
  })

  it("bentuk nilainya benar", () => {
    const snap = readAdminLiveSnapshot()

    expect(typeof snap.state).toBe("string")
    expect(typeof snap.leader).toBe("boolean")
    expect(typeof snap.stale).toBe("boolean")
    expect(["connecting", "connected", "reconnecting", "disconnected", "unavailable"]).toContain(snap.state)
  })
})
