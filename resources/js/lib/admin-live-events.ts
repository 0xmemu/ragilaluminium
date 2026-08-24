import * as React from "react"

/**
 * Admin Live Events adapter (Foundation Track B, pilot: Pesanan).
 *
 * Runtime: BROADCAST_CONNECTION=reverb (Laravel Reverb, systemd laravel-reverb)
 * + laravel-echo + pusher-js (runtime dependencies, dibundle di browser).
 * - Echo di-init lazily (dynamic import) hanya bila VITE_REVERB_APP_KEY tersedia;
 * - TANPA polling: event datang via WebSocket private-admin.operations;
 * - Dedupe event_id (cap 200); fallback jujur: disconnected -> Refresh manual.
 */

type EchoChannel = {
  subscribed(cb: () => void): unknown
  listen(event: string, cb: (data: never) => void): unknown
  error(cb: (e: unknown) => void): unknown
}

type EchoClient = {
  private(channel: string): EchoChannel
  leaveChannel(channel: string): void
  connector?: {
    pusher?: {
      connection?: {
        bind(event: string, cb: (...args: unknown[]) => void): unknown
      }
    }
  }
}

declare global {
  interface Window {
    Echo?: EchoClient
  }
}

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

/** Infra broadcast tersedia bila key reverb dikonfigurasi utk browser. */
const echoAvailable = Boolean(import.meta.env.VITE_REVERB_APP_KEY)

/**
 * Hook live event admin. Fail-safe:
 * - infra tidak tersedia -> state "unavailable", handler TIDAK pernah dipanggil.
 * - Echo hanya di-initialize sekali; reconnect otomatis via pusher-js (default).
 * - dedupe event_id; tidak memakai polling.
 */
export function useAdminLiveOrders(handlers: AdminLiveOrderHandlers): {
  state: AdminLiveConnectionState
  lastEventAt: string | null
  /** Periksa status koneksi manual; bukan polling. */
  refresh: () => void
} {
  const [state, setState] = React.useState<AdminLiveConnectionState>(
    echoAvailable ? "connecting" : "unavailable",
  )
  const [lastEventAt, setLastEventAt] = React.useState<string | null>(null)

  const seenEvents = React.useRef<Set<string>>(new Set())
  const handlersRef = React.useRef(handlers)
  handlersRef.current = handlers

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

  React.useEffect(() => {
    if (!echoAvailable) {
      setState("unavailable")
      return
    }

    let disposed = false

    const init = async (): Promise<void> => {
      try {
        const { default: Echo } = await import("laravel-echo")
        if (disposed) return

        if (!window.Echo) {
          window.Echo = new Echo({
            broadcaster: "reverb",
            key: import.meta.env.VITE_REVERB_APP_KEY as string,
            wsHost: import.meta.env.VITE_REVERB_HOST as string,
            wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
            wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 443),
            forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? "https") === "https",
            enabledTransports: ["ws", "wss"],
          }) as unknown as EchoClient
        }

        setState("connecting")

        const channel = window.Echo.private("admin.operations")
        channel.subscribed(() => {
          if (!disposed) setState("connected")
        })
        channel.error((_e) => {
          if (!disposed) setState("disconnected")
        })
        channel.listen("order.updated", (data) => {
          // Payload event dikirim sebagai data mentah; normalisasi ke tipe event.
          handleEvent(data as unknown as AdminOrderLiveEvent)
        })

        const connection = window.Echo?.connector?.pusher?.connection
        connection?.bind("disconnected", () => {
          if (!disposed) setState("disconnected")
        })
        connection?.bind("reconnecting", () => {
          if (!disposed) setState("reconnecting")
        })
        connection?.bind("connected", () => {
          if (!disposed) setState("connected")
        })
      } catch {
        if (!disposed) setState("unavailable")
      }
    }

    void init()

    return () => {
      disposed = true
      window.Echo?.leaveChannel("private-admin.operations")
    }
  }, [handleEvent])

  const refresh = React.useCallback(() => {
    // Hanya periksa status saat dipanggil manual; tidak ada polling otomatis.
    setState(echoAvailable ? "connecting" : "unavailable")
  }, [])

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