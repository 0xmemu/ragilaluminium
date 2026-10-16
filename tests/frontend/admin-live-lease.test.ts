import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  CONNECT_TIMEOUT_MS,
  HEARTBEAT_MS,
  LEASE_MS,
  LIVENESS_MS,
  STALE_MS,
  isStale,
  leaseExpired,
  shouldReloadOnVersion,
} from "@/lib/admin-live-lease"

/**
 * Penjaga Tahap 3 live events (16 Okt 2026).
 *
 * Latar: endpoint /admin/notifications/poll dipanggil tiap 8 detik dari SETIAP tab
 * admin, dan tiap permintaan dulu menjalankan query agregat 14 subquery. Dengan
 * sekitar 12 tab terbuka, puncaknya 93 permintaan per menit. Tahap 3 memindahkan
 * beban itu: satu sambungan dan satu denyut data per peramban, tiap 120 detik.
 *
 * Dua hal diuji di sini:
 * 1. Aturan waktunya sendiri (murni, tanpa peramban). Salah di sini langsung
 *    terasa sebagai panel yang berhenti diperbarui atau server yang dibanjiri.
 * 2. Kontrak sumber: tidak boleh ada lagi polling 8 detik di komponen admin, dan
 *    hanya SATU modul yang boleh membuat sambungan Echo.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

describe("aturan waktu koneksi live", () => {
  it("denyut data jauh lebih jarang daripada perilaku lama 8 detik", () => {
    expect(HEARTBEAT_MS).toBeGreaterThanOrEqual(60_000)
    expect(HEARTBEAT_MS).toBe(120_000)
  })

  it("klaim kepemimpinan belum kedaluwarsa sebelum batas, dan kedaluwarsa sesudahnya", () => {
    const sekarang = 1_000_000
    expect(leaseExpired(sekarang, sekarang - 1_000)).toBe(false)
    expect(leaseExpired(sekarang, sekarang - LEASE_MS)).toBe(false)
    expect(leaseExpired(sekarang, sekarang - LEASE_MS - 1)).toBe(true)
  })

  it("klaim yang belum pernah ada dianggap kedaluwarsa", () => {
    expect(leaseExpired(1_000_000, 0)).toBe(true)
  })

  it("masa berlaku klaim lebih panjang daripada denyut keberadaan", () => {
    // Kalau terbalik, tab akan berebut kepemimpinan terus-menerus.
    expect(LEASE_MS).toBeGreaterThan(LIVENESS_MS * 2)
  })

  it("pembacaan versi pertama tidak memicu muat ulang", () => {
    expect(shouldReloadOnVersion(null, "abc")).toBe(false)
  })

  it("versi yang sama tidak memicu muat ulang, versi berbeda memicu", () => {
    expect(shouldReloadOnVersion("abc", "abc")).toBe(false)
    expect(shouldReloadOnVersion("abc", "def")).toBe(true)
  })

  it("versi kosong atau tidak ada tidak memicu muat ulang", () => {
    expect(shouldReloadOnVersion("abc", undefined)).toBe(false)
    expect(shouldReloadOnVersion("abc", "")).toBe(false)
    expect(shouldReloadOnVersion("abc", null)).toBe(false)
  })

  it("data dianggap basi hanya setelah dua kali denyut tanpa kabar", () => {
    const sekarang = 5_000_000
    expect(STALE_MS).toBe(HEARTBEAT_MS * 2)
    expect(isStale(sekarang, sekarang - 1_000)).toBe(false)
    expect(isStale(sekarang, sekarang - STALE_MS)).toBe(false)
    expect(isStale(sekarang, sekarang - STALE_MS - 1)).toBe(true)
  })
})

describe("kontrak sumber klien admin", () => {
  const manager = "resources/js/components/admin/live-notification-manager.tsx"
  const events = "resources/js/lib/admin-live-events.ts"
  const connection = "resources/js/lib/admin-live-connection.ts"

  it("modul pemilik sambungan ada", () => {
    expect(existsSync(join(akar, connection))).toBe(true)
  })

  it("manajer notifikasi TIDAK lagi menjalankan polling 8 detik", () => {
    const isi = baca(manager)
    expect(isi).not.toContain("}, 8000)")
    expect(isi).not.toContain("pollNotifications")
  })

  it("manajer notifikasi memakai modul bersama, bukan Echo sendiri", () => {
    const isi = baca(manager)
    expect(isi).toContain("@/lib/admin-live-connection")
    expect(isi).not.toContain('import("laravel-echo")')
    expect(isi).not.toContain("new Echo(")
  })

  it("hanya modul pemilik yang membuat sambungan Echo", () => {
    const pemilik = baca(connection)
    expect(pemilik).toContain('import("laravel-echo")')
    expect(pemilik).toContain("new Echo(")

    // Adapter halaman pesanan tidak boleh menyambung sendiri.
    const adapter = baca(events)
    expect(adapter).not.toContain('import("laravel-echo")')
    expect(adapter).not.toContain("new Echo(")
  })

  it("modul pemilik memakai BroadcastChannel dan memilih pemimpin", () => {
    const isi = baca(connection)
    expect(isi).toContain("BroadcastChannel")
    expect(isi).toContain("becomeLeader")
    expect(isi).toContain("resignLeadership")
  })

  it("modul pemilik menyelaraskan diri saat sambungan pulih", () => {
    const isi = baca(connection)
    // Penyelarasan saat sambungan kembali adalah penutup celah event yang hilang
    // ketika deploy me-restart layanan.
    expect(isi).toContain("reconnect")
    expect(isi).toContain("subscribed")
  })

  it("shell admin TIDAK menampilkan status kesehatan sistem", () => {
    // Kontrak owner 17 Okt 2026: admin toko tidak berurusan dengan kesehatan
    // sistem. Shell admin (yang tampil di SEMUA halaman) tidak boleh menampilkan
    // status koneksi, label menghubungkan/terputus, atau peringatan data basi.
    // Penjaga ini mencegahnya ditambahkan lagi tanpa permintaan.
    const isi = baca(manager)
    expect(isi).not.toContain("liveConnectionLabel")
    expect(isi).not.toContain("live.stale")
    expect(isi).not.toContain("Menghubungkan pembaruan langsung")
    expect(isi).not.toContain("Data mungkin tertinggal")
  })

  it("batas waktu sambung ada dan wajar", () => {
    // Bila sambungan tidak terbentuk dalam batas ini, status tidak boleh tertinggal
    // di "connecting" selamanya, karena itu membuat label "Menghubungkan pembaruan
    // langsung..." tampil terus di panel admin.
    expect(CONNECT_TIMEOUT_MS).toBeGreaterThan(1_000)
    expect(CONNECT_TIMEOUT_MS).toBeLessThanOrEqual(30_000)
  })

  it("batas waktu sambung lebih pendek daripada denyut data", () => {
    // Kalau terbalik, label akan tampil lebih lama daripada siklus denyutnya.
    expect(CONNECT_TIMEOUT_MS).toBeLessThan(HEARTBEAT_MS)
  })
})
