import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu, rowActionTextClass } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table"
import { Icon } from "@/components/shared/icon"
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
      <Button
        asChild
        variant="secondary"
        size="xs"
        className={dense ? "min-w-0 flex-1 sm:flex-none" : undefined}
      >
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

function useProductActions(setBusyId: (id: number | null) => void) {
  return {
    archive: (product: ProductCard) => {
      setBusyId(product.id)
      router.post(product.archive_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
    },
    unarchive: (product: ProductCard) => {
      setBusyId(product.id)
      router.post(product.unarchive_url, {}, { preserveScroll: true, onFinish: () => setBusyId(null) })
    },
  }
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
  const actions = useProductActions(setBusyId)

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="min-w-[16rem]">
        <div className="flex items-center gap-3">
          <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
            {product.image ? (
              <img src={product.image} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <Icon name="image" className="size-4" aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <Link
              href={product.href}
              className="line-clamp-2 text-[13px] font-medium leading-5 hover:text-primary"
            >
              {product.name}
            </Link>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.parent_sku}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{product.product_category_label}</TableCell>
      <TableCell className="whitespace-nowrap">{product.product_model_label}</TableCell>
      <TableCell>
        <StatusBadge status={product.status} />
      </TableCell>
      <TableCell className="tabular-nums whitespace-nowrap font-semibold">
        {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
      </TableCell>
      <TableCell className="tabular-nums">{formatNumber(product.stock_total)}</TableCell>
      <TableCell className="tabular-nums">{formatNumber(product.variants_count)}</TableCell>
      <TableCell className="w-[1%] whitespace-nowrap text-right">
        <ProductRowActions
          product={product}
          busy={busy}
          onArchive={() => actions.archive(product)}
          onUnarchive={() => actions.unarchive(product)}
        />
      </TableCell>
    </TableRow>
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
  const actions = useProductActions(setBusyId)

  return (
    <Card className="overflow-hidden">
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
            <Link
              href={product.href}
              className="line-clamp-2 text-[13px] font-medium leading-5 hover:text-primary"
            >
              {product.name}
            </Link>
            <StatusBadge status={product.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{product.parent_sku}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Kategori</dt>
            <dd className="mt-0.5 font-medium">{product.product_category_label}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Model</dt>
            <dd className="mt-0.5 font-medium">{product.product_model_label}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Harga</dt>
            <dd className="tabular-nums mt-0.5 font-medium">
              {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Stok</dt>
            <dd className="tabular-nums mt-0.5 font-medium">{formatNumber(product.stock_total)}</dd>
          </div>
        </dl>
        <div className="border-t border-border pt-3">
          <ProductRowActions
            product={product}
            busy={busy}
            onArchive={() => actions.archive(product)}
            onUnarchive={() => actions.unarchive(product)}
            dense
          />
        </div>
      </div>
    </Card>
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
              Tambah produk
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* Toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault()
            visit({ q })
          }}
        >
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Cari nama produk atau parent SKU…"
            className="pl-9"
            aria-label="Cari produk"
          />
        </form>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
          <Select
            value={filters.product_category}
            onChange={(event) => visit({ product_category: event.target.value })}
            className="lg:w-40"
            aria-label="Filter kategori"
          >
            {filterOptions.categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={filters.product_model}
            onChange={(event) => visit({ product_model: event.target.value })}
            className="lg:w-40"
            aria-label="Filter model"
          >
            {filterOptions.models.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select
            value={filters.status}
            onChange={(event) => visit({ status: event.target.value })}
            className="lg:w-36"
            aria-label="Filter status"
          >
            {filterOptions.statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-0.5 self-start rounded-lg border border-border bg-muted/70 p-1 lg:self-auto">
          {(
            [
              { key: "list", label: "List", icon: "menu" },
              { key: "grid", label: "Grid", icon: "layout-grid" },
            ] as const
          ).map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => visit({ view: mode.key })}
              aria-pressed={viewMode === mode.key}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
                viewMode === mode.key
                  ? "bg-surface text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon name={mode.icon} className="size-3.5" aria-hidden="true" />
              {mode.label}
            </button>
          ))}
        </div>
      </div>


      {/* Konten */}
      {!products.length ? (
        <EmptyState
          className="mt-5"
          title="Belum ada produk"
          description="Tambah produk baru atau impor katalog dari menu Produk → Import."
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href={createHref}>Tambah produk</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href={importHref}>Import</Link>
              </Button>
            </div>
          }
        />
      ) : viewMode === "grid" ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
        <Card className="mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[56rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Varian</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <ProductListRow
                    key={product.id}
                    product={product}
                    busyId={busyId}
                    setBusyId={setBusyId}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {pagination.last_page > 1 ? <Pagination pagination={pagination} /> : null}
    </AdminLayout>
  )
}

