import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu, rowActionTextClass } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { EmptyState } from "@/components/admin/ui/empty-state"
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
import { ManageProductsTabs } from "@/components/admin/manage-products-tabs"
import { formatCurrency, formatNumber, humanize } from "@/lib/format"
import { cn } from "@/lib/utils"
import { can, useAdminCapabilities } from "@/lib/capabilities"
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
  sold_count: number
  image?: string | null
  updated_at: string | null
  href: string
  edit_href: string
  variants_href: string
  media_href: string
  archive_url: string
  unarchive_url: string
  duplicate_url: string
  destroy_url?: string
  public_href: string
}

interface ProductsIndexProps {
  title: string
  description: string
  searchQuery: string
  activeSort: string
  filters: {
    product_category: string
    product_model: string
    status: string
  }
  filterOptions: {
    categories: FilterOption[]
    models: FilterOption[]
    statuses: FilterOption[]
    sorts: FilterOption[]
  }
  products: ProductCard[]
  pagination: PaginationData
  createHref: string
  exportUrl: string
  importHref: string
  importPerformanceHref: string
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

        {archived && product.destroy_url ? (
          <ConfirmAction
            trigger={
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              >
                Hapus Permanen
              </button>
            }
            title="Hapus permanen produk?"
            description={`Produk "${product.name}" yang belum pernah memiliki pesanan akan dihapus permanen dari database. Aksi ini tidak dapat dibatalkan.`}
            confirmLabel="Hapus Permanen"
            onConfirm={() => {
              router.delete(product.destroy_url!, {
                preserveScroll: true,
              })
            }}
          />
        ) : null}
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
              className="line-clamp-2 text-[13px] font-normal leading-5 text-foreground hover:text-primary"
            >
              {product.name}
            </Link>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{product.parent_sku}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{product.product_category_label}</TableCell>
      <TableCell className="whitespace-nowrap">{product.product_model_label}</TableCell>
      <TableCell className="whitespace-nowrap">{product.design_variant_label || "-"}</TableCell>
      <TableCell>
        <StatusBadge status={product.status} />
      </TableCell>
      <TableCell className="tabular-nums whitespace-nowrap font-semibold">
        {product.min_price !== null ? formatCurrency(product.min_price) : "-"}
      </TableCell>
      <TableCell className="tabular-nums">{formatNumber(product.stock_total)}</TableCell>
      <TableCell className="tabular-nums">{formatNumber(product.variants_count)}</TableCell>
      <TableCell className="tabular-nums">{formatNumber(product.sold_count)}</TableCell>
      <TableCell className="sticky right-0 z-10 w-[1%] whitespace-nowrap bg-background text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">
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


/** Harus sama dengan ProductController::DEFAULT_SORT di sisi server. */
const DEFAULT_SORT = "updated_desc"

export default function ProductsIndex({
  title,
  description,
  searchQuery,
  activeSort,
  filters,
  filterOptions,
  products,
  pagination,
  createHref,
  exportUrl,
  importHref,
  importPerformanceHref: _importPerformanceHref,
  mediaHref,
}: ProductsIndexProps) {
  const [q, setQ] = React.useState(searchQuery)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const capabilities = useAdminCapabilities()
  const canManage = can("products.manage", capabilities)

  const activeFilters = React.useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = []
    if (filters.product_category && filters.product_category !== "all") {
      const option = filterOptions.categories.find((o) => o.value === filters.product_category)
      chips.push({ label: `Kategori: ${option?.label ?? filters.product_category}`, clear: () => visit({ product_category: "all" }) })
    }
    if (filters.product_model && filters.product_model !== "all") {
      const option = filterOptions.models.find((o) => o.value === filters.product_model)
      chips.push({ label: `Model: ${option?.label ?? filters.product_model}`, clear: () => visit({ product_model: "all" }) })
    }
    if (filters.status && filters.status !== "all") {
      const option = filterOptions.statuses.find((o) => o.value === filters.status)
      chips.push({ label: `Status: ${option?.label ?? humanize(filters.status)}`, clear: () => visit({ status: "all" }) })
    }
    if (searchQuery?.trim()) {
      chips.push({ label: `Cari: ${searchQuery}`, clear: () => visit({ q: "" }) })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.product_category, filters.product_model, filters.status, searchQuery])

  const hasActiveFilters = activeFilters.length > 0

  function resetAllFilters() {
    router.get("/admin/kelola/produk", {}, { preserveState: false, preserveScroll: true })
  }

  function visit(params: Record<string, string | undefined>) {
    const next: Record<string, string> = {}
    const merged = {
      q: searchQuery,
      product_category: filters.product_category,
      product_model: filters.product_model,
      status: filters.status,
      sort: activeSort,
      ...params,
    }
    Object.entries(merged).forEach(([key, value]) => {
      if (!value || value === "all") return
      if (key === "q" && !value.trim()) return
      // Urutan default tidak ditulis ke URL supaya tautan tetap bersih.
      if (key === "sort" && value === DEFAULT_SORT) return
      next[key] = value
    })
    router.get("/admin/kelola/produk", next, { preserveState: true, replace: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => router.reload()}
            className="inline-flex items-center gap-1.5"
          >
            <Icon name="refresh" className="size-3.5" aria-hidden="true" />
            <span>Refresh data</span>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={exportUrl}>Ekspor Produk ke Excel</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href={mediaHref}>Media Library</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah produk
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <ManageProductsTabs active="products" />

      {/* Pencarian dan filter kategori/model/status */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => visit({ q }),
          placeholder: "Cari nama produk atau parent SKU…",
        }}
        sort={
          <Select
            value={activeSort}
            onChange={(event) => visit({ sort: event.target.value })}
            className="w-auto"
            aria-label="Urutan daftar produk"
          >
            {filterOptions.sorts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        }
        summary={
          <span>
            <span className="tabular-nums font-semibold text-foreground">
              {formatNumber(pagination.total)}
            </span>{" "}
            produk
          </span>
        }
        className="mb-4"
      >
        <Select
          className="flex-1 min-w-0"
          value={filters.product_category}
          onChange={(event) => visit({ product_category: event.target.value })}
          aria-label="Filter kategori"
        >
          {filterOptions.categories.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          className="flex-1 min-w-0"
          value={filters.product_model}
          onChange={(event) => visit({ product_model: event.target.value })}
          aria-label="Filter model"
        >
          {filterOptions.models.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          className="flex-1 min-w-0"
          value={filters.status}
          onChange={(event) => visit({ status: event.target.value })}
          aria-label="Filter status"
        >
          {filterOptions.statuses.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ListToolbar>

      {/* Konten */}
      {activeFilters.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Filter aktif
          </span>
          {activeFilters.map((filter) => (
            <span
              key={filter.label}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground"
            >
              {filter.label}
              <button
                type="button"
                onClick={filter.clear}
                className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label={`Hapus filter ${filter.label}`}
              >
                <Icon name="x" className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetAllFilters}
              className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground transition hover:bg-muted"
            >
              Reset Filter
            </button>
          ) : null}
        </div>
      ) : null}

      {!products.length ? (
        hasActiveFilters ? (
          <EmptyState
            className="mt-4"
            icon="package"
            title="Tidak ada produk yang cocok"
            description="Coba ubah atau hapus filter untuk melihat produk lain."
            action={
              <Button variant="outline" size="sm" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="mt-4"
            title="Belum ada produk"
            description="Tambah produk baru atau impor katalog dari menu Produk → Import."
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild disabled={!canManage}>
                  <Link href={createHref}>Tambah produk</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href={importHref}>Import</Link>
                </Button>
              </div>
            }
          />
        )
      ) : (
        <div className="mt-4">
          <div className="overflow-x-auto">
            <Table className="min-w-[68rem]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Sub Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Stok</TableHead>
                  <TableHead>Varian</TableHead>
                  <TableHead>Terjual</TableHead>
                  <TableHead className="sticky right-0 z-10 bg-background text-right shadow-[-8px_0_12px_-12px_rgba(0,0,0,0.35)]">Aksi</TableHead>
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
        </div>
      )}

      {pagination.last_page > 1 ? <Pagination pagination={pagination} /> : null}
    </AdminLayout>
  )
}

