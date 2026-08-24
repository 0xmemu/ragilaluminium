import * as React from "react"

/**
 * Admin Live Events adapter (Foundation Track B, pilot: Pesanan).
 *
 * Saat ini broadcast infra (Reverb/Pusher/Echo) BELUM tersedia di production
 * (BROADCAST_CONNECTION=log, tanpa package). Adapter ini:
 * - return state "unavailable" — TIDAK membuat koneksi palsu;
 * - TIDAK memakai setInterval/polling/timer refresh/reload penuh;
 * - UI tetap bisa memakai Refresh manual yang eksplisit;
 * - siap dihubungkan ke Echo saat infra diaktifkan (lihat deployment
 *   requirement di routes/channels.php).
 */

export type AdminLiveConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "unavailable"

export interface AdminOrderLiveEvent {
  event_id: string
  occurred_at: string
  order_id: number
  order_number: string
  order_status: string
  payment_status: string
  shipping_status: string
  return_status: string
  updated_at: string
  changed_fields: string[]
}

export interface AdminLiveOrderHandlers {
  onOrderUpdated?: (event: AdminOrderLiveEvent) => void
}

/** Batas penyimpanan event_id utk dedupe (mencegah Set tumbuh tak terbatas). */
const DEDUPE_CAP = 200

/**
 * Hook live event admin. Fail-safe:
 * - infra tidak tersedia → state "unavailable", handler TIDAK pernah dipanggil.
 * - dedupe event_id; tidak memakai polling.
 */
export function useAdminLiveOrders(handlers: AdminLiveOrderHandlers): {
  state: AdminLiveConnectionState
  lastEventAt: string | null
  /** Periksa status koneksi manual; bukan polling. */
  refresh: () => void
} {
  const [state, setState] = React.useState<AdminLiveConnectionState>("unavailable")
  const [lastEventAt, setLastEventAt] = React.useState<string | null>(null)

  const seenEvents = React.useRef<Set<string>>(new Set())
  const handlersRef = React.useRef(handlers)
  handlersRef.current = handlers

  // Infra broadcast belum tersedia: tidak ada Echo client.
  const echoAvailable = false

  React.useEffect(() => {
    if (!echoAvailable) {
      setState("unavailable")
      return
    }

    // KETIKA INFRA TERSEDIA — inisialisasi Echo di sini:
    //   import Echo from "laravel-echo"
    //   window.Echo = new Echo({ broadcaster: "reverb", ... })
    //   setState("connecting")
    //   const channel = window.Echo.private("admin.operations")
    //   channel.listen(".order.updated", handleEvent)
    //   channel.subscribed(() => setState("connected"))
    //   window.Echo.connector.pusher.connection.bind("disconnected", ...)
    // cleanup: window.Echo.leaveChannel("private-admin.operations")
    setState("unavailable")
  }, [echoAvailable])

  const handleEvent = React.useCallback((event: AdminOrderLiveEvent) => {
    const key = event.event_id
    if (seenEvents.current.has(key)) return
    seenEvents.current.add(key)

    if (seenEvents.current.size > DEDUPE_CAP) {
      const items = Array.from(seenEvents.current)
      seenEvents.current = new Set(items.slice(-Math.floor(DEDUPE_CAP / 2)))
    }

    setLastEventAt(event.updated_at)
    handlersRef.current.onOrderUpdated?.(event)
  }, [])

  const refresh = React.useCallback(() => {
    // Hanya periksa status saat dipanggil manual; tidak ada polling otomatis.
    setState(echoAvailable ? "connecting" : "unavailable")
  }, [echoAvailable])

  // Referensi handler disimpan utk koneksi masa depan (tidak dipanggil saat unavailable).
  React.useEffect(() => {
    if (!echoAvailable) return
    // placeholder: pasang listener channel -> handleEvent
  }, [echoAvailable, handleEvent])

  return { state, lastEventAt, refresh }
}

/** Status label Indonesia utk koneksi live (non-intrusive; null = jangan tampil). */
export function liveConnectionLabel(state: AdminLiveConnectionState): string | null {
  switch (state) {
    case "connected":
      return null // normal — jangan tampilkan apa pun
    case "connecting":
      return "Menghubungkan pembaruan langsung…"
    case "reconnecting":
      return "Menghubungkan ulang pembaruan langsung…"
    case "disconnected":
      return "Pembaruan langsung terputus. Gunakan Refresh untuk data terbaru."
    case "unavailable":
      return null // fallback normal: Refresh manual
  }
}
