import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, rowActionTextClass } from "@/components/admin/row-actions"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { EmptyState } from "@/components/ui/empty-state"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Select } from "@/components/ui/select"
import { StatusBadge } from "@/components/ui/status-badge"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface TabItem {
  key: string
  label: string
  href: string
}

interface WebsiteRow {
  id: number
  no: number
  customer_name: string
  message: string
  rating?: number | null
  source: string
  location?: string | null
  product?: string | null
  image_url?: string | null
  published: boolean
  created_at?: string | null
  edit_href: string
  publish_url: string
  unpublish_url: string
}

interface FotoRow {
  id: number | string
  no: number
  label: string
  image_url: string
  published: boolean
  sort_order: number
  created_at?: string | null
  source?: "import" | "manual"
  readonly?: boolean
  edit_href: string
  publish_url?: string | null
  unpublish_url?: string | null
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function RatingStars({ rating }: { rating?: number | null }) {
  if (!rating) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-warning-foreground" aria-label={`${rating} dari 5 bintang`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Icon
          key={index}
          name="star"
          className={cn("size-3.5", index < rating ? "fill-current" : "opacity-25")}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

function PublishActions({
  published,
  editHref,
  publishUrl,
  unpublishUrl,
  busy,
  onBusy,
  kind,
  readonly = false,
}: {
  published: boolean
  editHref: string
  publishUrl?: string | null
  unpublishUrl?: string | null
  busy: boolean
  onBusy: (value: boolean) => void
  kind: string
  readonly?: boolean
}) {
  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={editHref}>{readonly ? "Kelola media" : "Edit"}</Link>
      </Button>
      {readonly ? null : published ? (
        <ConfirmAction
          trigger={
            <button type="button" className={cn(rowActionTextClass, "text-destructive")} disabled={busy}>
              Sembunyikan
            </button>
          }
          title={`Sembunyikan ${kind}?`}
          description="Item tidak akan tampil di storefront."
          confirmLabel="Sembunyikan"
          processing={busy}
          onConfirm={() => {
            if (!unpublishUrl) return
            onBusy(true)
            router.post(unpublishUrl, {}, { preserveScroll: true, onFinish: () => onBusy(false) })
          }}
        />
      ) : (
        <Button
          size="xs"
          disabled={busy || !publishUrl}
          onClick={() => {
            if (!publishUrl) return
            onBusy(true)
            router.post(publishUrl, {}, { preserveScroll: true, onFinish: () => onBusy(false) })
          }}
        >
          Publikasikan
        </Button>
      )}
    </RowActions>
  )
}

export default function TestimonialsIndex({
  title,
  description,
  tab,
  tabs,
  filters,
  sortOptions,
  publishedOptions,
  createHref,
  createLabel,
  rows = [],
  importedRows = [],
  pagination,
  indexRoute = "admin.testimonials.index",
  pageMeta = null,
  metaUrl = null,
  metaHint = null,
  previewUrl = null,
}: {
  title: string
  description: string
  tab: "website" | "foto"
  tabs: TabItem[]
  filters: { q: string; sort: string; published: string }
  sortOptions: Array<{ value: string; label: string }>
  publishedOptions: Array<{ value: string; label: string }>
  createHref: string
  createLabel: string
  rows: Array<WebsiteRow | FotoRow>
  importedRows?: FotoRow[]
  pagination: PaginationData | null
  indexRoute?: string
  pageMeta?: { title: string; heading: string; subtitle: string; published: boolean } | null
  metaUrl?: string | null
  metaHint?: string | null
  previewUrl?: string | null
}) {
  const [q, setQ] = React.useState(filters.q)
  const [sort, setSort] = React.useState(filters.sort)
  const [published, setPublished] = React.useState(filters.published)
  const [busyId, setBusyId] = React.useState<number | string | null>(null)
  const isPengaturanSurface =
    indexRoute === "admin.apa-kata-pelanggan.index" || indexRoute === "admin.hasil-pemasangan.index"
  const metaForm = useForm({
    title: pageMeta?.title ?? "",
    heading: pageMeta?.heading ?? "",
    subtitle: pageMeta?.subtitle ?? "",
    published: pageMeta?.published ?? true,
  })

  React.useEffect(() => {
    if (!pageMeta) return
    metaForm.setData({
      title: pageMeta.title,
      heading: pageMeta.heading,
      subtitle: pageMeta.subtitle,
      published: pageMeta.published,
    })
  }, [pageMeta])

  function apply(next?: Partial<{ q: string; sort: string; published: string }>) {
    const params: Record<string, string> = {
      q: next?.q ?? q,
      sort: next?.sort ?? sort,
      published: next?.published ?? published,
    }
    if (!isPengaturanSurface) {
      params.tab = tab
    }
    router.get(routeUrl(indexRoute), params, { preserveState: true, preserveScroll: true })
  }

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
          <Button asChild>
            <Link href={createHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              {createLabel}
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {pageMeta && metaUrl ? (
        <section className="mb-6 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-6">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">
            {metaHint ?? "Meta halaman"}
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              metaForm.put(metaUrl)
            }}
          >
            <Field id="apk-title" label="Judul CMS">
              <Input value={metaForm.data.title} onChange={(event) => metaForm.setData("title", event.target.value)} />
            </Field>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold sm:pt-7">
              <input
                type="checkbox"
                checked={metaForm.data.published}
                onChange={(event) => metaForm.setData("published", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Terbitkan halaman
            </label>
            <Field id="apk-heading" label="Judul hero" className="sm:col-span-2">
              <Input value={metaForm.data.heading} onChange={(event) => metaForm.setData("heading", event.target.value)} />
            </Field>
            <Field id="apk-subtitle" label="Subjudul" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={metaForm.data.subtitle}
                onChange={(event) => metaForm.setData("subtitle", event.target.value)}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={metaForm.processing}>
                {metaForm.processing ? "Menyimpan..." : "Simpan meta"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
          {tabs.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === item.key ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ q })
        }}
      >
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={tab === "website" ? "Cari nama, komentar, atau sumber" : "Cari label atau URL foto"}
          className="min-w-[16rem] flex-1"
        />
        <Select
          value={published}
          onChange={(event) => {
            const value = event.target.value
            setPublished(value)
            apply({ published: value })
          }}
          className="w-40"
        >
          {publishedOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(event) => {
            const value = event.target.value
            setSort(value)
            apply({ sort: value })
          }}
          className="w-44"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button type="submit">Cari</Button>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        {(tab === "website" ? rows.length > 0 : rows.length + importedRows.length > 0) ? (
          <div className="overflow-x-auto">
            {tab === "website" ? (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Pelanggan</th>
                    <th className="px-3 py-3 font-semibold">Rating</th>
                    <th className="px-3 py-3 font-semibold">Komentar</th>
                    <th className="px-3 py-3 font-semibold">Foto</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(rows as WebsiteRow[]).map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                      <td className="px-3 py-3">
                        <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                          {row.customer_name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {humanize(row.source)}
                          {row.location ? ` · ${row.location}` : ""}
                        </p>
                        {row.product ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{row.product}</p>
                        ) : (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">Ulasan umum</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <RatingStars rating={row.rating} />
                      </td>
                      <td className="max-w-[18rem] px-3 py-3 text-muted-foreground">
                        <p className="line-clamp-3">{row.message}</p>
                      </td>
                      <td className="px-3 py-3">
                        {row.image_url ? (
                          <img
                            src={row.image_url}
                            alt=""
                            className="size-12 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.published ? "active" : "inactive"}
                          label={row.published ? "Published" : "Draft"}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                      <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                        <PublishActions
                          published={row.published}
                          editHref={row.edit_href}
                          publishUrl={row.publish_url}
                          unpublishUrl={row.unpublish_url}
                          busy={busyId === row.id}
                          onBusy={(value) => setBusyId(value ? row.id : null)}
                          kind="ulasan"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Foto</th>
                    <th className="px-3 py-3 font-semibold">Label</th>
                    <th className="px-3 py-3 font-semibold">Sumber</th>
                    <th className="px-3 py-3 font-semibold">Urutan</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...importedRows, ...(rows as FotoRow[])].map((row) => (
                    <tr key={row.id} className="border-t border-border align-top">
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                      <td className="px-3 py-3">
                        {row.image_url ? (
                          <img
                            src={row.image_url}
                            alt=""
                            className="h-16 w-24 rounded-md border border-border object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                          {row.label}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.source === "import" ? "Import produk" : "Manual"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.sort_order}</td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.published ? "active" : "inactive"}
                          label={row.published ? "Published" : "Draft"}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                      <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                        <PublishActions
                          published={row.published}
                          editHref={row.edit_href}
                          publishUrl={row.publish_url}
                          unpublishUrl={row.unpublish_url}
                          busy={busyId === row.id}
                          onBusy={(value) => setBusyId(value ? row.id : null)}
                          kind="foto"
                          readonly={Boolean(row.readonly)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <EmptyState
            title={tab === "website" ? "Belum ada ulasan website" : "Belum ada ulasan foto"}
            description={
              tab === "website"
                ? "Tambahkan ulasan manual dari Shopee, WhatsApp, atau website."
                : "Tambahkan foto hasil pemasangan untuk halaman /reviews."
            }
            className="border-0"
          />
        )}
        {pagination ? (
          <div className="border-t border-border px-4 py-3">
            <Pagination pagination={pagination} />
          </div>
        ) : null}
      </section>
    </AdminLayout>
  )
}
