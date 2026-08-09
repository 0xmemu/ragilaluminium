import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { ResourceValue } from "@/components/admin/resource-value"
import { ResourceContextPanel } from "@/components/admin/resource-context-panel"
import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ResourceIndexProps, ResourceRow, ResourceRowAction } from "@/types"

function rowText(row: ResourceRow): string {
  return Object.values(row)
    .filter((value) => typeof value !== "object")
    .join(" ")
    .toLowerCase()
}

function RowActionButtons({ actions }: { actions: ResourceRowAction[] }) {
  if (!actions.length) return null

  return (
    <RowActions>
      {actions.map((action) => {
        const key = `${action.label}-${action.href ?? action.url}`
        const method = action.method ?? (action.href ? "get" : "post")

        if (method === "get" && action.href) {
          return (
            <Button key={key} asChild variant="secondary" size="xs">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          )
        }

        if (!action.url) return null

        const run = () => {
          if (method === "put") {
            router.put(action.url!, {}, { preserveScroll: true })
            return
          }
          if (method === "delete") {
            router.delete(action.url!, { preserveScroll: true })
            return
          }
          router.post(action.url!, {}, { preserveScroll: true })
        }

        if (action.confirm) {
          return (
            <ConfirmAction
              key={key}
              trigger={
                <button type="button" className={cn(rowActionTextClass, "min-h-8 px-2")}>
                  {action.label}
                </button>
              }
              title={action.confirm}
              description="Tindakan ini akan dijalankan pada record yang dipilih."
              confirmLabel={action.label}
              onConfirm={run}
            />
          )
        }

        return (
          <Button key={key} type="button" variant="secondary" size="xs" onClick={run}>
            {action.label}
          </Button>
        )
      })}
    </RowActions>
  )
}

function MediaBulkAttachPanel({
  assets,
  assetFilters,
  productSearch,
  productOptions,
}: {
  assets: NonNullable<ResourceIndexProps["assetLibrary"]>
  assetFilters: NonNullable<ResourceIndexProps["assetFilters"]>
  productSearch: string
  productOptions: NonNullable<ResourceIndexProps["productOptions"]>
}) {
  const [selectedAssetId, setSelectedAssetId] = React.useState<number | null>(null)
  const [assetQuery, setAssetQuery] = React.useState(assetFilters.q)
  const [assetKind, setAssetKind] = React.useState(assetFilters.kind)
  const [assetStatus, setAssetStatus] = React.useState(assetFilters.status)
  const [productsQuery, setProductsQuery] = React.useState(productSearch)
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) ?? null
  const form = useForm({
    product_ids: [] as number[],
    position: 1,
    show_in_catalog: true,
    is_installation: false,
    is_main_image: false,
    visibility: "visible",
  })

  function searchWith(param: "asset_q" | "product_q", value: string) {
    const params = Object.fromEntries(new URLSearchParams(window.location.search))
    if (value.trim()) params[param] = value.trim()
    else delete params[param]
    router.get(window.location.pathname, params, { preserveState: true, replace: true })
  }

  function searchAssets(event: React.FormEvent) {
    event.preventDefault()
    const params = Object.fromEntries(new URLSearchParams(window.location.search))
    if (assetQuery.trim()) params.asset_q = assetQuery.trim()
    else delete params.asset_q
    if (assetKind) params.asset_kind = assetKind
    else delete params.asset_kind
    if (assetStatus) params.asset_status = assetStatus
    else delete params.asset_status
    router.get(window.location.pathname, params, { preserveState: true, replace: true })
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Media Library</p>
          <h2 className="mt-1 text-xl font-semibold">Pasang satu media ke banyak produk</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Aset fisik tetap satu di R2. Yang dibuat per produk hanya attachment dan pengaturan tampilnya.
          </p>
        </div>
        <form onSubmit={searchAssets} className="flex flex-wrap gap-2 lg:justify-end">
          <Input value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Cari motif atau label" />
          <Select value={assetKind} onChange={(event) => setAssetKind(event.target.value)} aria-label="Jenis aset">
            <option value="">Semua jenis</option>
            <option value="image">Gambar</option>
            <option value="video">Video</option>
          </Select>
          <Select value={assetStatus} onChange={(event) => setAssetStatus(event.target.value)} aria-label="Status aset">
            <option value="">Semua status</option>
            <option value="ready">Siap</option>
            <option value="pending">Menunggu</option>
            <option value="failed">Gagal</option>
          </Select>
          <Button type="submit" variant="secondary">Cari</Button>
        </form>
      </div>

      {assets.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAssetId(asset.id)}
              className={cn("rounded-lg border p-3 text-left transition-colors hover:bg-accent/50", selectedAssetId === asset.id ? "border-primary bg-primary/5" : "border-border")}
            >
              <div className="aspect-[4/3] overflow-hidden rounded-md border border-border bg-muted/30">
                {asset.preview_url && asset.kind === "video" ? (
                  <video src={asset.preview_url} muted preload="metadata" className="h-full w-full object-cover" />
                ) : asset.preview_url ? (
                  <img src={asset.preview_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Belum siap</div>
                )}
              </div>
              <p className="mt-2 truncate text-sm font-semibold">{asset.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{asset.kind} · {asset.status} · Dipakai di {asset.usage_count} produk</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Belum ada aset yang cocok.</p>
      )}

      {selectedAsset ? (
        <form
          className="mt-5 grid gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 lg:grid-cols-[minmax(0,1fr)_16rem]"
          onSubmit={(event) => {
            event.preventDefault()
            form.post(selectedAsset.attach_url, { preserveScroll: true, onSuccess: () => form.reset("product_ids") })
          }}
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Pasang “{selectedAsset.label}”</p>
                <p className="text-xs text-muted-foreground">Pilih satu atau beberapa produk.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedAssetId(null)}>Tutup</Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={productsQuery} onChange={(event) => setProductsQuery(event.target.value)} placeholder="Cari produk atau SKU" />
              <Button type="button" variant="secondary" onClick={() => searchWith("product_q", productsQuery)}>Cari</Button>
            </div>
            <div className="mt-3 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {productOptions.map((product) => (
                <label key={product.id} className="flex items-start gap-2 rounded-md border border-border bg-card p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.data.product_ids.includes(product.id)}
                    onChange={(event) => form.setData("product_ids", event.target.checked ? [...form.data.product_ids, product.id] : form.data.product_ids.filter((id) => id !== product.id))}
                    className="mt-0.5 h-4 w-4 accent-primary"
                  />
                  <span className="leading-5">{product.label}</span>
                </label>
              ))}
            </div>
            {!productOptions.length ? <p className="mt-3 text-xs text-muted-foreground">Produk tidak ditemukan.</p> : null}
          </div>
          <div className="space-y-3">
            <Field id="bulk-position" label="Posisi">
              <Input type="number" min="1" max="109" value={form.data.position} onChange={(event) => form.setData("position", Number(event.target.value))} />
            </Field>
            <Select value={form.data.visibility} onChange={(event) => form.setData("visibility", event.target.value)} aria-label="Visibilitas attachment">
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </Select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.show_in_catalog} onChange={(event) => form.setData("show_in_catalog", event.target.checked)} /> Galeri katalog</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.is_installation} onChange={(event) => form.setData("is_installation", event.target.checked)} /> Hasil pemasangan</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.data.is_main_image} disabled={selectedAsset.kind === "video"} onChange={(event) => form.setData("is_main_image", event.target.checked)} /> Gambar utama</label>
            <Button type="submit" className="w-full" disabled={form.processing || !form.data.product_ids.length}>
              {form.processing ? "Memasang..." : `Pasang ke ${form.data.product_ids.length || "produk"}`}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

export default function ResourceIndex({
  title,
  description,
  createHref,
  toolbarLinks = [],
  columns = [],
  rows = [],
  pagination,
  assetLibrary,
  assetFilters,
  productSearch = "",
  productOptions = [],
}: ResourceIndexProps) {
  const initialQuery =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("q") ?? "" : ""
  const [query, setQuery] = React.useState(initialQuery)
  const statusColumn = columns.find((column) => column.key.includes("status"))
  const [statusFilter, setStatusFilter] = React.useState("")
  const statusOptions = React.useMemo(
    () =>
      statusColumn
        ? Array.from(
            new Set(
              rows
                .map((row) => row[statusColumn.key])
                .filter((value): value is string => typeof value === "string" && value !== ""),
            ),
          )
        : [],
    [rows, statusColumn],
  )
  const showActions = rows.some((row) => Array.isArray(row.actions) && row.actions.length > 0)
  const filteredRows = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesQuery = !normalized || rowText(row).includes(normalized)
      const matchesStatus =
        !statusFilter || !statusColumn || String(row[statusColumn.key]) === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [query, rows, statusColumn, statusFilter])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const params = Object.fromEntries(new URLSearchParams(window.location.search))
    if (query.trim()) params.q = query.trim()
    else delete params.q
    router.get(window.location.pathname, params, { preserveState: true, replace: true })
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {toolbarLinks.map((link) => (
        <Button key={link.href} asChild variant="secondary">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
      {createHref ? (
        <Button asChild>
          <Link href={createHref}>
            <Icon name="plus" className="h-4 w-4" aria-hidden="true" />
            Tambah
          </Link>
        </Button>
      ) : null}
    </div>
  )

  return (
    <AdminLayout
      title={title}
      description={description ?? `${pagination?.total ?? rows.length} record tersedia.`}
      actions={toolbarLinks.length || createHref ? actions : null}
    >
      <Head title={`${title} | Admin`} />

      {assetLibrary && assetFilters ? (
        <MediaBulkAttachPanel
          assets={assetLibrary}
          assetFilters={assetFilters}
          productSearch={productSearch}
          productOptions={productOptions}
        />
      ) : null}

      <ResourceContextPanel rows={rows} />

      <section className="rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <form onSubmit={submitSearch} className="relative flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              data-admin-search
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cari ${title.toLowerCase()} pada halaman ini`}
              className="pl-10"
              aria-label={`Cari ${title}`}
            />
          </form>
          {statusOptions.length > 1 ? (
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="sm:w-52"
              aria-label={`Filter ${statusColumn?.label ?? "status"}`}
            >
              <option value="">Semua {statusColumn?.label.toLowerCase()}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {humanize(status)}
                </option>
              ))}
            </Select>
          ) : null}
          {(query || statusFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery("")
                setStatusFilter("")
              }}
            >
              Reset
            </Button>
          )}
        </div>

        {filteredRows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/70 text-xs text-muted-foreground">
                    {columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap px-4 py-3 font-semibold">
                        {column.label}
                      </th>
                    ))}
                    {showActions ? (
                      <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Aksi</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row, rowIndex) => (
                    <tr key={String(row.href ?? row.id ?? rowIndex)} className="hover:bg-accent/55">
                      {columns.map((column) => {
                        const href = column.hrefKey ? row[column.hrefKey] : null
                        return (
                          <td key={column.key} className="max-w-sm px-4 py-3.5 align-top">
                            {typeof href === "string" && href ? (
                              <Link
                                href={href}
                                className="font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                <ResourceValue
                                  fieldKey={column.key}
                                  value={row[column.key]}
                                  format={column.format}
                                />
                              </Link>
                            ) : (
                              <ResourceValue
                                fieldKey={column.key}
                                value={row[column.key]}
                                format={column.format}
                              />
                            )}
                          </td>
                        )
                      })}
                      {showActions ? (
                        <td className="px-4 py-3.5 align-top">
                          <div className="flex justify-end">
                            <RowActionButtons
                              actions={Array.isArray(row.actions) ? row.actions : []}
                            />
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {filteredRows.map((row, rowIndex) => {
                const primaryColumn = columns[0]
                const primaryHref = primaryColumn?.hrefKey
                  ? row[primaryColumn.hrefKey]
                  : row.href
                return (
                  <article key={String(row.href ?? row.id ?? rowIndex)} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          {primaryColumn?.label}
                        </p>
                        {typeof primaryHref === "string" && primaryHref ? (
                          <Link href={primaryHref} className="mt-1 block font-semibold text-primary">
                            <ResourceValue
                              fieldKey={primaryColumn?.key}
                              value={row[primaryColumn?.key]}
                              format={primaryColumn?.format}
                            />
                          </Link>
                        ) : (
                          <div className="mt-1 font-semibold">
                            <ResourceValue
                              fieldKey={primaryColumn?.key}
                              value={row[primaryColumn?.key]}
                              format={primaryColumn?.format}
                            />
                          </div>
                        )}
                      </div>
                      {typeof primaryHref === "string" && primaryHref ? (
                        <Link
                          href={primaryHref}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-accent"
                          aria-label="Buka detail"
                        >
                          <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                    <dl className="mt-4 grid sm:grid-cols-2 gap-x-4 gap-y-3">
                      {columns.slice(1).map((column) => (
                        <div key={column.key}>
                          <dt className="text-[10px] font-semibold tracking-tight text-muted-foreground">
                            {column.label}
                          </dt>
                          <dd className="mt-1 text-sm">
                            <ResourceValue
                              fieldKey={column.key}
                              value={row[column.key]}
                              format={column.format}
                            />
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {Array.isArray(row.actions) && row.actions.length ? (
                      <div className="mt-4">
                        <RowActionButtons actions={row.actions} />
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState
            className="m-4"
            icon="search"
            title={rows.length ? "Record tidak cocok" : "Belum ada record"}
            description={
              rows.length
                ? "Ubah kata pencarian atau hapus filter halaman."
                : `Data ${title.toLowerCase()} akan tampil di sini setelah tersedia.`
            }
            action={
              rows.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("")
                    setStatusFilter("")
                  }}
                >
                  Hapus filter
                </Button>
              ) : createHref ? (
                <Button asChild>
                  <Link href={createHref}>Tambah record</Link>
                </Button>
              ) : null
            }
          />
        )}
      </section>

      <Pagination pagination={pagination} />
    </AdminLayout>
  )
}
