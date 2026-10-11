import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

/**
 * Ringkasan status sambungan WhatsApp, satu komponen untuk seluruh panel admin.
 *
 * Dipakai halaman Ringkasan WhatsApp dan halaman Template Pesan supaya status
 * yang sama tidak tampil dengan dua gaya berbeda. Tiga keadaan yang mungkin:
 * terhubung, gateway aktif tetapi perangkat terputus, dan belum dikonfigurasi.
 */
export interface WhatsAppConnectionSummary {
  configured: boolean
  connected: boolean
  phone: string | null
  error?: string | null
  storefront_phone?: string | null
  last_synced_at?: string | null
}

function keadaan(connection: WhatsAppConnectionSummary): {
  tone: "success" | "danger" | "warning"
  ikon: string
  label: string
  nomor: string
  catatan: string | null
} {
  const nomor = (connection.storefront_phone ?? connection.phone ?? "").trim() || "-"

  if (connection.connected) {
    return { tone: "success", ikon: "whatsapp", label: "Terhubung", nomor, catatan: null }
  }

  if (connection.configured) {
    return {
      tone: "danger",
      ikon: "whatsapp",
      label: "Terputus",
      nomor,
      // Hanya sebab terputusnya yang perlu dibaca; sisanya sudah terbaca dari
      // nomor besar di bawah dan label status di atas.
      catatan: connection.error ?? "Perangkat WhatsApp sedang tidak aktif.",
    }
  }

  return { tone: "warning", ikon: "whatsapp", label: "Belum dikonfigurasi", nomor, catatan: null }
}

const TONE_ICON: Record<string, string> = {
  success: "border-success/40 bg-success/15 text-success",
  danger: "border-destructive/40 bg-destructive/15 text-destructive",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground",
}

const TONE_DOT: Record<string, string> = {
  success: "bg-success",
  danger: "bg-destructive",
  warning: "bg-warning",
}

export function WhatsAppConnectionCard({
  connection,
  className,
  actionHref = routeUrl("admin.whatsapp.pairing"),
}: {
  connection: WhatsAppConnectionSummary
  className?: string
  /** Tautan aksi di kanan kartu. Kirim null untuk menyembunyikannya. */
  actionHref?: string | null
}) {
  const { tone, ikon, label, nomor, catatan } = keadaan(connection)

  return (
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-soft",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md border",
            TONE_ICON[tone],
          )}
        >
          <Icon name={ikon} className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            Status WhatsApp
            <span className="inline-flex items-center gap-1.5 text-xs font-medium">
              <span aria-hidden="true" className={cn("inline-block size-2 rounded-full", TONE_DOT[tone])} />
              <span className={TONE_ICON[tone].split(" ").pop()}>{label}</span>
            </span>
          </p>
          <p className="mt-1 text-xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
            <span className="sr-only">Nomor WhatsApp: </span>
            {nomor}
          </p>
          {catatan ? (
            <p className="mt-1 text-xs leading-5 text-destructive">{catatan}</p>
          ) : null}
        </div>
      </div>
      {actionHref ? (
        <Link
          href={actionHref}
          className="shrink-0 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          {connection.connected ? "Kelola sambungan" : "Sambungkan nomor"}
        </Link>
      ) : null}
    </section>
  )
}
