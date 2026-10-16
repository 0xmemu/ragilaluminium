// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Penjaga: klien Pusher WAJIB diserahkan ke Echo (16 Okt 2026).
 *
 * Kejadian produksi: label "Menghubungkan pembaruan langsung..." tampil terus di
 * panel admin, dan tidak ada satu pun sambungan WebSocket yang terbentuk (nginx
 * mencatat nol respons 101 Switching Protocols).
 *
 * Akarnya: laravel-echo 2.x tidak lagi menyertakan klien Pusher. Bila opsi Pusher
 * (atau window.Pusher) tidak diberikan, ia MELEMPAR "Pusher client not found"
 * saat connect(), sehingga sambungan tidak pernah terbentuk dan status tertinggal
 * di "connecting" selamanya.
 *
 * Tes ini menggantikan laravel-echo dan pusher-js dengan tiruan, lalu memeriksa
 * bahwa Echo dibangun DENGAN opsi Pusher. Kalau seseorang menghapusnya lagi,
 * tes ini gagal sebelum bug sampai ke produksi.
 */

const echoCtor = vi.fn()

vi.mock("laravel-echo", () => ({
  default: class EchoTiruan {
    constructor(options: Record<string, unknown>) {
      echoCtor(options)
    }

    private(): unknown {
      return {
        subscribed: () => undefined,
        listen: () => undefined,
        error: () => undefined,
      }
    }

    leaveChannel(): void {}
  },
}))

vi.mock("pusher-js", () => ({
  default: class PusherTiruan {
    connection = { bind: () => undefined }
  },
}))

describe("Echo wajib menerima klien Pusher", () => {
  beforeEach(() => {
    echoCtor.mockClear()
    delete (window as unknown as { Echo?: unknown }).Echo
    vi.resetModules()
  })

  it("Echo dibangun dengan opsi Pusher, bukan tanpa klien", async () => {
    const modul = await import("@/lib/admin-live-connection")

    // Memulai modul memicu penyambungan tab pemimpin.
    modul.subscribeAdminLive(() => undefined)

    // Beri kesempatan dynamic import dan konstruksi Echo selesai.
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(echoCtor).toHaveBeenCalled()

    const opsi = echoCtor.mock.calls[0][0] as Record<string, unknown>
    expect(opsi.broadcaster).toBe("reverb")
    expect(opsi.key).toBeTruthy()
    // Inilah yang mencegah galat "Pusher client not found".
    expect(opsi.Pusher).toBeTruthy()
  })

  it("host dan port WebSocket diisi dari konfigurasi", async () => {
    const modul = await import("@/lib/admin-live-connection")
    modul.subscribeAdminLive(() => undefined)
    await new Promise((resolve) => setTimeout(resolve, 50))

    const opsi = echoCtor.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(opsi).toBeTruthy()
    expect(opsi?.wsHost).toBeTruthy()
    expect(opsi?.enabledTransports).toEqual(["ws", "wss"])
  })
})
