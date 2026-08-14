import { Head, Link, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"
import { addReadyCount, playReadySound } from "@/lib/media-live"
import type { SharedPageProps } from "@/types"

const LIBRARY_CONTEXT_PRESETS = [
  { label: "Semua", q: "" },
  { label: "Hasil pemasangan", q: "hasil-pemasangan" },
  { label: "Banner", q: "banner" },
  { label: "Media", q: "media" },
]

interface VariantOption {
  id: number
  label: string
  variant_sku: string
  status: string
}

interface MediaRow {
  id: number
  position: number
  status: string
  error_reason?: string | null
  visibility: string
  is_main_image: boolean
  show_in_catalog: boolean
  is_installation: boolean
  installation_caption?: string | null
  product_variant_id: number | null
  variant_label: string
  thumb_url?: string | null
  media_kind?: string
  media_url?: string | null
  update_url: string
  set_main_url: string
  archive_url: string
  restore_url: string
  redownload_url: string
  destroy_url?: string | null
}

interface LibraryAsset {
  id: number
  label: string
  kind: string
  status: string
  usage_count: number
  thumb_url?: string | null
  media_url?: string | null
}

function DoubleConfirmDelete({
  trigger,
  title,
  description,
  confirmKeyword = "HAPUS",
  onConfirm,
  processing = false,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirmKeyword?: string
  onConfirm: () => void
  processing?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [keyword, setKeyword] = React.useState("")
  const matches = keyword.trim().toUpperCase() === confirmKeyword

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setKeyword("") }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-2">{description}</DialogDescription>
        </div>
        <Field
          id="double-confirm-keyword"
          label={`Ketik ${confirmKeyword} untuk mengonfirmasi`}
          hint="Tindakan ini memengaruhi banyak media sekaligus dan tidak dapat dibatalkan."
        >
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={confirmKeyword}
            autoComplete="off"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!matches || processing}
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {processing ? "Memproses…" : "Konfirmasi hapus"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function MediaRowCard({
  row,
  variants,
  selected,
  onToggle,
}: {
  row: MediaRow
  variants: VariantOption[]
  selected: boolean
  onToggle: () => void
}) {
  const updateForm = useForm({
    position: row.position,
    visibility: row.visibility,
    show_in_catalog: row.show_in_catalog,
    is_installation: row.is_installation,
    installation_caption: row.installation_caption ?? "",
    product_variant_id: row.product_variant_id ? String(row.product_variant_id) : "",
  })
  const actionForm = useForm({})

  return (
    <article
      className={cn(
        "border-b border-border p-4 last:border-b-0",
        selected && "bg-primary/5",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30">
          {row.media_kind === "video" && row.media_url ? (
            <video src={row.media_url} controls muted preload="metadata" className="h-full w-full object-cover" />
          ) : row.thumb_url ? (
            <img src={row.thumb_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Belum ada
            </div>
          )}
          <label className="absolute left-1.5 top-1.5 flex size-6 cursor-pointer items-center justify-center rounded-md bg-black/50">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggle}
              className="size-4 accent-primary"
              aria-label={`Pilih media #${row.id}`}
            />
          </label>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold text-muted-foreground">#{row.id}</p>
            <StatusBadge status={row.status} />
            {row.is_main_image ? <StatusBadge status="active" label="Utama" /> : null}
            {row.is_installation ? <StatusBadge tone="info" label="Hasil pasang" /> : null}
            {!row.show_in_catalog ? <StatusBadge tone="neutral" label="Non-katalog" /> : null}
            <span className="truncate text-xs text-muted-foreground">{row.variant_label}</span>
          </div>
          {row.status === "failed" && row.error_reason ? (
            <p className="text-xs leading-5 text-destructive">{row.error_reason}</p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field id={`media-position-${row.id}`} label="Posisi" error={updateForm.errors.position}>
              <Input
                type="number"
                min="1"
                max="109"
                value={updateForm.data.position}
                onChange={(event) => updateForm.setData("position", Number(event.target.value))}
              />
            </Field>
            <Field id={`media-visibility-${row.id}`} label="Visibilitas" error={updateForm.errors.visibility}>
              <Select
                value={updateForm.data.visibility}
                onChange={(event) => updateForm.setData("visibility", event.target.value)}
              >
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Field
              id={`media-variant-${row.id}`}
              label="Tautkan ke varian"
              error={updateForm.errors.product_variant_id}
              className="min-w-0"
            >
              <Select
                value={updateForm.data.product_variant_id}
                onChange={(event) => updateForm.setData("product_variant_id", event.target.value)}
                className="w-full min-w-0"
              >
                <option value="">Semua (produk)</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {variant.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateForm.data.show_in_catalog}
                onChange={(event) => updateForm.setData("show_in_catalog", event.target.checked)}
              />
              Galeri katalog
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateForm.data.is_installation}
                onChange={(event) => updateForm.setData("is_installation", event.target.checked)}
              />
              Hasil pemasangan
            </label>
          </div>

          <Field
            id={`media-caption-${row.id}`}
            label="Deskripsi hasil pemasangan (opsional)"
            hint="Tampil saat foto diperbesar di halaman Hasil Pemasangan."
          >
            <Textarea
              rows={2}
              maxLength={280}
              value={updateForm.data.installation_caption}
              onChange={(event) => updateForm.setData("installation_caption", event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                updateForm.transform((data) => ({
                    ...data,
                    product_variant_id:
                      data.product_variant_id === "" ? null : Number(data.product_variant_id),
                  }))
                updateForm.put(row.update_url, { preserveScroll: true })
              }}
              disabled={updateForm.processing}
            >
              Simpan
            </Button>
            {!row.is_main_image ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actionForm.post(row.set_main_url, { preserveScroll: true })}
                disabled={actionForm.processing}
              >
                Jadikan utama
              </Button>
            ) : null}
            {row.status === "failed" || row.status === "pending" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => actionForm.post(row.redownload_url, { preserveScroll: true })}
                disabled={actionForm.processing}
              >
                Unduh ulang
              </Button>
            ) : null}
            {row.destroy_url ? (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Hapus
                  </Button>
                }
                title="Hapus media gagal?"
                description="Media berstatus gagal akan dihapus permanen dari database (dan file lokal bila ada)."
                confirmLabel="Hapus permanen"
                processing={actionForm.processing}
                onConfirm={() =>
                  actionForm.delete(row.destroy_url!, { preserveScroll: true })
                }
              />
            ) : null}
            {row.visibility !== "archived" ? (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="sm">
                    Arsipkan
                  </Button>
                }
                title="Arsipkan media?"
                description={`Media #${row.id} tidak dihapus, tetapi tidak lagi tampil.`}
                confirmLabel="Arsipkan"
                processing={actionForm.processing}
                onConfirm={() => actionForm.post(row.archive_url, { preserveScroll: true })}
              />
            ) : (
              <ConfirmAction
                trigger={
                  <Button variant="ghost" size="sm">
                    Pulihkan
                  </Button>
                }
                title="Pulihkan media?"
                description={`Media #${row.id} dikembalikan dan tampil kembali sesuai visibilitasnya.`}
                confirmLabel="Pulihkan"
                processing={actionForm.processing}
                onConfirm={() => actionForm.post(row.restore_url, { preserveScroll: true })}
              />
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export default function ProductMediaPage({
  product,
  variants = [],
  filters,
  assetSearch = "",
  assetFilters,
  library = [],
  storeUrl,
  indexUrl,
  presignUrl,
  finalizeUrl,
  bulkUrl,
  rows = [],
}: {
  product: {
    id: number
    name: string
    parent_sku: string
    show_href: string
    variants_href: string
  }
  variants: VariantOption[]
  filters: { variant: string }
  assetSearch?: string
  assetFilters?: { kind: string; status: string }
  library?: LibraryAsset[]
  storeUrl: string
  indexUrl: string
  presignUrl: string
  finalizeUrl: string
  bulkUrl: string
  rows: MediaRow[]
}) {
  const [variantFilter, setVariantFilter] = React.useState(filters.variant)
  const [librarySearch, setLibrarySearch] = React.useState(assetSearch)
  const [libraryKind, setLibraryKind] = React.useState(assetFilters?.kind ?? "")
  const [libraryStatus, setLibraryStatus] = React.useState(assetFilters?.status ?? "")
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [bulkBusy, setBulkBusy] = React.useState(false)
  const [liveStatus, setLiveStatus] = React.useState<
    Record<number, { status: string; error_reason?: string | null }>
  >({})
  const [readyNotice, setReadyNotice] = React.useState<string | null>(null)
  const [liveThumbs, setLiveThumbs] = React.useState<Record<number, string | null | undefined>>({})
  const liveStatusRef = React.useRef(liveStatus)
  const notifiedRef = React.useRef<number[]>([])
  const rowsRef = React.useRef(rows)
  React.useEffect(() => {
    liveStatusRef.current = liveStatus
  }, [liveStatus])
  React.useEffect(() => {
    rowsRef.current = rows
  }, [rows])
  const form = useForm<{
    kind: "image" | "video"
    media_asset_id: string
    source_url: string
    position: number
    is_main_image: boolean
    show_in_catalog: boolean
    is_installation: boolean
    installation_caption: string
    visibility: string
    product_variant_id: string
    upload: File | null
  }>({
    kind: "image",
    media_asset_id: "",
    source_url: "",
    position: 1,
    is_main_image: false,
    show_in_catalog: true,
    is_installation: false,
    installation_caption: "",
    visibility: "visible",
    product_variant_id:
      filters.variant && filters.variant !== "shared" ? filters.variant : "",
    upload: null,
  })
  const { csrf } = usePage<SharedPageProps>().props
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [directError, setDirectError] = React.useState<string | null>(null)

  function applyFilter(next: string) {
    setVariantFilter(next)
    router.get(
      indexUrl,
      { variant: next || undefined, q: librarySearch || undefined, kind: libraryKind || undefined, asset_status: libraryStatus || undefined },
      { preserveState: true, preserveScroll: true },
    )
  }

  const runSearch = React.useCallback(
    (overrides: { q?: string; kind?: string; status?: string } = {}) => {
      const q = overrides.q !== undefined ? overrides.q : librarySearch
      const kind = overrides.kind !== undefined ? overrides.kind : libraryKind
      const status = overrides.status !== undefined ? overrides.status : libraryStatus
      router.get(
        indexUrl,
        { variant: variantFilter || undefined, q: q || undefined, kind: kind || undefined, asset_status: status || undefined },
        { preserveState: true, preserveScroll: true },
      )
    },
    [indexUrl, variantFilter, librarySearch, libraryKind, libraryStatus],
  )

  function searchLibrary(qOverride?: string) {
    runSearch({ q: qOverride })
  }

  // Pencarian label live (debounce) — tanpa harus klik tombol Cari.
  const skipFirstLibrarySearch = React.useRef(true)
  React.useEffect(() => {
    if (skipFirstLibrarySearch.current) {
      skipFirstLibrarySearch.current = false
      return
    }
    const timer = window.setTimeout(() => runSearch(), 350)
    return () => window.clearTimeout(timer)
  }, [librarySearch, runSearch])

  const uploadContext = form.data.is_installation
    ? `hasil-pemasangan-${product.parent_sku.toLowerCase()}`
    : "media"

  async function uploadDirect(file: File) {
    setUploading(true)
    setUploadProgress(0)
    setDirectError(null)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission()
    }
    try {
      const presignRes = await fetch(presignUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": csrf,
        },
        body: JSON.stringify({
          kind: form.data.kind,
          filename: file.name,
          size_bytes: file.size,
          mime: file.type || "application/octet-stream",
          context: uploadContext,
        }),
      })
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => null)
        throw new Error(body?.message ?? `Gagal menyiapkan upload (${presignRes.status})`)
      }
      const presigned = (await presignRes.json()) as { upload_url: string; object_key: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", presigned.upload_url)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload ke penyimpanan gagal (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Upload gagal — periksa koneksi internet."))
        xhr.send(file)
      })
      setUploadProgress(100)

      router.post(
        finalizeUrl,
        {
          product_id: product.id,
          kind: form.data.kind,
          object_key: presigned.object_key,
          mime: file.type || "",
          context: uploadContext,
          position: form.data.position,
          is_main_image: form.data.is_main_image ? 1 : 0,
          show_in_catalog: form.data.show_in_catalog ? 1 : 0,
          is_installation: form.data.is_installation ? 1 : 0,
          installation_caption: form.data.installation_caption,
          visibility: form.data.visibility,
          product_variant_id:
            form.data.product_variant_id === "" ? null : Number(form.data.product_variant_id),
        },
        {
          preserveScroll: true,
          onSuccess: () => {
            form.reset("upload", "source_url", "is_main_image")
            form.setData("position", 1)
            form.setData("visibility", "visible")
          },
          onError: (errors) => {
            Object.entries(errors).forEach(([key, message]) =>
              form.setError(key as keyof typeof form.data, message))
          },
        },
      )
    } catch (error) {
      setDirectError(error instanceof Error ? error.message : "Upload gagal — coba lagi.")
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }


  function toggleSelected(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    const pageIds = rows.map((r) => r.id)
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))
    setSelectedIds((prev) => {
      const rest = prev.filter((id) => !pageIds.includes(id))
      return allSelected ? rest : [...rest, ...pageIds]
    })
  }

  function runBulk(action: "archive" | "delete") {
    if (!selectedIds.length) return
    setBulkBusy(true)
    router.post(
      bulkUrl,
      { action, media_ids: selectedIds },
      {
        preserveScroll: true,
        onSuccess: () => setSelectedIds([]),
        onFinish: () => setBulkBusy(false),
      },
    )
  }

  // Polling status live: selama ada media pending, cek tiap 3 detik tanpa reload.
  const pendingKey = rows
    .filter((r) => (liveStatus[r.id]?.status ?? r.status) === "pending")
    .map((r) => r.id)
    .join(",")

  React.useEffect(() => {
    if (!pendingKey) return
    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        const params = new URLSearchParams()
        params.set("kind", "product")
        pendingKey.split(",").filter(Boolean).forEach((id) => params.append("ids[]", id))
        const res = await fetch(`${route("admin.media.status")}?${params.toString()}`, {
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        })
        if (!res.ok) return
        const body = (await res.json()) as {
          statuses: { id: number; status: string; error_reason?: string | null; thumb_url?: string | null }[]
        }
        const next: Record<number, { status: string; error_reason?: string | null }> = {}
        const thumbNext: Record<number, string | null | undefined> = {}
        const newlyReady: number[] = []
        for (const item of body.statuses) {
          next[item.id] = { status: item.status, error_reason: item.error_reason ?? null }
          if (item.thumb_url) thumbNext[item.id] = item.thumb_url
          const prev = liveStatusRef.current[item.id]?.status ?? rowsRef.current.find((r) => r.id === item.id)?.status
          if (prev === "pending" && item.status === "ready" && !notifiedRef.current.includes(item.id)) {
            newlyReady.push(item.id)
          }
        }
        setLiveStatus((old) => ({ ...old, ...next }))
        setLiveThumbs((old) => ({ ...old, ...thumbNext }))
        if (newlyReady.length > 0) {
          notifiedRef.current = [...notifiedRef.current, ...newlyReady]
          setReadyNotice(`${newlyReady.length} media siap dipakai.`)
          playReadySound()
          addReadyCount(newlyReady.length)
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            new Notification("Media siap dipakai", {
              body: `${newlyReady.length} media selesai diproses WebP.`,
            })
          }
        }
      } catch {
        // Abaikan error polling sesaat; interval berikutnya akan mencoba lagi.
      }
    }

    const interval = window.setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [pendingKey])

  return (
    <AdminLayout
      title={`Media · ${product.parent_sku}`}
      description="Tautkan gambar ke warna/kaca/varian agar galeri PDP berganti sesuai pilihan pelanggan."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={product.variants_href}>Kelola varian</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={product.show_href}>Kembali ke produk</Link>
          </Button>
        </div>
      }
    >
      <Head title={`Media ${product.parent_sku} | Admin`} />

      {readyNotice ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
          <p className="text-sm font-semibold text-primary">{readyNotice}</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setReadyNotice(null)}>
            Tutup
          </Button>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={variantFilter}
          onChange={(event) => applyFilter(event.target.value)}
          className="min-w-[16rem]"
        >
          <option value="">Semua media</option>
          <option value="shared">Hanya bersama (tanpa varian)</option>
          {variants.map((variant) => (
            <option key={variant.id} value={String(variant.id)}>
              {variant.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {rows.length} media · {variants.length} varian tersedia
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-semibold">Kelola media</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Gambar dengan tautan varian hanya tampil saat opsi itu dipilih di toko. Kosongkan tautan =
              gambar bersama semua varian.
            </p>
          </div>
          {selectedIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-5 py-3">
              <span className="text-sm font-semibold text-foreground">{selectedIds.length} media terpilih</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selectedIds.includes(r.id))}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-primary"
                />
                Semua di halaman ini
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Button type="button" size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulk("archive")}>
                  Arsipkan
                </Button>
                <DoubleConfirmDelete
                  trigger={
                    <Button type="button" size="sm" variant="destructive" disabled={bulkBusy}>
                      Hapus
                    </Button>
                  }
                  title={`Hapus ${selectedIds.length} media?`}
                  description="PERINGATAN: Hanya media berstatus gagal yang dihapus permanen (beserta file penyimpanan). Media lain otomatis diarsipkan. Aksi massal ini tidak dapat dibatalkan."
                  processing={bulkBusy}
                  onConfirm={() => runBulk("delete")}
                />
                <Button type="button" size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>
                  Batal
                </Button>
              </div>
            </div>
          ) : null}
          {rows.length ? (
            rows.map((row) => (
              <MediaRowCard
                key={row.id}
                row={
                  liveStatus[row.id] || liveThumbs[row.id]
                    ? {
                        ...row,
                        status: liveStatus[row.id]?.status ?? row.status,
                        error_reason: liveStatus[row.id]?.error_reason ?? row.error_reason,
                        thumb_url: liveThumbs[row.id] ?? row.thumb_url,
                      }
                    : row
                }
                variants={variants}
                selected={selectedIds.includes(row.id)}
                onToggle={() => toggleSelected(row.id)}
              />
            ))
          ) : (
            <EmptyState
              className="border-0"
              icon="image"
              title="Belum ada media pada filter ini"
              description="Unggah gambar di panel kanan dan pilih varian warna/kaca yang sesuai."
            />
          )}
        </section>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (form.data.upload) {
              void uploadDirect(form.data.upload)
              return
            }
            form.transform((data) => ({
                ...data,
                product_variant_id:
                  data.product_variant_id === "" ? null : Number(data.product_variant_id),
              }))
            form.post(storeUrl, {
              forceFormData: true,
              preserveScroll: true,
              onSuccess: () => {
                form.reset("source_url", "upload", "is_main_image")
                form.setData("position", 1)
                form.setData("visibility", "visible")
              },
            })
          }}
          className="rounded-xl border border-border bg-card p-5 shadow-sm xl:sticky xl:top-24"
        >
          <h2 className="text-xl font-semibold">Tambah media</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Untuk 4 warna × 3 kaca: pasang gambar/video per kombinasi varian, atau media umum tanpa tautan.
          </p>
          <FormErrorSummary errors={form.errors} className="mt-4" />
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Media Library bersama</p>
                {form.data.media_asset_id ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => form.setData("media_asset_id", "")}>Batal pilih</Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Pasang aset yang sudah ada tanpa upload ulang. Satu media bisa dipakai banyak produk.</p>
              <div className="mt-3 flex gap-2">
                <Input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Cari label / URL (mis. hasil-pemasangan…)" />
                <Select value={libraryKind} onChange={(event) => { setLibraryKind(event.target.value); runSearch({ kind: event.target.value }) }} aria-label="Jenis media library">
                  <option value="">Semua</option>
                  <option value="image">Gambar</option>
                  <option value="video">Video</option>
                </Select>
                <Select value={libraryStatus} onChange={(event) => { setLibraryStatus(event.target.value); runSearch({ status: event.target.value }) }} aria-label="Status media library">
                  <option value="">Semua status</option>
                  <option value="ready">Siap</option>
                  <option value="pending">Menunggu</option>
                  <option value="failed">Gagal</option>
                </Select>
                <Button type="button" variant="secondary" onClick={() => searchLibrary()}>Cari</Button>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {LIBRARY_CONTEXT_PRESETS.map((preset) => {
                  const active = librarySearch === preset.q
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setLibrarySearch(preset.q)
                        runSearch({ q: preset.q })
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                {library.length ? library.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => {
                      form.setData("media_asset_id", String(asset.id))
                      form.setData("kind", asset.kind === "video" ? "video" : "image")
                      if (asset.kind === "video") form.setData("is_main_image", false)
                      form.setData("upload", null)
                      form.setData("source_url", "")
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${form.data.media_asset_id === String(asset.id) ? "border-primary bg-primary/10" : "border-border hover:bg-surface-muted"}`}
                  >
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded border border-border bg-muted/30">
                      {asset.kind === "video" && asset.media_url ? <video src={asset.media_url} muted preload="metadata" className="h-full w-full object-cover" /> : asset.thumb_url ? <img src={asset.thumb_url} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{asset.label}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{asset.status} · Dipakai di {asset.usage_count} produk</span>
                    </span>
                  </button>
                )) : <p className="py-3 text-xs text-muted-foreground">Belum ada aset bersama yang cocok.</p>}
              </div>
            </div>
            <Field id="media-kind" label="Jenis media" error={form.errors.kind}>
              <Select
                value={form.data.kind}
                disabled={Boolean(form.data.media_asset_id)}
                onChange={(event) => {
                  const kind = event.target.value as "image" | "video"
                  form.setData("kind", kind)
                  if (kind === "video") form.setData("is_main_image", false)
                }}
              >
                <option value="image">Gambar</option>
                <option value="video">Video (MP4/WebM/MOV)</option>
              </Select>
            </Field>
            <Field id="media-upload" label={form.data.kind === "video" ? "File video" : "File gambar"} error={form.errors.upload}>
              <Input
                type="file"
                accept={form.data.kind === "video" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
                disabled={Boolean(form.data.media_asset_id)}
                onChange={(event) => form.setData("upload", event.target.files?.[0] ?? null)}
              />
            </Field>
            <Field id="media-source-url" label="URL sumber" error={form.errors.source_url}>
              <Input
                type="url"
                value={form.data.source_url}
                disabled={Boolean(form.data.media_asset_id)}
                onChange={(event) => form.setData("source_url", event.target.value)}
              />
            </Field>
            <Field
              id="media-variant"
              label="Tautkan ke varian"
              error={form.errors.product_variant_id}
              hint="Pilih Warna / Kaca agar galeri PDP ikut berganti."
            >
              <Select
                value={form.data.product_variant_id}
                onChange={(event) => form.setData("product_variant_id", event.target.value)}
              >
                <option value="">Semua (produk)</option>
                {variants.map((variant) => (
                  <option key={variant.id} value={String(variant.id)}>
                    {variant.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="media-position" label="Posisi" required error={form.errors.position}>
                <Input
                  type="number"
                  min="1"
                  max="109"
                  value={form.data.position}
                  onChange={(event) => form.setData("position", Number(event.target.value))}
                />
              </Field>
              <Field id="media-visibility" label="Visibilitas" required error={form.errors.visibility}>
                <Select
                  value={form.data.visibility}
                  onChange={(event) => form.setData("visibility", event.target.value)}
                >
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.data.is_main_image}
                disabled={form.data.kind === "video"}
                onChange={(event) => form.setData("is_main_image", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Jadikan gambar utama produk
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.data.show_in_catalog}
                onChange={(event) => form.setData("show_in_catalog", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Tampil di galeri katalog
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={form.data.is_installation}
                onChange={(event) => form.setData("is_installation", event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Hasil pemasangan
            </label>
          </div>
          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={uploading || form.processing || (!form.data.media_asset_id && !form.data.upload && !form.data.source_url)}
          >
            <Icon name="upload" className="h-4 w-4" aria-hidden="true" />
            {uploading
              ? `Mengunggah ${uploadProgress ?? 0}%...`
              : form.processing
                ? "Menyimpan..."
                : form.data.media_asset_id
                  ? "Pasang tanpa upload ulang"
                  : "Tambah media"}
          </Button>
          {uploading ? (
            <div className="mt-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Upload langsung ke penyimpanan (R2)…</span>
                <span>{uploadProgress ?? 0}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${uploadProgress ?? 0}%` }}
                />
              </div>
            </div>
          ) : null}
          {directError ? (
            <p role="alert" className="mt-3 text-xs leading-5 text-destructive">
              {directError}
            </p>
          ) : null}
        </form>
      </div>
    </AdminLayout>
  )
}
