import { Head, Link } from "@inertiajs/react"
import * as React from "react"
import { useState } from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface Automation {
  id: number | null
  internal_key: string
  label: string
  description: string
  icon: string
  status: string
  provider_template_name: string
  language_code: string
  editUrl: string | null
}

interface ConnInfo {
  default_provider: string
  providers: { baileys: { configured: boolean; base_url?: string | null } }
}

interface MsgRow {
  id: number
  provider: string
  direction: string
  phone_number: string
  status: string
  content: string
  order_number: string
  created_at: string
}

interface Props {
  title: string
  description: string
  automations: Automation[]
  connection: ConnInfo
  recentMessages: MsgRow[]
  stats: { sent: number; failed: number; total: number; last_sent_at: string | null }
  statusUrl: string
  qrUrl: string
  refreshQrUrl: string
  codeUrl: string
  templatesUrl: string
  messagesUrl: string
  pairingUrl: string
}

export default function WhatsAppDashboard({
  title,
  description,
  automations,
  recentMessages,
  stats,
  statusUrl,
  qrUrl,
  refreshQrUrl,
  templatesUrl,
  messagesUrl,
  pairingUrl,
}: Props) {
  const [status, setStatus] = useState<string>("unknown")
  const [statusText, setStatusText] = useState<string>("Status belum dimuat")
  const [qrTs, setQrTs] = useState<number>(0)
  const [hasSession, setHasSession] = useState<boolean>(false)
  const [connectedPhone, setConnectedPhone] = useState<string>("")
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)

  // Manual refresh eksplisit - TANPA polling/setInterval (Design Contract D).
  function refreshStatus() {
    setRefreshing(true)
    setRefreshError(null)
    fetch(statusUrl, { headers: { Accept: "application/json" } })
      .then((r) => r.json())
      .then((d) => {
        setStatus(d.status)
        setStatusText(d.statusText)
        if (typeof d.has_session === "boolean") setHasSession(d.has_session)
        if (d.connected_phone) setConnectedPhone(d.connected_phone)
        if (d.status === "SCAN_QR" && !d.has_session) setQrTs(Date.now())
        setLastCheckedAt(Date.now())
      })
      .catch(() => setRefreshError("Status gagal dimuat. Coba lagi."))
      .finally(() => setRefreshing(false))
  }

  React.useEffect(() => {
    refreshStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusUrl])

  const connected = status === "open"
  const unreachable = status === "unreachable"
  const showQr = !hasSession && (status === "SCAN_QR" || status === "connecting")

  // Mapping health empat status kontrak: Sehat / Perlu Perhatian / Gagal atau Offline / Belum Dikonfigurasi.
  const healthLabel = connected
    ? "Sehat"
    : unreachable
      ? "Gagal atau Offline"
      : hasSession
        ? "Perlu Perhatian"
        : "Belum Dikonfigurasi"
  const healthTone = connected ? "success" : unreachable ? "danger" : hasSession ? "warning" : "neutral"

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge status={healthTone} label={healthLabel} />
          <Button type="button" variant="ghost" size="sm" onClick={refreshStatus} disabled={refreshing}>
            <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {refreshing ? "Memuat..." : "Refresh"}
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* Connection / linked status */}
      <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Icon name="whatsapp" className="size-8 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold">
                {connected ? "Terhubung" : unreachable ? "Gateway tidak terjangkau" : hasSession ? "Sesi terdeteksi" : "Belum tertaut"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {connected
                  ? `Nomor: ${connectedPhone || "-"} · Gateway Baileys aktif`
                  : unreachable
                    ? statusText
                    : hasSession
                      ? "Gateway sedang memulihkan koneksi..."
                      : `Status: ${statusText}`}
              </p>
              {refreshError ? (
                <p className="mt-1 text-xs font-medium text-destructive" role="status">{refreshError}</p>
              ) : lastCheckedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Terakhir diperiksa: {new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(lastCheckedAt))} WIB
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link href={pairingUrl}>Pairing</Link>
            </Button>
            {showQr && (
              <form method="post" action={refreshQrUrl}>
                <Button type="submit" variant="secondary">Generate QR</Button>
              </form>
            )}
          </div>
        </div>

        {showQr && (
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <img src={`${qrUrl}?t=${qrTs}`} alt="WhatsApp QR" className="h-48 w-auto rounded-md border border-border" />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Scan QR untuk menautkan perangkat</p>
              <p>Buka WhatsApp di HP → Menu → Perangkat Tertaut → Tautkan Perangkat.</p>
              <p className="mt-2 text-xs">Atau gunakan pairing code lewat halaman Pairing.</p>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Terkirim</p>
            <p className="text-xl font-bold">{stats.sent}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Gagal</p>
            <p className="text-xl font-bold">{stats.failed}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs uppercase text-muted-foreground">Total pesan</p>
            <p className="text-xl font-bold">{stats.total}</p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid min-w-0 max-w-full gap-6 lg:grid-cols-1 xl:grid-cols-2">
        {/* Template cards */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold">Template Pesan Otomatis</h3>
            <Button asChild variant="secondary" size="sm"><Link href={templatesUrl}>Kelola</Link></Button>
          </div>
          <div className="space-y-3">
            {automations.map((row) => (
              <div key={row.internal_key} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={row.status} />
                  {row.editUrl && <Button asChild variant="ghost" size="sm"><Link href={row.editUrl}>Edit</Link></Button>}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent message logs */}
        <section className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold">Log Pesan Terbaru</h3>
            <Button asChild variant="secondary" size="sm"><Link href={messagesUrl}>Semua</Link></Button>
          </div>
          {recentMessages.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pesan.</p>
          ) : (
            <div className="divide-y divide-border">
              {recentMessages.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{m.content || "-"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.phone_number} · {m.order_number} · {m.created_at}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] uppercase text-muted-foreground">{m.direction}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
