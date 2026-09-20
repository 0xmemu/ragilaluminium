import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { humanize } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
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
  message?: string | null
  rating?: number | null
  source: string
  source_label?: string
  source_url?: string | null
  location?: string | null
  product?: string | null
  image_url?: string | null
  sort_order?: number
  published: boolean
  created_at?: string | null
  edit_href: string
  publish_url: string
  unpublish_url: string
  /** Balasan admin atas ulasan (owner 2026-09-18). */
  admin_reply?: string | null
  admin_replied_at?: string | null
  has_reply?: boolean
  /** Kartu marketplace murni screenshot, tidak punya teks untuk dibalas. */
  can_reply?: boolean
  reply_url?: string
  destroy_reply_url?: string
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
  media_asset_id?: number | null
  attach_url?: string | null
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
  if (!rating) return <span className="text-muted-foreground">-</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${rating} dari 5 bintang`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Icon
          key={index}
          name="star"
          weight="fill"
          className={cn("size-3.5", index < rating ? "text-warning" : "text-muted/30")}
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
  canReply = false,
  hasReply = false,
  onReply,
}: {
  published: boolean
  editHref: string
  publishUrl?: string | null
  unpublishUrl?: string | null
  busy: boolean
  onBusy: (value: boolean) => void
  kind: string
  readonly?: boolean
  /** Buka dialog balasan; hanya untuk ulasan website yang punya teks. */
  canReply?: boolean
  hasReply?: boolean
  onReply?: () => void
}) {
  const showMenu = (!readonly && (published || publishUrl)) || canReply

  return (
    <RowActions>
      <Button asChild variant="secondary" size="xs">
        <Link href={editHref}>{readonly ? "Kelola media" : "Edit"}</Link>
      </Button>
      {showMenu ? (
        <RowActionsMenu>
          {canReply && onReply ? (
            <DropdownMenuItem asChild>
              <button type="button" className="w-full text-left" onClick={onReply}>
                {hasReply ? "Edit balasan" : "Balas ulasan"}
              </button>
            </DropdownMenuItem>
          ) : null}
          {!readonly && (published || publishUrl) ? (
            published ? (
              <ConfirmAction
                trigger={
                  <button
                    type="button"
                    className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                    disabled={busy}
                  >
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
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  className="w-full text-left"
                  disabled={busy || !publishUrl}
                  onClick={() => {
                    if (!publishUrl) return
                    onBusy(true)
                    router.post(publishUrl, {}, { preserveScroll: true, onFinish: () => onBusy(false) })
                  }}
                >
                  Publikasikan
                </button>
              </DropdownMenuItem>
            )
          ) : null}
        </RowActionsMenu>
      ) : null}
    </RowActions>
  )
}

/**
 * Dialog balasan admin atas ulasan pelanggan (owner 2026-09-18).
 *
 * Dikontrol dari state halaman (bukan DialogTrigger per baris) supaya hanya ada
 * satu dialog terpasang meski daftar berisi 20 baris. Pola submit meniru
 * AttachProductsDialog: useForm + router, footer tombol onClick.
 */
function ReplyDialog({
  row,
  onClose,
}: {
  row: WebsiteRow | null
  onClose: () => void
}) {
  const form = useForm({ admin_reply: row?.admin_reply ?? "" })

  React.useEffect(() => {
    form.setData("admin_reply", row?.admin_reply ?? "")
    form.clearErrors()
    // Sinkronkan teks saat admin membuka ulasan lain; `form` facade baru tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id, row?.admin_reply])

  const busy = form.processing

  return (
    <Dialog open={Boolean(row)} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-lg bg-card text-card-foreground">
        <DialogTitle>Balas ulasan pelanggan</DialogTitle>
        <DialogDescription>
          Balasan tampil di website tepat di bawah ulasan pelanggan. Teks asli pelanggan tidak diubah.
        </DialogDescription>

        {row ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-semibold text-foreground">
                {row.customer_name}
                {row.rating ? ` · ${row.rating} dari 5 bintang` : ""}
              </p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {row.message?.trim() || "(tanpa teks)"}
              </p>
            </div>

            <Field
              id={`admin-reply-${row.id}`}
              label="Balasan toko"
              error={form.errors.admin_reply}
              hint="Maksimal 1000 karakter. Contoh: Terima kasih Kak, senang produknya cocok."
            >
              <Textarea
                id={`admin-reply-${row.id}`}
                rows={5}
                value={form.data.admin_reply}
                maxLength={1000}
                onChange={(event) => form.setData("admin_reply", event.target.value)}
                placeholder="Tulis balasan untuk pelanggan"
              />
            </Field>

            <div className="flex items-center justify-between gap-2">
              {row.has_reply && row.destroy_reply_url ? (
                <ConfirmAction
                  trigger={
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={busy}>
                      Hapus balasan
                    </Button>
                  }
                  title="Hapus balasan ulasan?"
                  description="Balasan dihapus dari website. Ulasan pelanggan tetap tampil."
                  confirmLabel="Hapus balasan"
                  processing={busy}
                  onConfirm={() => {
                    router.delete(row.destroy_reply_url!, {
                      preserveScroll: true,
                      onSuccess: onClose,
                    })
                  }}
                />
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || form.data.admin_reply.trim().length < 2}
                  onClick={() => {
                    form.post(row.reply_url!, { preserveScroll: true, onSuccess: onClose })
                  }}
                >
                  {busy ? "Menyimpan..." : "Simpan balasan"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AttachProductsDialog({ row }: { row: FotoRow }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<Array<{ id: number; label: string }>>([])
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [verified, setVerified] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const attachForm = useForm({
    product_ids: [] as number[],
    position: Math.max(1, row.sort_order || 1),
    show_in_catalog: false,
    is_installation: true,
    is_main_image: false,
    visibility: "visible",
  })

  React.useEffect(() => {
    if (!open) return
    const term = query.trim()
    if (!term) {
      // Clear stale search results when the dialog query is emptied.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      void fetch(`${routeUrl("admin.media.products.search")}?q=${encodeURIComponent(term)}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
        .then((body: { products?: Array<{ id: number; label: string }> }) => setResults(body.products ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, query])

  function close() {
    setOpen(false)
    setQuery("")
    setResults([])
    setSelectedIds([])
    setVerified(false)
    attachForm.clearErrors()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button type="button" size="xs" variant="secondary">
          Pasang ke produk lain
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogTitle>Verifikasi dan pasang ke produk lain</DialogTitle>
        <DialogDescription>
          Media ini tetap satu asset, tetapi dapat dipakai sebagai hasil pemasangan di beberapa produk.
          Pastikan kecocokan foto sebelum mengonfirmasi.
        </DialogDescription>
        <div className="space-y-4">
          <Field id={`installation-product-search-${row.id}`} label="Cari produk tujuan">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nama produk atau SKU"
              autoComplete="off"
            />
          </Field>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
            {searching ? (
              <p className="p-3 text-sm text-muted-foreground">Mencari produk...</p>
            ) : results.length ? (
              results.map((product) => (
                <label key={product.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(product.id)}
                    onChange={() => setSelectedIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])}
                    className="size-4 accent-primary"
                  />
                  <span className="text-sm">{product.label}</span>
                </label>
              ))
            ) : (
              <p className="p-3 text-sm text-muted-foreground">Ketik minimal sebagian nama atau SKU produk.</p>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>Saya sudah memverifikasi bahwa foto ini benar-benar relevan untuk semua produk yang dipilih.</span>
          </label>
          {attachForm.errors.product_ids ? <p className="text-xs text-destructive">{attachForm.errors.product_ids}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>Batal</Button>
            <Button
              type="button"
              disabled={!verified || selectedIds.length === 0 || attachForm.processing}
              onClick={() => {
                attachForm.transform((data) => ({ ...data, product_ids: selectedIds }))
                attachForm.post(row.attach_url!, { preserveScroll: true, onSuccess: close })
              }}
            >
              {attachForm.processing ? "Memasang..." : `Pasang ke ${selectedIds.length || "produk"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function TestimonialsIndex({
  title,
  description,
  tab,
  tabs,
  filters,
  channelOptions = [],
  sortOptions,
  publishedOptions,
  createHref,
  createLabel,
  adminReviewHref = null,
  rows = [],
  importedRows = [],
  pagination,
  indexRoute = "admin.testimonials.index",
  pageMeta: _pageMeta = null,
  metaUrl: _metaUrl = null,
  metaHint: _metaHint = null,
  previewUrl = null,
  reorderUrl = null,
  canReorder = false,
  sourceLabels = {},
  replyOptions = [],
}: {
  title: string
  description: string
  tab: "website" | "foto" | "eksternal"
  tabs: TabItem[]
  filters: { q: string; sort: string; published: string; channel?: string; reply?: string }
  channelOptions?: Array<{ value: string; label: string }>
  sortOptions: Array<{ value: string; label: string }>
  publishedOptions: Array<{ value: string; label: string }>
  createHref: string
  createLabel: string
  adminReviewHref?: string | null
  rows: Array<WebsiteRow | FotoRow>
  importedRows?: FotoRow[]
  pagination: PaginationData | null
  indexRoute?: string
  pageMeta?: { title: string; heading: string; subtitle: string; published: boolean } | null
  metaUrl?: string | null
  metaHint?: string | null
  previewUrl?: string | null
  reorderUrl?: string | null
  canReorder?: boolean
  sourceLabels?: Record<string, string>
  replyOptions?: Array<{ value: string; label: string }>
}) {
  const [q, setQ] = React.useState(filters.q)
  const [sort, setSort] = React.useState(filters.sort)
  const [published, setPublished] = React.useState(filters.published)
  const [channel, setChannel] = React.useState(filters.channel ?? "all")
  const [reply, setReply] = React.useState(filters.reply ?? "all")
  const [replyTarget, setReplyTarget] = React.useState<WebsiteRow | null>(null)
  const [busyId, setBusyId] = React.useState<number | string | null>(null)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [orderedRows, setOrderedRows] = React.useState<WebsiteRow[]>(
    tab === "website" || tab === "eksternal" ? (rows as WebsiteRow[]) : [],
  )
  const isPengaturanSurface =
    indexRoute === "admin.apa-kata-pelanggan.index" || indexRoute === "admin.hasil-pemasangan.index"
  const isApaKata = indexRoute === "admin.apa-kata-pelanggan.index" || tab === "eksternal"
  // Tabel testimoni (Pelanggan/Sumber/Screenshot) dipakai tab website dan eksternal;
  // tabel galeri (Label/Sumber) hanya untuk surface foto hasil pemasangan.
  const isTestimonialTable = tab === "website" || tab === "eksternal"

  const reorderForm = useForm({
    rows: (rows as WebsiteRow[]).map((row, index) => ({
      id: row.id,
      sort_order: row.sort_order ?? index,
    })),
  })



  React.useEffect(() => {
    if (tab !== "website" && tab !== "eksternal") return
    const next = rows as WebsiteRow[]
    // Keep the reorder editor aligned with the active website testimonial tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedRows(next)
    // Data dan defaults dipindah bersama: `isDirty` membandingkan data dengan
    // defaults, jadi keduanya harus berisi snapshot server yang sama.
    reorderForm.setData({
      rows: next.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    reorderForm.setDefaults({
      rows: next.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    // Mode urut tidak direset di sini: menyalakan mode urut membersihkan
    // pencarian dan itu memuat ulang rows, sehingga mode urut akan langsung
    // mati sendiri. Reset terjadi lewat onSuccess simpan dan tombol Urungkan.
    // `useForm` returns a new facade on every render; rows define the editor snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  function apply(next?: Partial<{ q: string; sort: string; published: string; channel: string; reply: string }>) {
    const params: Record<string, string> = {
      q: next?.q ?? q,
      published: next?.published ?? published,
    }
    if (next?.reply !== undefined || reply !== "all") {
      params.reply = next?.reply ?? reply
    }
    if (sortOptions.length > 0) {
      params.sort = next?.sort ?? sort
    }
    if (tab === "website" && (channelOptions?.length ?? 0) > 0) {
      params.channel = next?.channel ?? channel
    }
    if (!isPengaturanSurface) {
      params.tab = tab
    }
    router.get(routeUrl(indexRoute), params, { preserveState: true, preserveScroll: true })
  }

  const hasActiveFilters =
    Boolean(q?.trim()) || (published && published !== "all") || (reply && reply !== "all")

  function resetAllFilters() {
    router.get(routeUrl(indexRoute), {}, { preserveState: false, preserveScroll: true })
  }

  function reorderRows(from: number, to: number) {
    if (from === to) return
    const next = [...orderedRows]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    const numbered = next.map((row, i) => ({ ...row, no: i + 1, sort_order: i }))
    setOrderedRows(numbered)
    reorderForm.setData(
      "rows",
      numbered.map((row, i) => ({ id: row.id, sort_order: i })),
    )
  }

  function saveReorder() {
    reorderForm.put(reorderUrl as string, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelReorder() {
    const snapshot = rows as WebsiteRow[]
    setOrderedRows(snapshot)
    reorderForm.setData({
      rows: snapshot.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    reorderForm.setDefaults({
      rows: snapshot.map((row, index) => ({ id: row.id, sort_order: index })),
    })
    setReorderMode(false)
  }

  React.useEffect(() => {
    // Pindah tab berarti daftar dan endpoint urutannya berganti, jadi mode urut
    // dibatalkan supaya tidak menyimpan ke daftar yang salah.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReorderMode(false)
  }, [tab, indexRoute])

  const channelOptionsList = channelOptions ?? []
  // Geser-urut hanya sahih saat daftar memuat seluruh baris: payload simpan hanya
  // berisi baris yang tampil, jadi daftar tersaring menulis sort_order parsial.
  const filterKunci =
    filters.published !== "" ||
    (channelOptionsList.length > 0 && channel !== "all") ||
    (replyOptions.length > 0 && reply !== "all")
  const listTersaring = filters.q.trim() !== "" || filterKunci

  const dnd = useRowDragSort({
    enabled: reorderMode && !listTersaring,
    count: orderedRows.length,
    onReorder: reorderRows,
  })

  // Kolom handle hanya dirender bila halaman ini memang punya mode urut: tab
  // tanpa reorder tidak perlu kolom redup yang tidak bisa dipakai.
  const reorderTersedia = Boolean(canReorder && reorderUrl)

  const websiteRows = reorderMode || canReorder ? orderedRows : (rows as WebsiteRow[])
  const showTabs = tabs.length > 0

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
          {previewUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
                <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                <span>Lihat di toko</span>
              </a>
            </Button>
          ) : null}
          {canReorder && reorderUrl ? (
            /* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
               Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
               yang benar-benar digeser. */
            <ReorderActionButton
              active={reorderMode}
              dirty={reorderForm.isDirty}
              processing={reorderForm.processing}
              size="sm"
              disabled={!orderedRows.length || filterKunci}
              disabledReason="Kosongkan filter status dulu supaya urutan bisa digeser."
              onToggle={() => {
                setReorderMode(true)
                // Pencarian dibersihkan sekaligus supaya urutan bisa digeser
                // (kontrak owner 2026-09-20).
                if (filters.q) {
                  setQ("")
                  apply({ q: "" })
                }
              }}
              onCancel={cancelReorder}
              onSave={saveReorder}
            />
          ) : null}

          {tab === "website" && adminReviewHref ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={adminReviewHref}>Ulasan dari order</Link>
            </Button>
          ) : null}
          {!reorderMode ? (
            <Button asChild size="sm">
              <Link href={createHref} className="inline-flex items-center gap-1.5">
                <Icon name="plus" className="size-3.5" aria-hidden="true" />
                <span>{createLabel}</span>
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />



      {showTabs ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1">
            {tabs.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all",
                  tab === item.key
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => apply({ q }),
          placeholder: isApaKata
            ? "Cari nama atau sumber Shopee/WhatsApp"
            : tab === "website"
              ? "Cari nama, komentar, atau sumber"
              : "Cari label atau URL foto",
        }}

        sort={
          sortOptions.length > 0 ? (
            <Select
              value={sort}
              onChange={(event) => {
                const value = event.target.value
                setSort(value)
                apply({ sort: value })
              }}
              className="w-44"
              disabled={reorderMode}
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : null
        }
        className="mb-4"
      >
        <Select
          value={published}
          onChange={(event) => {
            const value = event.target.value
            setPublished(value)
            apply({ published: value })
          }}
          className="w-40"
          disabled={reorderMode}
        >
          {publishedOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {tab === "website" && channelOptionsList.length > 0 ? (
          <Select
            value={channel}
            onChange={(event) => {
              const value = event.target.value
              setChannel(value)
              apply({ channel: value })
            }}
            className="w-56"
            disabled={reorderMode}
          >
            {channelOptionsList.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
        {tab === "website" && replyOptions.length > 0 ? (
          <Select
            value={reply}
            onChange={(event) => {
              const value = event.target.value
              setReply(value)
              apply({ reply: value })
            }}
            className="w-44"
            disabled={reorderMode}
            aria-label="Filter status balasan"
          >
            {replyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : null}
      </ListToolbar>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        {(isTestimonialTable ? websiteRows.length > 0 : rows.length + importedRows.length > 0) ? (
          <div className="overflow-x-auto">
            {isTestimonialTable ? (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
                  <tr>
                    {reorderTersedia ? <th className="w-12 px-3 py-3" aria-label="Seret" /> : null}
                    <th className="px-3 py-3 font-semibold">No</th>
                    <th className="px-3 py-3 font-semibold">Pelanggan</th>
                    <th className="px-3 py-3 font-semibold">{isApaKata ? "Sumber" : "Rating"}</th>
                    <th className="px-3 py-3 font-semibold">{isApaKata ? "Screenshot" : "Komentar"}</th>
                    {!isApaKata ? <th className="px-3 py-3 font-semibold">Foto</th> : null}
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Tanggal</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {websiteRows.map((row, index) => (
                    <tr key={row.id} className={cn("border-t border-border align-top", dnd.draggingIndex === index && "opacity-40")} {...(reorderMode && !listTersaring ? dnd.rowProps(index) : {})}>
                      {/* Geser hanya lewat ikon tarik di tepi kiri (kontrak owner 2026-09-20). */}
                      {reorderTersedia ? (
                        <td className="w-12 px-3 py-3">
                          <ReorderDragHandle enabled={reorderMode && !listTersaring} />
                        </td>
                      ) : null}
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">{row.no}</td>
                      <td className="px-3 py-3">
                        <Link href={row.edit_href} className="font-semibold hover:text-primary hover:underline">
                          {row.customer_name}
                        </Link>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {row.source_label ?? humanize(row.source)}
                          {row.location ? ` · ${row.location}` : ""}
                        </p>
                        {row.product ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{row.product}</p>
                        ) : null}
                        {!row.image_url && isApaKata ? (
                          <p className="mt-0.5 text-[11px] font-semibold text-destructive">Belum ada screenshot</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {isApaKata ? (
                          row.source_url ? (
                            <Select
                              value={row.source}
                              aria-label={"Sumber " + row.customer_name}
                              disabled={busyId === row.id}
                              onChange={(event) => {
                                setBusyId(row.id)
                                router.post(
                                  row.source_url as string,
                                  { source: event.target.value },
                                  { preserveScroll: true, onFinish: () => setBusyId(null) },
                                )
                              }}
                              className="h-8 w-36 text-xs"
                            >
                              {Object.entries(sourceLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">{row.source_label ?? humanize(row.source)}</span>
                          )
                        ) : (
                          <RatingStars rating={row.rating} />
                        )}
                      </td>
                      <td className={cn("px-3 py-3", isApaKata ? "" : "max-w-[18rem] text-muted-foreground")}>
                        {isApaKata ? (
                          row.image_url ? (
                            <img
                              src={row.image_url}
                              alt={`Screenshot ${row.customer_name}`}
                              className="h-20 w-16 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )
                        ) : (
                          <div className="min-w-0">
                            <p className="line-clamp-3">{row.message?.trim() || (row.image_url ? "(screenshot)" : "-")}</p>
                            {row.has_reply ? (
                              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                                <span className="font-semibold text-foreground">Balasan toko: </span>
                                {row.admin_reply}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      {!isApaKata ? (
                        <td className="px-3 py-3">
                          {row.image_url ? (
                            <img
                              src={row.image_url}
                              alt=""
                              className="size-12 rounded-md border border-border object-cover"
                            />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      ) : null}
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.published ? "active" : "inactive"}
                          label={row.published ? "Tampil" : "Tersembunyi"}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(row.created_at)}</td>
                      <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                        {reorderMode ? (
                          <span className="text-xs text-muted-foreground">Mode urutan</span>
                        ) : (
                          <PublishActions
                            published={row.published}
                            editHref={row.edit_href}
                            publishUrl={row.publish_url}
                            unpublishUrl={row.unpublish_url}
                            busy={busyId === row.id}
                            onBusy={(value) => setBusyId(value ? row.id : null)}
                            kind={isApaKata ? "screenshot" : "ulasan"}
                            canReply={Boolean(row.can_reply)}
                            hasReply={Boolean(row.has_reply)}
                            onReply={() => setReplyTarget(row)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-tight text-muted-foreground">
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
                          <span className="text-muted-foreground">-</span>
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
                          label={row.published ? "Tampil" : "Tersembunyi"}
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
                        {row.attach_url ? <AttachProductsDialog row={row} /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : hasActiveFilters ? (
          <EmptyState
            title="Tidak ada ulasan yang cocok"
            description="Coba ubah atau hapus filter untuk melihat ulasan lain."
            action={
              <Button variant="outline" size="sm" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={
              isApaKata
                ? "Belum ada screenshot"
                : tab === "website"
                  ? "Belum ada ulasan website"
                  : "Belum ada foto hasil pemasangan"
            }
            description={
              isApaKata
                ? "Tambahkan screenshot percakapan Shopee atau WhatsApp (bukan ulasan transaksi website)."
                : tab === "website"
                  ? "Tambahkan ulasan manual dari Shopee, WhatsApp, atau website."
                  : "Tambahkan foto hasil pemasangan untuk halaman /hasil-pemasangan."
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

      {/* Satu dialog balasan untuk seluruh daftar, dikontrol state halaman. */}
      <ReplyDialog row={replyTarget} onClose={() => setReplyTarget(null)} />
    </AdminLayout>
  )
}
