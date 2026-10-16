// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import * as React from "react"
import { act } from "react"
import { createRoot } from "react-dom/client"

import { useAdminLive } from "@/lib/admin-live-connection"

/**
 * Uji render nyata untuk bug "panel admin 500" (16 Okt 2026).
 *
 * Kejadian produksi: SELURUH panel admin menampilkan halaman
 * "500 Terjadi gangguan sementara". Itu bukan 500 dari server, melainkan error
 * boundary React yang menangkap render berulang tanpa henti.
 *
 * Akarnya: getSnapshot milik useSyncExternalStore mengembalikan objek BARU setiap
 * panggilan dan memanggil Date.now(), sehingga React melihat store berubah terus.
 *
 * Tes ini memasang hook sungguhan ke DOM (environment jsdom). Kalau bug itu
 * kembali, React melempar "Maximum update depth exceeded" di sini, sehingga
 * kegagalan tertangkap SEBELUM sampai ke produksi.
 *
 * PENTING: penanda lingkungan act WAJIB diset. Tanpa itu React tidak
 * menyelesaikan pembaruan secara sinkron di dalam act(), sehingga tes bisa lolos
 * tanpa benar-benar memeriksa apa pun.
 */
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function pasang(node: React.ReactElement): { wadah: HTMLDivElement; unmount: () => void } {
  const wadah = document.createElement("div")
  document.body.appendChild(wadah)
  const root = createRoot(wadah)

  act(() => {
    root.render(node)
  })

  return {
    wadah,
    unmount: () => {
      act(() => root.unmount())
      wadah.remove()
    },
  }
}

describe("hook status live terpasang di DOM tanpa render berulang", () => {
  it("dipasang dan dilepas tanpa melempar (kalau render berulang, React melempar)", () => {
    const pesan: string[] = []

    function Uji(): React.ReactElement | null {
      const live = useAdminLive()
      pesan.push(live.state)

      return null
    }

    const { unmount } = pasang(React.createElement(Uji))

    expect(pesan.length).toBeGreaterThan(0)
    expect(typeof pesan[0]).toBe("string")

    // Kalau snapshot tidak stabil, jumlah render akan meledak. Batas longgar ini
    // sudah cukup menangkap loop tanpa henti tanpa rapuh terhadap detail React.
    expect(pesan.length).toBeLessThan(20)

    unmount()
  })

  it("nilai dari hook dipakai di JSX tanpa melempar", () => {
    function Uji(): React.ReactElement {
      const live = useAdminLive()
      const label = live.stale ? "Data mungkin tertinggal" : "normal"

      return React.createElement("span", null, `${live.state} ${label} ${live.leader}`)
    }

    const { wadah, unmount } = pasang(React.createElement(Uji))

    expect(wadah.textContent).toContain("normal")

    unmount()
  })

  it("kesalahan di dalam pohon TIDAK terpicu pada hook ini", () => {
    const onError = vi.fn()

    class Penjaga extends React.Component<{ children: React.ReactNode }, { gagal: boolean }> {
      state = { gagal: false }

      static getDerivedStateFromError(): { gagal: boolean } {
        return { gagal: true }
      }

      componentDidCatch(e: unknown): void {
        onError(e)
      }

      render(): React.ReactNode {
        return this.state.gagal ? React.createElement("span", null, "GAGAL") : this.props.children
      }
    }

    function Uji(): React.ReactElement | null {
      useAdminLive()

      return null
    }

    const { wadah, unmount } = pasang(
      React.createElement(Penjaga, null, React.createElement(Uji)),
    )

    expect(onError).not.toHaveBeenCalled()
    expect(wadah.textContent).not.toBe("GAGAL")

    unmount()
  })
})
