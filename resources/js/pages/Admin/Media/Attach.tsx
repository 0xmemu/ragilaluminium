import * as React from "react"
import { Head, Link } from "@inertiajs/react"

import AdminLayout from "@/layouts/admin-layout"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { router } from "@inertiajs/react"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { routeUrl } from "@/lib/routes"

type AttachAsset = {
  id: number
  label: string
  kind: string
  status: string
  thumb_url: string
  public_url: string
  created_at: string | null
}

type Usage = {
  product_id: number
  product_name: string
  parent_sku: string
  position: number
  is_main: boolean
  is_installation: boolean
  show_in_catalog: boolean
  visibility: string
}

function statusMeta(status: string): { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" } {
  switch (status) {
    case "ready": return { label: "Siap digunakan", tone: "success" }
    case "pending": return { label: "Menunggu", tone: "warning" }
    case "processing": return { label: "Diproses", tone: "info" }
    case "failed": return { label: "Gagal", tone: "danger" }
    case "archived": return { label: "Diarsipkan", tone: "neutral" }
    default: return { label: status, tone: "neutral" }
  }
}

export default function MediaAttach({
  asset,
  usages,
  libraryHref,
  destroyUrl,
}: {
  asset: AttachAsset
  usages: Usage[]
  libraryHref: string
  destroyUrl?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const meta = statusMeta(asset.status)

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(asset.public_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <AdminLayout backUrl={libraryHref} title="Detail media" description={asset.label}>
      <Head title={`Media #${asset.id} | Admin`} />
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <div className="overflow-hidden rounded-lg border border-border bg-surface-muted">
            <img src={asset.thumb_url} alt={asset.label} className="aspect-square w-full object-cover" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <StatusBadge label={meta.label} tone={meta.tone} />
              <span className="text-xs text-muted-foreground">#{asset.id}</span>
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">{asset.public_url}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={copyUrl}>
                {copied ? "Tersalin" : "Salin URL"}
              </Button>
              <Button asChild size="sm" variant="ghost">
                <a href={asset.public_url} target="_blank" rel="noreferrer">Buka asli</a>
              </Button>
              {usages.length === 0 && destroyUrl ? (
                <ConfirmAction
                  trigger={
                    <Button type="button" size="sm" variant="destructive">
                      Hapus berkas
                    </Button>
                  }
                  title="Hapus berkas media?"
                  description={`Aset "${asset.label}" tidak digunakan di produk mana pun dan akan dihapus permanen dari penyimpanan.`}
                  confirmLabel="Hapus Permanen"
                  onConfirm={() => router.delete(destroyUrl)}
                />
              ) : null}
            </div>
          </div>
        </div>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Dipasang di {usages.length} produk</h2>
          {usages.length ? (
            <ul className="mt-3 divide-y divide-border">
              {usages.map((usage) => (
                <li key={`${usage.product_id}-${usage.position}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={routeUrl("admin.products.edit", { product: usage.product_id })} className="font-medium text-foreground hover:underline">
                    {usage.product_name}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {usage.is_main ? <span className="rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-bold text-background">Utama</span> : null}
                    {usage.is_installation ? <span>Pemasangan</span> : null}
                    <span>Posisi {usage.position}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Belum dipasang ke produk mana pun.</p>
          )}
        </section>
      </div>
    </AdminLayout>
  )
}
