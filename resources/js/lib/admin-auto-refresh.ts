import * as React from "react"

/**
 * Muat ulang otomatis panel admin (owner 2026-09-29).
 *
 * Mesin pemuatannya ada di LiveNotificationManager: event live (WebSocket) dan
 * penanda versi data memicu halaman memuat ulang dirinya sendiri, sehingga
 * tombol Muat ulang tidak lagi diperlukan.
 *
 * Halaman yang punya mode/sunting lokal (mis. mode Urutkan yang sedang menggeser
 * baris) memanggil useAutoRefreshPause(true) supaya pemuatan ulang otomatis
 * berhenti sementara, lalu jalan lagi begitu mode itu ditutup.
 */
let pauseCount = 0
const listeners = new Set<(paused: boolean) => void>()

export function isAutoRefreshPaused(): boolean {
  return pauseCount > 0
}

/** Pause selama `paused` true; dilepas otomatis saat komponen dilepas. */
export function useAutoRefreshPause(paused: boolean): void {
  React.useEffect(() => {
    if (!paused) return
    pauseCount += 1
    listeners.forEach((fn) => fn(true))
    return () => {
      pauseCount = Math.max(0, pauseCount - 1)
      const masihJeda = pauseCount > 0
      listeners.forEach((fn) => fn(masihJeda))
    }
  }, [paused])
}
