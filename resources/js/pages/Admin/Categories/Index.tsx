import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/components/admin/ui/table"
import { ManageProductsTabs } from "@/components/admin/manage-products-tabs"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { navigateFilter } from "@/lib/filter-url"

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

interface FilterOption {
  value: string
  label: string
}

interface Props {
  title: string
  description: string
  categories: Category[]
  filters: {
    q: string
    status: string
  }
  statusOptions: FilterOption[]
  createUrl?: string
  backUrl?: string
}

export default function CategoriesIndex({
  title,
  description,
  categories,
  filters,
  statusOptions,
  createUrl = routeUrl("admin.categories.create"),
  backUrl,
}: Props) {
  const [busy, setBusy] = React.useState<number | null>(null)
  const [q, setQ] = React.useState(filters?.q ?? "")

  function visit(params: Record<string, string | undefined>) {
    navigateFilter(
      "admin.categories.index",
      { q: filters?.q ?? "", status: filters?.status ?? "all" },
      params,
    )
  }

  const activeFilters = React.useMemo(() => {
    const chips: Array<{ label: string; clear: () => void }> = []
    if (filters?.status && filters.status !== "all") {
      const option = statusOptions.find((o) => o.value === filters.status)
      chips.push({
        label: `Status: ${option?.label ?? filters.status}`,
        clear: () => visit({ status: "all" }),
      })
    }
    if (filters?.q?.trim()) {
      chips.push({
        label: `Cari: ${filters.q}`,
        clear: () => visit({ q: "" }),
      })
    }
    return chips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.status, filters?.q, statusOptions])

  function resetAllFilters() {
    router.get(routeUrl("admin.categories.index"), {}, { preserveState: false, preserveScroll: true })
  }

  const addButton = (
    <Button asChild size="sm">
      <Link href={createUrl}>
        <Icon name="plus" className="size-4" aria-hidden="true" />
        Tambah
      </Link>
    </Button>
  )

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={addButton}
    >
      <Head title={`${title} | Admin`} />
      <ManageProductsTabs active="categories" />

      {/* Pencarian dan filter status */}
      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => visit({ q }),
          placeholder: "Cari nama atau kode kategori…",
        }}
        summary={
          <span>
            <span className="tabular-nums font-semibold text-foreground">
              {formatNumber(categories.length)}
            </span>{" "}
            kategori
          </span>
        }
        className="mb-4"
      >
        <Select
          className="w-40"
          value={filters?.status ?? "all"}
          onChange={(event) => visit({ status: event.target.value })}
          aria-label="Filter status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </ListToolbar>

      {/* Filter aktif chips */}
      {activeFilters.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          <span className="text-[11px] font-medium text-muted-foreground">
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
                className="inline-flex size-3.5 items-center justify-center rounded-full hover:bg-foreground/10"
                aria-label={`Hapus filter ${filter.label}`}
              >
                <Icon name="x" className="size-2.5" aria-hidden="true" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetAllFilters}
            className="ml-1 text-xs font-medium text-muted-foreground underline hover:text-foreground"
          >
            Hapus semua filter
          </button>
        </div>
      ) : null}

      <Card className="overflow-hidden border border-border bg-card">
        {categories.length === 0 ? (
          <EmptyState
            className="p-8"
            icon="tags"
            title="Belum ada kategori"
            description={
              activeFilters.length
                ? "Tidak ada kategori yang cocok dengan filter yang dipilih."
                : "Kategori produk utama toko akan tampil di tabel ini."
            }
            action={!activeFilters.length ? addButton : undefined}
          />
        ) : (
          <TableScroll>
            <Table>
              <TableHeader className="bg-surface/80">
                <TableRow className="border-b border-border text-[11px] font-semibold text-muted-foreground">
                  <TableHead>Nama Kategori</TableHead>
                  <TableHead className="text-center">Kode</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Produk Terkait</TableHead>
                  <TableHead className="text-center">Urutan</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="space-y-0.5">
                        <Link
                          href={c.editUrl}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">/products/{c.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-xs font-semibold text-foreground">{c.code}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={c.is_active ? "active" : "inactive"} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-xs font-medium text-foreground">
                        {c.products_count} produk
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-xs text-muted-foreground">{c.sort_order}</span>
                    </TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap text-right">
                      <RowActions>
                        <Button asChild variant="secondary" size="xs">
                          <Link href={c.editUrl}>Edit</Link>
                        </Button>
                        <RowActionsMenu>
                          <ConfirmAction
                            trigger={
                              <button
                                type="button"
                                className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                                disabled={busy === c.id}
                              >
                                Hapus
                              </button>
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
                        </RowActionsMenu>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </Card>
    </AdminLayout>
  )
}
