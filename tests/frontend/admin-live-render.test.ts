import { describe, expect, it } from "vitest"

import { readAdminLiveSnapshot } from "@/lib/admin-live-connection"
import { HEARTBEAT_MS, STALE_MS } from "@/lib/admin-live-lease"

/**
 * Penjaga langsung untuk bug "panel admin 500" (16 Okt 2026).
 *
 * Kejadian nyata di produksi: seluruh panel admin menampilkan halaman
 * "500 Terjadi gangguan sementara". Itu bukan 500 dari server (nginx mencatat nol
 * kode 500 untuk kejadian itu), melainkan error boundary React yang menangkap
 * render berulang tanpa henti.
 *
 * Sebabnya: useSyncExternalStore membandingkan hasil getSnapshot dengan Object.is.
 * Versi pertama fungsi snapshot SELALU mengembalikan objek baru dan memanggil
 * Date.now(), sehingga React melihat "store berubah" pada setiap pemeriksaan.
 * Hook ini dipakai di layout admin, jadi seluruh panel ikut runtuh.
 *
 * Tes ini meniru pemeriksaan React: panggil getSnapshot berkali-kali dan tuntut
 * identitas objeknya sama. Kalau fungsi itu kembali menjadi objek baru per
 * panggilan, tes ini gagal SEBELUM bug sampai ke produksi.
 *
 * Catatan lingkungan: vitest di repo ini berjalan tanpa DOM (environment node),
 * jadi pengujian di sini memakai aturan yang bisa diuji tanpa peramban. Itu cukup
 * karena akar bugnya adalah identitas objek, bukan perilaku DOM.
 */
describe("snapshot status live wajib stabil (akar bug panel admin 500)", () => {
  it("pemanggilan berulang mengembalikan objek yang sama persis", () => {
    const a = readAdminLiveSnapshot()
    const b = readAdminLiveSnapshot()
    const c = readAdminLiveSnapshot()

    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it("identitas stabil walau waktu berjalan sedikit", async () => {
    const a = readAdminLiveSnapshot()
    await new Promise((resolve) => setTimeout(resolve, 40))
    const b = readAdminLiveSnapshot()

    // Waktu TIDAK boleh mengubah identitas snapshot. Kalau berubah, React akan
    // menganggap store terus berubah dan render berulang.
    expect(a).toBe(b)
  })

  it("identitas berubah paling cepat sekali per ambang basi, bukan tiap panggilan", () => {
    // Snapshot memakai ember waktu berdurasi STALE_MS. Dalam satu ember yang sama,
    // identitasnya harus tetap. Ini yang membuktikan Date.now() tidak lagi
    // dipanggil mentah-mentah ke dalam identitas.
    expect(STALE_MS).toBeGreaterThan(60_000)
    expect(HEARTBEAT_MS).toBeLessThan(STALE_MS)

    const dalamEmberSama = Array.from({ length: 50 }, () => readAdminLiveSnapshot())
    const pertama = dalamEmberSama[0]

    for (const snap of dalamEmberSama) {
      expect(snap).toBe(pertama)
    }
  })

  it("bentuk nilainya benar", () => {
    const snap = readAdminLiveSnapshot()

    expect(typeof snap.state).toBe("string")
    expect(typeof snap.leader).toBe("boolean")
    expect(typeof snap.stale).toBe("boolean")
    expect(["connecting", "connected", "reconnecting", "disconnected", "unavailable"]).toContain(snap.state)
  })
})
