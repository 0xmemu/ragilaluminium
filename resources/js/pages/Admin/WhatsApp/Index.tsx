import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Switch } from "@/components/admin/ui/switch"
import { WhatsAppTabs } from "@/components/admin/whatsapp-tabs"
import AdminLayout from "@/layouts/admin-layout"

interface AutomationRow {
  id: number
  internal_key: string
  label: string
  description: string
  icon: string
  status: string
  provider_template_name: string
  language_code: string
  editUrl: string
  activateUrl: string
  deactivateUrl: string
}

interface ConnectionSummary {
  configured: boolean
  connected: boolean
  phone: string | null
  error?: string | null
  storefront_phone?: string | null
  last_synced_at?: string | null
}

export default function WhatsAppIndex({
  title,
  description,
  automations = [],
  totalTemplates = 0,
  replySignature = "",
  connection,
  pairingUrl,
}: {
  title: string
  description: string
  automations: AutomationRow[]
  totalTemplates?: number
  replySignature?: string
  connection?: ConnectionSummary
  pairingUrl?: string
}) {
  const [busyId, setBusyId] = React.useState<number | null>(null)

  function toggle(row: AutomationRow) {
    setBusyId(row.id)
    const url = row.status === "active" ? row.deactivateUrl : row.activateUrl
    router.post(url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        pairingUrl ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={pairingUrl}>
              <Icon name="link" className="size-3.5" aria-hidden="true" />
              {connection?.connected ? "Kelola sambungan" : "Sambungkan nomor"}
            </Link>
          </Button>
        ) : undefined
      }
    >
      <Head title={`${title} | Admin`} />

      <WhatsAppTabs active="templates" />

      {/* Ringkasan status sambungan WhatsApp (owner 2026-09-17) */}
      {connection ? (
        <section className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-soft">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={
                connection.connected
                  ? "flex size-10 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : connection.configured
                  ? "flex size-10 shrink-0 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 text-destructive"
                  : "flex size-10 shrink-0 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }
            >
              <Icon name="whatsapp" className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                Status WhatsApp
                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                  <span
                    aria-hidden="true"
                    className={
                      connection.connected
                        ? "inline-block size-2 rounded-full bg-emerald-500"
                        : connection.configured
                        ? "inline-block size-2 rounded-full bg-destructive"
                        : "inline-block size-2 rounded-full bg-amber-500"
                    }
                  />
                  <span
                    className={
                      connection.connected
                        ? "text-emerald-600 dark:text-emerald-400"
                        : connection.configured
                        ? "text-destructive"
                        : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    {connection.connected ? "Terhubung" : connection.configured ? "Terputus" : "Belum dikonfigurasi"}
                  </span>
                </span>
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {connection.connected
                  ? `Nomor ${connection.storefront_phone ?? connection.phone ?? "-"} dipakai di seluruh website dan untuk mengirim template di bawah.`
                  : connection.configured
                  ? `${connection.error ?? "Perangkat WhatsApp tidak aktif."} Nomor di website tetap ${connection.storefront_phone ?? "nomor terakhir"} sampai nomor baru tersambung.`
                  : `Gateway WhatsApp belum dikonfigurasi. Nomor di website memakai ${connection.storefront_phone ?? "nomor dari pengaturan kontak"}.`}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mb-3 space-y-1 text-xs leading-5 text-muted-foreground">
        <p>
          Urutan daftar mengikuti alur pesanan: pesanan dibuat, instruksi pembayaran, pesanan diproses, resi dikirim,
          pesanan sampai, lalu tindak lanjut masalah dan retur.
        </p>
        {replySignature ? <p>Setiap pesan otomatis ditutup footer: {replySignature}</p> : null}
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_5rem] gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-tight text-muted-foreground sm:grid">
          <span>Trigger event</span>
          <span>Status</span>
          <span className="text-right">Aksi</span>
        </div>

        {automations.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground">Belum ada otomasi WhatsApp.</p>
        ) : (
          <ul className="divide-y divide-dashed divide-border">
            {automations.map((row) => {
              const active = row.status === "active"
              const busy = busyId === row.id

              return (
                <li
                  key={row.id}
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_5rem] sm:items-center sm:gap-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
                      <Icon name={row.icon as never} className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{row.label}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{row.description}</p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {row.internal_key} · {row.provider_template_name} · {row.language_code}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:justify-start">
                    <Switch
                      checked={active}
                      disabled={busy}
                      label={`${active ? "Nonaktifkan" : "Aktifkan"} ${row.label}`}
                      onCheckedChange={() => toggle(row)}
                    />
                    <StatusBadge status={active ? "active" : "inactive"} />
                  </div>

                  <div className="flex sm:justify-end">
                    <Button asChild variant="secondary" className="h-9 px-3">
                      <Link href={row.editUrl} aria-label={`Edit ${row.label}`}>
                        <Icon name="pencil" className="size-4" aria-hidden="true" />
                        <span className="sm:sr-only">Edit</span>
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p>*Semua menampilkan template pesan otomatis: {totalTemplates}.</p>
          <p>Halaman 1 dari 1</p>
        </div>
      </section>

    </AdminLayout>
  )
}
