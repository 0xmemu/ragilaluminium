import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface FilterOption {
  value: string
  label: string
}

interface ProductCard {
  id: number
  parent_sku: string
  name: string
  short_name?: string | null
  product_category: string
  product_category_label: string
  product_model: string
  product_model_label: string
  design_variant?: string | null
  design_variant_label?: string | null
  status: string
  min_price: number | null
  stock_total: number
  variants_count: number
  active_variants_count: number
  image?: string | null
  updated_at: string | null
  href: string
  edit_href: string
  variants_href: string
  media_href: string
  archive_url: string
  unarchive_url: string
  public_href: string
}

interface ProductsIndexProps {
  title: string
  description: string
  viewMode: "list" | "grid"
  searchQuery: string
  filters: {
    product_category: string
    product_model: string
    status: string
  }
  filterOptions: {
    categories: FilterOption[]
    models: FilterOption[]
    statuses: FilterOption[]
  }
  products: ProductCard[]
  pagination: PaginationData
  createHref: string
  exportUrl: string
  importHref: string
  mediaHref: string
}

function ProductRowActions({
  product,
  busy,
  onArchive,
  onUnarchive,
  dense = false,
}: {
  product: ProductCard
  busy: boolean
  onArchive: () => void
  onUnarchive: () => void
  dense?: boolean
}) {
  const archived = product.status === "archived"

  return (
    <RowActions className={dense ? "w-full" : "flex-nowrap"}>
      <Button asChild variant="secondary" size="xs" className={dense ? "min-w-0 flex-1 sm:flex-none" : undefined}>
        <Link href={product.edit_href}>Edit</Link>
      </Button>
      <RowActionsMenu>
        <DropdownMenuItem asChild>
          <Link href={product.variants_href}>Varian</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={product.media_href}>Media</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={product.public_href} target="_blank" rel="noreferrer">
            Lihat di toko
          </a>
        </DropdownMenuItem>
      </RowActionsMenu>
      {archived ? (
        <Button size="xs" disabled={busy} onClick={onUnarchive}>
          Pulihkan
        </Button>
      ) : (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busy}>
              Arsipkan
            </button>
          }
          title="Arsipkan produk?"
          description={`${product.name} tidak akan tampil di katalog publik.`}
          confirmLabel="Arsipkan"
          processing={busy}
          onConfirm={onArchive}
        />
      )}
    </RowActions>
  )
}

function ProductListRow({
  product,
  busyId,
  setBusyId,
}: {
  product: ProductCard
  busyId: number | null
  setBusyId: (id: number | null) => void
}) {
  const busy = busyId === product.id

  function archive() {
    setBusyId(product.id)
    router.post(product.archive_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function unarchive() {
    setBusyId(product.id)
    router.post(product.unarchive_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="min-w-[14rem] px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded bg-muted">
            {product.image ? (
              <img src={product.image} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Icon name="image" className="size-4" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <Link href={product.href} className="line-clamp-2 text-sm font-semibold hover:text-primary">
              {product.name}
            </Link>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{product.parent_sku}</p>
          </div>
        </div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-sm">{product.product_category_label}</td>
      <td className="whitespace-nowrap px-3 py-3 text-sm">{product.product_model_label}</td>
      <td className="px-3 py-3">
        <StatusBadge status={product.status} />
      </td>
      <td className="whitespace-nowrap tabular-nums px-3 py-3 text-sm font-semibold">
        {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
      </td>
      <td className="tabular-nums px-3 py-3 text-sm">{formatNumber(product.stock_total)}</td>
      <td className="tabular-nums px-3 py-3 text-sm">{formatNumber(product.variants_count)}</td>
      <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
        <ProductRowActions
          product={product}
          busy={busy}
          onArchive={archive}
          onUnarchive={unarchive}
        />
      </td>
    </tr>
  )
}

function ProductGridCard({
  product,
  busyId,
  setBusyId,
}: {
  product: ProductCard
  busyId: number | null
  setBusyId: (id: number | null) => void
}) {
  const busy = busyId === product.id

  function archive() {
    setBusyId(product.id)
    router.post(product.archive_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  function unarchive() {
    setBusyId(product.id)
    router.post(product.unarchive_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
  }

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <Link href={product.href} className="block aspect-[4/3] bg-muted">
        {product.image ? (
          <img src={product.image} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Icon name="image" className="size-8" aria-hidden="true" />
          </div>
        )}
      </Link>
      <div className="space-y-3 p-4">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={product.href} className="line-clamp-2 text-sm font-bold hover:text-primary">
              {product.name}
            </Link>
            <StatusBadge status={product.status} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{product.parent_sku}</p>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Kategori</dt>
            <dd className="font-semibold">{product.product_category_label}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="font-semibold">{product.product_model_label}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Harga</dt>
            <dd className="tabular-nums font-semibold">
              {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stok</dt>
            <dd className="tabular-nums font-semibold">{formatNumber(product.stock_total)}</dd>
          </div>
        </dl>
        <div className="border-t border-border pt-3">
          <ProductRowActions
            product={product}
            busy={busy}
            onArchive={archive}
            onUnarchive={unarchive}
            dense
          />
        </div>
      </div>
    </article>
  )
}

export default function ProductsIndex({
  title,
  description,
  viewMode,
  searchQuery,
  filters,
  filterOptions,
  products,
  pagination,
  createHref,
  exportUrl,
  importHref,
  mediaHref,
}: ProductsIndexProps) {
  const [q, setQ] = React.useState(searchQuery)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      view: viewMode,
      q: searchQuery,
      product_category: filters.product_category,
      product_model: filters.product_model,
      status: filters.status,
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "view" && value === "list") return
      if (key === "q" && !value.trim()) return
      next[key] = value
    })
    router.get("/admin/products", next, { preserveState: true, replace: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={exportUrl}>Export CSV</a>
          </Button>
          <Button asChild variant="secondary">
            <Link href={importHref}>Import</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={mediaHref}>Media</Link>
          </Button>
          <Button asChild>
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah Produk
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <section className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <form
            className="min-w-0 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              visit({ q })
            }}
          >
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cari produk
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Nama atau parent SKU"
              />
              <Button type="submit" variant="secondary">
                Cari
              </Button>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Kategori
              </label>
              <Select
                className="mt-1.5"
                value={filters.product_category}
                onChange={(event) => visit({ product_category: event.target.value })}
              >
                {filterOptions.categories.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Model
              </label>
              <Select
                className="mt-1.5"
                value={filters.product_model}
                onChange={(event) => visit({ product_model: event.target.value })}
              >
                {filterOptions.models.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </label>
              <Select
                className="mt-1.5"
                value={filters.status}
                onChange={(event) => visit({ status: event.target.value })}
              >
                {filterOptions.statuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex gap-1 rounded-md border border-border p-1">
            <button
              type="button"
              onClick={() => visit({ view: "list" })}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon name="menu" className="size-3.5" aria-hidden="true" />
              List
            </button>
            <button
              type="button"
              onClick={() => visit({ view: "grid" })}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold",
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon name="layout-grid" className="size-3.5" aria-hidden="true" />
              Grid
            </button>
          </div>
        </div>
      </section>

      {!products.length ? (
        <EmptyState
          className="mt-6"
          title="Belum ada produk"
          description="Tambah produk baru atau impor katalog dari menu Produk → Import."
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={createHref}>Tambah Produk</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={importHref}>Import</Link>
              </Button>
            </div>
          }
        />
      ) : viewMode === "grid" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductGridCard
              key={product.id}
              product={product}
              busyId={busyId}
              setBusyId={setBusyId}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface shadow-sm">
          <table className="w-full min-w-[56rem] text-left">
            <thead className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Produk</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">Model</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Harga</th>
                <th className="px-3 py-3">Stok</th>
                <th className="px-3 py-3">Varian</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductListRow
                  key={product.id}
                  product={product}
                  busyId={busyId}
                  setBusyId={setBusyId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.last_page > 1 ? (
        <div className="mt-6">
          <Pagination pagination={pagination} />
        </div>
      ) : null}
    </AdminLayout>
  )
}
