import { Head, Link, router } from "@inertiajs/react"
import { useState } from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { ManageProductsTabs } from "@/components/admin/manage-products-tabs"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { routeUrl } from "@/lib/routes"

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
  backUrl?: string
}

export default function CategoriesIndex({ title, description, categories, createHref, backUrl }: Props) {
  const [busy, setBusy] = useState<number | null>(null)

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={
        <Button asChild size="sm">
          <Link href={createHref}>
            <Icon name="plus" className="size-4" aria-hidden="true" />
            Tambah kategori
          </Link>
        </Button>
      }
    >
      <Head title={`${title} | Admin`} />
      <ManageProductsTabs active="categories" />

      <Card className="overflow-hidden border border-border bg-card">
        {categories.length === 0 ? (
          <EmptyState
            className="p-8"
            icon="tags"
            title="Belum ada kategori"
            description="Kategori produk utama toko akan tampil di tabel ini."
            action={
              <Button asChild size="sm">
                <Link href={createHref}>
                  <Icon name="plus" className="size-4" aria-hidden="true" />
                  Tambah kategori
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Nama Kategori</th>
                  <th className="px-3 py-3 text-center">Kode</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Produk Terkait</th>
                  <th className="px-3 py-3 text-center">Urutan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 align-middle">
                      <div className="space-y-0.5">
                        <Link
                          href={c.editUrl}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">/products/{c.slug}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="font-mono text-xs font-semibold text-foreground">{c.code}</span>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={c.is_active ? "active" : "inactive"} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="font-mono text-xs font-medium text-foreground">
                        {c.products_count} produk
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span className="font-mono text-xs text-muted-foreground">{c.sort_order}</span>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="secondary" size="xs">
                          <Link href={c.editUrl}>Edit</Link>
                        </Button>
                        <ConfirmAction
                          trigger={
                            <Button variant="ghost" size="xs" className="text-destructive hover:bg-destructive/10">
                              Hapus
                            </Button>
                          }
                          title="Hapus kategori?"
                          description="Kategori yang masih dipakai produk tidak bisa dihapus."
                          confirmLabel="Hapus"
                          processing={busy === c.id}
                          onConfirm={() => {
                            setBusy(c.id)
                            router.delete(routeUrl("admin.categories.destroy", { category: c.id }), {
                              preserveScroll: true,
                              onFinish: () => setBusy(null),
                            })
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminLayout>
  )
}
