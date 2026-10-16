import * as React from "react"

import {
  type AdminLiveState,
  type AdminLiveMessage,
  subscribeAdminLive,
  useAdminLive,
} from "@/lib/admin-live-connection"

/**
 * Adapter event live admin untuk halaman pesanan.
 *
 * Sejak Tahap 3 (16 Okt 2026) berkas ini TIDAK lagi membuat sambungan Echo
 * sendiri. Sambungan, pemilihan pemimpin antar tab, dan denyut data dimiliki
 * satu modul: `@/lib/admin-live-connection`. Berkas ini hanya menerjemahkan
 * pesan live menjadi callback untuk halaman.
 *
 * Kenapa diubah: sebelumnya berkas ini dan `live-notification-manager.tsx`
 * sama-sama membuat sambungan Echo dan berlangganan kanal `admin.operations`
 * yang sama, sehingga satu peramban membuka dua sambungan untuk hal yang sama.
 *
 * API lama dipertahankan supaya pemanggil yang sudah ada tidak perlu diubah.
 */

export type AdminLiveConnectionState = AdminLiveState

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

/** Batas penyimpanan event_id untuk dedupe (mencegah Set tumbuh tanpa batas). */
const DEDUPE_CAP = 200

export function useAdminLiveOrders(handlers: AdminLiveOrderHandlers): {
  state: AdminLiveConnectionState
  lastEventAt: string | null
  refresh: () => void
} {
  const { state, lastEventAt, refresh } = useAdminLive()

  const seenEvents = React.useRef<Set<string>>(new Set())
  const handlersRef = React.useRef(handlers)
  // Handler terbaru dipasang setelah commit; menulis ref saat render dilarang
  // oleh lint React Compiler (react-hooks/refs).
  React.useEffect(() => {
    handlersRef.current = handlers
  })

  React.useEffect(() => {
    return subscribeAdminLive((message: AdminLiveMessage) => {
      if (message.type !== "event" || message.event !== "order.updated") return

      const event = message.data as AdminOrderLiveEvent
      const key = event?.event_id
      if (!key) return
      if (seenEvents.current.has(key)) return

      seenEvents.current.add(key)
      if (seenEvents.current.size > DEDUPE_CAP) {
        const items = Array.from(seenEvents.current)
        seenEvents.current = new Set(items.slice(-Math.floor(DEDUPE_CAP / 2)))
      }

      handlersRef.current.onOrderUpdated?.(event)
    })
  }, [])

  return { state, lastEventAt, refresh }
}

