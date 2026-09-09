import * as React from "react"
import { Link } from "@inertiajs/react"
import { Icon } from "@/components/shared/icon"
import { routeUrl } from "@/lib/routes"

interface ToastItem {
  id: string
  type: "order" | "whatsapp" | "generic"
  title: string
  subtitle: string
  amount?: string
  body?: string
  href: string
  timestamp: number
}

interface AdminOrderCreatedEvent {
  event_id: string
  occurred_at: string
  order_id: number
  order_number: string
  customer_name: string
  customer_phone: string
  total_amount: number
  total_amount_formatted: string
  shipping_city: string
  href: string
}

interface AdminWhatsAppReceivedEvent {
  event_id: string
  occurred_at: string
  message_id: number
  phone_number: string
  customer_name?: string | null
  order_number?: string | null
  content_text: string
  href: string
}

interface PollResponse {
  unread_count: number
  latest_id: number
  new_notifications: Array<{
    id: number
    type: string
    title: string
    body?: string | null
    href?: string | null
    created_at?: string | null
  }>
}

function playNotificationChime(type: "order" | "whatsapp" | "generic" = "generic"): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    if (ctx.state === "suspended") {
      void ctx.resume()
    }

    const now = ctx.currentTime

    if (type === "order") {
      // 3-note celebration chime: G5 -> C6 -> E6
      const freqs = [783.99, 1046.5, 1318.51]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now + idx * 0.09)
        gain.gain.setValueAtTime(0, now + idx * 0.09)
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.09 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.09)
        osc.stop(now + idx * 0.09 + 0.36)
      })
    } else if (type === "whatsapp") {
      // 2-note message chirp: F5 -> A5
      const freqs = [698.46, 880.0]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now + idx * 0.08)
        gain.gain.setValueAtTime(0, now + idx * 0.08)
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + idx * 0.08)
        osc.stop(now + idx * 0.08 + 0.29)
      })
    } else {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.29)
    }
  } catch {
    // Autoplay policy di browser; diabaikan tanpa error
  }
}

export function LiveNotificationManager(): React.ReactElement | null {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])
  const seenIdsRef = React.useRef<Set<string>>(new Set())
  const lastPollIdRef = React.useRef<number>(0)

  const dismissToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const pushToast = React.useCallback((item: ToastItem) => {
    if (seenIdsRef.current.has(item.id)) return
    seenIdsRef.current.add(item.id)

    // Batasi ukuran set seenIds
    if (seenIdsRef.current.size > 200) {
      const arr = Array.from(seenIdsRef.current)
      seenIdsRef.current = new Set(arr.slice(-100))
    }

    setToasts((prev) => [item, ...prev.slice(0, 4)])
    playNotificationChime(item.type)

    // Auto dismiss setelah 7 detik
    window.setTimeout(() => {
      dismissToast(item.id)
    }, 7000)
  }, [dismissToast])

  // Inisialisasi WebSocket Reverb
  React.useEffect(() => {
    let disposed = false

    const connectReverb = async (): Promise<void> => {
      const reverbKey = import.meta.env.VITE_REVERB_APP_KEY
      if (!reverbKey) return

      try {
        const { default: Echo } = await import("laravel-echo")
        if (disposed) return

        if (!window.Echo) {
          const host = (import.meta.env.VITE_REVERB_HOST as string) || window.location.hostname
          const scheme = (import.meta.env.VITE_REVERB_SCHEME as string) || "https"
          const isTls = scheme === "https"

          window.Echo = new Echo({
            broadcaster: "reverb",
            key: reverbKey,
            wsHost: host,
            wsPort: 80,
            wssPort: 443,
            forceTLS: isTls,
            enabledTransports: ["ws", "wss"],
          }) as unknown as typeof window.Echo
        }

        const echoClient = window.Echo
        if (!echoClient) return
        const channel = echoClient.private("admin.operations")

        channel.listen(".order.created", (data: AdminOrderCreatedEvent) => {
          if (disposed) return
          pushToast({
            id: "order-" + data.event_id,
            type: "order",
            title: "Pesanan Baru Masuk",
            subtitle: data.order_number + " : " + (data.customer_name || "Pelanggan"),
            amount: data.total_amount_formatted,
            body: data.shipping_city ? "Tujuan: " + data.shipping_city : undefined,
            href: data.href || routeUrl("admin.orders.show", { order: data.order_id }),
            timestamp: Date.now(),
          })
        })

        channel.listen(".whatsapp.received", (data: AdminWhatsAppReceivedEvent) => {
          if (disposed) return
          const senderLabel = data.customer_name
            ? data.customer_name + " (" + data.phone_number + ")"
            : data.phone_number

          pushToast({
            id: "wa-" + data.event_id,
            type: "whatsapp",
            title: "Pesan WhatsApp Masuk",
            subtitle: senderLabel,
            body: data.content_text,
            href: data.href || routeUrl("admin.whatsapp.messages.index", { phone: data.phone_number }),
            timestamp: Date.now(),
          })
        })
      } catch {
        // Fallback ke polling otomatis
      }
    }

    void connectReverb()

    return () => {
      disposed = true
    }
  }, [pushToast])

  // Heartbeat Polling Fallback (setiap 8 detik)
  React.useEffect(() => {
    let disposed = false

    const pollNotifications = async (): Promise<void> => {
      try {
        const url = routeUrl("admin.notifications.poll") + "?last_id=" + lastPollIdRef.current
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
        })

        if (!res.ok || disposed) return
        const data = (await res.json()) as PollResponse

        if (lastPollIdRef.current === 0) {
          // Inisialisasi awal ID, tidak memicu alert notifikasi lama saat halaman pertama kali dimuat
          lastPollIdRef.current = data.latest_id || 0
          return
        }

        if (data.latest_id > lastPollIdRef.current) {
          lastPollIdRef.current = data.latest_id

          if (Array.isArray(data.new_notifications) && data.new_notifications.length > 0) {
            for (const notif of data.new_notifications) {
              const notifType = notif.type === "order_created" ? "order" : notif.type === "whatsapp_inbound" ? "whatsapp" : "generic"
              pushToast({
                id: "notif-" + notif.id,
                type: notifType,
                title: notif.title || "Notifikasi Baru",
                subtitle: notif.body || "",
                href: notif.href || routeUrl("admin.notifications.index"),
                timestamp: Date.now(),
              })
            }
          }
        }
      } catch {
        // Abaikan kegagalan jaringan sementara
      }
    }

    // Eksekusi inisialisasi awal
    void pollNotifications()

    const timer = window.setInterval(() => {
      if (!disposed) {
        void pollNotifications()
      }
    }, 8000)

    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [pushToast])

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-full max-w-sm flex-col gap-2.5"
      role="region"
      aria-label="Notifikasi langsung toko"
    >
      {toasts.map((toast) => {
        const isOrder = toast.type === "order"
        const isWa = toast.type === "whatsapp"

        return (
          <div
            key={toast.id}
            className="pointer-events-auto group relative flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-card-foreground shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4"
          >
            {/* Ikon dengan animasi ping badge */}
            <div className="relative mt-0.5 shrink-0">
              <div
                className={`flex size-9 items-center justify-center rounded-full ${
                  isOrder
                    ? "bg-primary/15 text-primary"
                    : isWa
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-surface text-foreground border border-border"
                }`}
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <Icon
                  name={isOrder ? "shopping-cart" : isWa ? "whatsapp" : "bell"}
                  className="relative z-10 size-4"
                />
              </div>
            </div>

            {/* Isi Notifikasi */}
            <div className="min-w-0 flex-1 pr-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-foreground tracking-tight">
                  {toast.title}
                </p>
                <span className="font-mono text-[10px] text-muted-foreground">Baru saja</span>
              </div>

              <p className="mt-0.5 truncate text-xs font-medium text-foreground/90">
                {toast.subtitle}
              </p>

              {toast.amount ? (
                <p className="mt-0.5 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {toast.amount}
                </p>
              ) : null}

              {toast.body && !toast.amount ? (
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                  {toast.body}
                </p>
              ) : null}

              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={toast.href}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  onClick={() => dismissToast(toast.id)}
                >
                  <span>{isOrder ? "Lihat Pesanan" : isWa ? "Buka Chat" : "Buka Detail"}</span>
                  <Icon name="arrow-right" className="size-3" />
                </Link>
              </div>
            </div>

            {/* Tombol Tutup */}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="-mr-1 -mt-1 shrink-0 p-1 text-muted-foreground transition hover:text-foreground"
              aria-label="Tutup notifikasi"
            >
              <Icon name="x" className="size-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
