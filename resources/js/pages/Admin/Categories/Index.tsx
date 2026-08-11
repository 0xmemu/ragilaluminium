import { Head, Link, router } from "@inertiajs/react"
import { useState } from "react"

import { Button } from "@/components/admin/ui/button"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"

interface Category {
  id: number
  code: string
  name: string
  slug: string
  seo_title?: string | null
  sort_order: number
  is_active: boolean
  products_count: number
  editUrl: string
}

interface Props {
  title: string
  description: string
  categories: Category[]
  createHref: string
  backUrl: string
}

export default function CategoriesIndex({ title, description, categories, createHref, backUrl }: Props) {
  const [busy, setBusy] = useState<number | null>(null)

  return (
    <AdminLayout title={title} description={description} backUrl={backUrl} actions={undefined}>
      <Head title={`${title} | Admin`} />
      <ListToolbar
        actions={
          <Button asChild>
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah Kategori
            </Link>
          </Button>
        }
        className="mb-4"
      />
      <div className="rounded-xl border border-border bg-card shadow-soft">
        <div className="divide-y divide-border">
          {categories.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada kategori.</p>
          ) : categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{c.name}</p>
                  <StatusBadge status={c.is_active ? "active" : "inactive"} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.code} · /products/{c.slug} · {c.products_count} produk
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="secondary" size="sm"><Link href={c.editUrl}>Edit</Link></Button>
                <ConfirmAction
                  trigger={<button type="button" className="text-sm text-destructive">Hapus</button>}
                  title="Hapus kategori?"
                  description="Kategori yang masih dipakai produk tidak bisa dihapus."
                  confirmLabel="Hapus"
                  processing={busy === c.id}
                  onConfirm={() => {
                    setBusy(c.id)
                    router.delete(route("admin.categories.destroy", c.id), { preserveScroll: true, onFinish: () => setBusy(null) })
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}
