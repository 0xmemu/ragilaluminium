import { Head, Link } from "@inertiajs/react"
import { useEffect, useState } from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatDate } from "@/lib/format"

interface ConnectionInfo {
  configured: boolean
  default_provider: string
  compare_provider: string | null
  compare_allowlist: string[]
  webhook_path: string
  baileys_webhook_path: string
  providers: {
    meta: {
      configured: boolean
      base_url?: string | null
      token_set: boolean
      number_id_set?: boolean
      verify_token_set?: boolean
    }
    baileys: {
      configured: boolean
      base_url?: string | null
      token_set: boolean
      session?: string | null
      api_key_set?: boolean
      webhook_secret_set?: boolean
    }
  }
}

interface ConnectionStats {
  sent_count: number
  failed_count: number
  last_sent_at: string | null
}

export default function WhatsAppConnection({
  title,
  description,
  backUrl,
  pairingUrl,
  statusUrl,
  connection,
  stats,
}: {
  title: string
  description: string
  pairingUrl: string
  statusUrl: string
  backUrl: string
  connection: ConnectionInfo
  stats: ConnectionStats
}) {
  const baileys = connection.providers.baileys
  const isBaileysActive = connection.default_provider === "baileys"

  const [liveStatus, setLiveStatus] = useState<string>("unknown")

  useEffect(() => {
    let active = true
    const poll = () => {
      fetch(statusUrl, { headers: { Accept: "application/json" } })
        .then((r) => r.json())
        .then((d) => {
          if (!active) return
          if (d.status) setLiveStatus(d.status)
        })
        .catch(() => {})
    }
    poll()
    const t = setInterval(poll, 4000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [statusUrl])

  const liveConnected = liveStatus === "open"

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={<StatusBadge status={connection.configured ? "active" : "inactive"} />}
    >
      <Head title={`${title} | Admin`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary">
          <Link href={backUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke WhatsApp Otomatis
          </Link>
        </Button>
        <Button asChild variant="primary">
          <a href={pairingUrl}>
            <Icon name="phone" className="size-4" aria-hidden="true" />
            Pairing WhatsApp
          </a>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
              <Icon name="whatsapp" className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold">
                {isBaileysActive ? "Gateway Baileys aktif" : "Provider aktif belum disetel"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                WhatsApp dikirim lewat gateway <b>Baileys</b> yang berjalan di server. Hubungkan nomor
                lewat tombol <b>Pairing WhatsApp</b> di atas.
              </p>
            </div>
          </div>

          <Alert tone={isBaileysActive ? "info" : "warning"}>
            {isBaileysActive
              ? `Provider aktif: ${connection.default_provider.toUpperCase()}. Pesan otomatis toko dikirim lewat gateway Baileys yang sudah terhubung.`
              : `Provider aktif belum disetel ke Baileys. Pastikan WHATSAPP_PROVIDER=baileys di .env.`}
          </Alert>

          <div className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Baileys (gateway)</h3>
              <StatusBadge status={baileys.configured ? "active" : "inactive"} />
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">API key</dt>
                <dd className="font-semibold">{baileys.api_key_set ? "Terisi" : "Kosong"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Session</dt>
                <dd className="font-mono text-xs font-semibold">{baileys.session ?? "default"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Webhook secret</dt>
                <dd className="font-semibold">{baileys.webhook_secret_set ? "Terisi" : "Kosong"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Webhook</dt>
                <dd className="font-mono text-xs font-semibold">{connection.baileys_webhook_path}</dd>
              </div>
              {baileys.base_url ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Base URL</dt>
                  <dd className="max-w-[60%] truncate font-mono text-xs">{baileys.base_url}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <dl className="space-y-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider aktif</dt>
              <dd className="font-semibold uppercase">{connection.default_provider}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Compare provider</dt>
              <dd className="font-semibold uppercase">{connection.compare_provider ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Allowlist compare</dt>
              <dd className="max-w-[60%] text-right font-mono text-xs">
                {connection.compare_allowlist.length > 0 ? connection.compare_allowlist.join(", ") : "Belum ada"}
              </dd>
            </div>
          </dl>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-bold text-foreground">Cara menghubungkan nomor</h3>
            <ol className="list-decimal space-y-2.5 pl-5 text-sm text-muted-foreground">
              <li>
                Klik <b>Pairing WhatsApp</b> di atas.
              </li>
              <li>
                Di HP: buka WhatsApp → <b>Menu</b> → <b>Perangkat Tertaut</b> →{" "}
                <b>Tautkan Perangkat</b>.
              </li>
              <li>
                Scan QR yang tampil, atau pilih <i>"Tautkan dengan nomor telepon"</i> lalu masukkan{" "}
                <b>pairing code</b> 8 digit.
              </li>
              <li>
                Setelah terhubung, status gateway menjadi <b>Terhubung</b> dan notifikasi order
                otomatis terkirim.
              </li>
            </ol>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-bold">Perangkat & trafik</h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Status koneksi</dt>
              <dd className="mt-1 text-lg font-bold">
                {liveConnected ? "Terhubung" : connection.configured ? "Siap kirim" : "Mode degradasi / belum siap"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Total pesan terkirim</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{stats.sent_count}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Gagal</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums">{stats.failed_count}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-tight text-muted-foreground">Pengiriman terakhir</dt>
              <dd className="mt-1 font-semibold">
                {stats.last_sent_at ? formatDate(stats.last_sent_at) : "Belum ada"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </AdminLayout>
  )
}
