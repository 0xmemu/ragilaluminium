import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

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

export default function WhatsAppIndex({
  title,
  description,
  automations = [],
  connectionUrl,
  messagesUrl,
  totalTemplates = 0,
}: {
  title: string
  description: string
  automations: AutomationRow[]
  connectionUrl: string
  messagesUrl: string
  totalTemplates?: number
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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={messagesUrl}>Log pesan</Link>
          </Button>
          <Button asChild>
            <Link href={connectionUrl}>
              <Icon name="whatsapp" className="size-4" aria-hidden="true" />
              Status Koneksi
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_5rem] gap-4 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
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
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={`${active ? "Nonaktifkan" : "Aktifkan"} ${row.label}`}
                      disabled={busy}
                      onClick={() => toggle(row)}
                      className={cn(
                        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                        active ? "bg-foreground" : "bg-muted",
                        busy && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-6 rounded-full bg-surface shadow transition-transform",
                          active ? "translate-x-5" : "translate-x-0.5",
                        )}
                      />
                    </button>
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
