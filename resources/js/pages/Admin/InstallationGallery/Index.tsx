import { Head, Link, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

interface ModelGroup {
  id: string
  image_url: string | null
  label: string
  product_count: number
  photo_count: number
  video_count: number
  category: string
  model: string
  source: "import" | "catalog"
  manage_url: string
  category_label: string
}

/**
 * Tingkat 1: kartu per model produk, mengikuti struktur storefront
 * /hasil-pemasangan. Kelola media di tingkat 2 (drill-down per model).
 */
export default function InstallationGalleryIndex({
  title,
  description,
  previewUrl,
  groups = [],
  manualGroup,
}: {
  title: string
  description: string
  previewUrl?: string | null
  groups?: ModelGroup[]
  manualGroup?: { manage_url: string; published: number; total: number }
}) {
  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          {previewUrl ? (
            <Button asChild variant="secondary">
              <a href={previewUrl} target="_blank" rel="noreferrer">
                Lihat halaman publik
              </a>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {groups.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((group) => (
            <article
              key={group.id}
              className="flex flex-col justify-between overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-primary"
            >
              <Link href={group.manage_url} className="block aspect-[4/3] w-full overflow-hidden bg-muted/30">
                {group.image_url ? (
                  <img
                    src={group.image_url}
                    alt={group.label}
                    className="size-full object-cover transition duration-300 hover:scale-[1.03]"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  </span>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {group.category_label}
                </p>
                <h2 className="mt-0.5 text-sm font-bold leading-snug text-foreground">{group.label}</h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">{group.photo_count} foto</span>
                  {group.video_count > 0 ? <span className="tabular-nums">{group.video_count} video</span> : null}
                  <span className="tabular-nums">{group.product_count} produk</span>
                </div>
                <div className="mt-3 border-t border-border/60 pt-3">
                  <Link
                    href={group.manage_url}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                  >
                    Kelola media
                    <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {manualGroup ? (
            <article className="flex flex-col justify-between overflow-hidden rounded-lg border border-dashed border-border bg-muted/20">
              <div className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Galeri manual
                </p>
                <h2 className="mt-0.5 text-sm font-bold leading-snug text-foreground">
                  Lainnya (tanpa model produk)
                </h2>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="tabular-nums">{manualGroup.published} published</span>
                  <span className="tabular-nums">{manualGroup.total} total</span>
                </div>
              </div>
              <div className="p-4 pt-0">
                <Link
                  href={manualGroup.manage_url}
                  className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
                >
                  Kelola galeri manual
                  <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </article>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title="Belum ada media hasil pemasangan"
          description="Foto hasil pemasangan muncul di sini setelah media ditandai Hasil pemasangan pada produk."
        />
      )}
    </AdminLayout>
  )
}
