import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { addReadyCount, playReadySound } from "@/lib/media-live"
import type { Pagination as PaginationData, SharedPageProps } from "@/types"

const CONTEXT_PRESETS = [
  { label: "Semua", q: "" },
  { label: "Hasil pemasangan", q: "hasil-pemasangan" },
  { label: "Banner", q: "banner" },
  { label: "Media", q: "media" },
]

const CONTEXT_LABELS: Record<string, string> = {
  "hasil-pemasangan": "Hasil pemasangan",
  banner: "Banner",
  media: "Media",
  lainnya: "Lainnya",
}

interface LibraryAsset {
  id: number
  label: string
  kind: string
  status: string
  usage_count: number
  thumb_url?: string | null
  media_url?: string | null
  context: string
  attach_url: string
  created_at: string | null
}

interface ProductOption {
  id: number
  label: string
}

interface LibraryFilters {
  q: string
  kind: string
  status: string
  visibility: string
}

const CONTEXT_RE = /^(hasil-pemasangan|banner|media)$/

export default function MediaLibrary({
  assets,
  pagination,
  filters,
  indexHref,
}: {
  assets: LibraryAsset[]
  pagination: PaginationData | null
  filters: LibraryFilters
  indexHref: string
}) {
  const { csrf } = usePage<SharedPageProps>().props
  const [q, setQ] = React.useState(filters.q)
  const [kind, setKind] = React.useState(filters.kind)
  const [status, setStatus] = React.useState(filters.status)
  const [visibility, setVisibility] = React.useState(filters.visibility)

  // Seleksi multi-asset
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [bulkBusy, setBulkBusy] = React.useState(false)

  // Upload langsung ke R2
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)

  // Status live WebP (pending -> ready tanpa reload)
  const [liveStatus, setLiveStatus] = React.useState<
    Record<number, { status: string; error_reason?: string | null }>
  >({})
  const [readyNotice, setReadyNotice] = React.useState<string | null>(null)
  const [liveThumbs, setLiveThumbs] = React.useState<Record<number, string | null | undefined>>({})
  const liveStatusRef = React.useRef(liveStatus)
  const notifiedRef = React.useRef<number[]>([])
  const assetsRef = React.useRef(assets)
  React.useEffect(() => {
    liveStatusRef.current = liveStatus
  }, [liveStatus])
  React.useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  // Attach lintas produk (pencarian live)
  const [attachingId, setAttachingId] = React.useState<number | null>(null)
  const [attachProduct, setAttachProduct] = React.useState("")
  const [attachQuery, setAttachQuery] = React.useState("")
  const [attachResults, setAttachResults] = React.useState<ProductOption[]>([])
  const [attachSearching, setAttachSearching] = React.useState(false)
  const [attachPosition, setAttachPosition] = React.useState("1")
  const [attachCatalog, setAttachCatalog] = React.useState(true)
  const [attachInstallation, setAttachInstallation] = React.useState(false)
  const [attachVisibility, setAttachVisibility] = React.useState("visible")
  const [attachBusy, setAttachBusy] = React.useState(false)
  const [attachError, setAttachError] = React.useState<string | null>(null)

  const runSearch = React.useCallback(
    (overrides: { q?: string; kind?: string; status?: string; visibility?: string } = {}) => {
      const nextQ = overrides.q !== undefined ? overrides.q : q
      const nextKind = overrides.kind !== undefined ? overrides.kind : kind
      const nextStatus = overrides.status !== undefined ? overrides.status : status
      const nextVisibility = overrides.visibility !== undefined ? overrides.visibility : visibility
      router.get(
        route("admin.media.library"),
        {
          q: nextQ || undefined,
          kind: nextKind || undefined,
          status: nextStatus || undefined,
          visibility: nextVisibility || undefined,
        },
        { preserveState: true, preserveScroll: true },
      )
    },
    [q, kind, status, visibility],
  )

  // Pencarian live (debounce)
  const skipFirst = React.useRef(true)
  React.useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    const timer = window.setTimeout(() => runSearch(), 350)
    return () => window.clearTimeout(timer)
  }, [q, runSearch])

  // Pencarian produk untuk attach (debounce)
  React.useEffect(() => {
    if (attachingId === null) return
    const query = attachQuery.trim()
    if (!query) return
    const timer = window.setTimeout(() => {
      setAttachSearching(true)
      void fetch(`${route("admin.media.products.search")}?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
        .then((body: { products: ProductOption[] }) => {
          setAttachResults(body.products ?? [])
        })
        .catch(() => {
          setAttachResults([])
        })
        .finally(() => {
          setAttachSearching(false)
        })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [attachQuery, attachingId])

  function toggleSelected(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectPage() {
    const pageIds = assets.map((a) => a.id)
    const allSelected = pageIds.every((id) => selectedIds.includes(id))
    setSelectedIds((prev) => {
      const rest = prev.filter((id) => !pageIds.includes(id))
      return allSelected ? rest : [...rest, ...pageIds]
    })
  }

  function runBulkAction(action: "archive" | "delete" | "restore") {
    if (!selectedIds.length) return
    setBulkBusy(true)
    router.post(
      route("admin.media.bulk-action"),
      { action, asset_ids: selectedIds },
      {
        preserveScroll: true,
        onSuccess: () => setSelectedIds([]),
        onFinish: () => setBulkBusy(false),
      },
    )
  }

  async function uploadDirect(file: File) {
    setUploading(true)
    setUploadProgress(0)
    setUploadError(null)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission()
    }
    const kindUpload = file.type.startsWith("video/") ? "video" : "image"
    const context = CONTEXT_RE.test(q.trim()) ? q.trim() : "media"
    try {
      const presignRes = await fetch(route("admin.media.presign"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": csrf,
        },
        body: JSON.stringify({
          kind: kindUpload,
          filename: file.name,
          size_bytes: file.size,
          mime: file.type || "application/octet-stream",
          context,
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

      const form = new FormData()
      form.append("kind", kindUpload)
      form.append("object_key", presigned.object_key)
      form.append("context", context)
      form.append("mime", file.type || "application/octet-stream")
      form.append("position", "1")
      form.append("visibility", "visible")
      router.post(route("admin.media.finalize"), form, {
        forceFormData: true,
        preserveScroll: true,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload gagal — coba lagi.")
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  function openAttach(asset: LibraryAsset) {
    setAttachingId(attachingId === asset.id ? null : asset.id)
    setAttachError(null)
    if (attachingId !== asset.id) {
      setAttachProduct("")
      setAttachQuery("")
      setAttachResults([])
      setAttachPosition("1")
      setAttachCatalog(true)
      setAttachInstallation(false)
      setAttachVisibility("visible")
    }
  }

  function pickProduct(product: ProductOption) {
    setAttachProduct(String(product.id))
    setAttachQuery(product.label)
    setAttachResults([])
  }

  function submitAttach(asset: LibraryAsset) {
    if (!attachProduct) {
      setAttachError("Pilih produk tujuan terlebih dahulu.")
      return
    }
    setAttachBusy(true)
    setAttachError(null)
    router.post(
      asset.attach_url,
      {
        product_ids: [Number(attachProduct)],
        position: Number(attachPosition),
        show_in_catalog: attachCatalog ? 1 : 0,
        is_installation: attachInstallation ? 1 : 0,
        is_main_image: 0,
        visibility: attachVisibility,
      },
      {
        preserveScroll: true,
        onSuccess: () => {
          setAttachingId(null)
        },
        onError: (errors) => {
          setAttachError(Object.values(errors)[0] ?? "Gagal memasang media.")
        },
        onFinish: () => setAttachBusy(false),
      },
    )
  }

  const allPageSelected = assets.length > 0 && assets.every((a) => selectedIds.includes(a.id))

  // Polling status live: selama ada aset pending, cek tiap 3 detik tanpa reload.
  const pendingKey = assets
    .filter((a) => (liveStatus[a.id]?.status ?? a.status) === "pending")
    .map((a) => a.id)
    .join(",")

  React.useEffect(() => {
    if (!pendingKey) return
    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        const params = new URLSearchParams()
        params.set("kind", "asset")
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
          const prev = liveStatusRef.current[item.id]?.status ?? assetsRef.current.find((a) => a.id === item.id)?.status
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
      title="Media Library"
      description="Semua aset media bersama (shared assets): cari, unggah langsung, pilih banyak untuk arsip/hapus, atau pasang ke produk mana pun."
      actions={
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadDirect(file)
              event.target.value = ""
            }}
          />
          <Button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            <Icon name="upload" className="size-4" aria-hidden="true" />
            {uploading ? `Mengunggah ${uploadProgress ?? 0}%…` : "Upload media"}
          </Button>
          <Button asChild variant="secondary">
            <Link href={indexHref}>
              <Icon name="arrow-left" className="size-4" aria-hidden="true" />
              Media produk
            </Link>
          </Button>
        </div>
      }
    >
      <Head title="Media Library | Admin" />

      {readyNotice ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3">
          <p className="text-sm font-semibold text-primary">{readyNotice}</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setReadyNotice(null)}>
            Tutup
          </Button>
        </div>
      ) : null}

      {uploadError ? (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {uploadError}
        </p>
      ) : null}

      {uploading ? (
        <div role="status" aria-live="polite" className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Upload langsung ke penyimpanan (R2)…</span>
            <span>{uploadProgress ?? 0}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${uploadProgress ?? 0}%` }} />
          </div>
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-52 flex-1">
          <label className="text-xs font-semibold text-muted-foreground">Cari label / URL</label>
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="mis. hasil-pemasangan, banner…"
          />
        </div>
        <div className="w-40">
          <label className="text-xs font-semibold text-muted-foreground">Jenis</label>
          <Select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value)
              runSearch({ kind: event.target.value })
            }}
          >
            <option value="">Semua</option>
            <option value="image">Gambar</option>
            <option value="video">Video</option>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              runSearch({ status: event.target.value })
            }}
          >
            <option value="">Semua status</option>
            <option value="ready">Siap</option>
            <option value="pending">Menunggu</option>
            <option value="failed">Gagal</option>
          </Select>
        </div>
        <div className="w-40">
          <label className="text-xs font-semibold text-muted-foreground">Visibilitas</label>
          <Select
            value={visibility}
            onChange={(event) => {
              setVisibility(event.target.value)
              runSearch({ visibility: event.target.value })
            }}
          >
            <option value="">Semua</option>
            <option value="visible">Aktif</option>
            <option value="archived">Diarsipkan</option>
          </Select>
        </div>
        <Button type="button" variant="ghost" onClick={() => { setQ(""); setKind(""); setStatus(""); setVisibility(""); router.get(route("admin.media.library"), {}, { preserveState: true }) }}>
          Reset
        </Button>
      </div>

      {/* Chip konteks */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {CONTEXT_PRESETS.map((preset) => {
          const active = q === preset.q
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setQ(preset.q)
                runSearch({ q: preset.q })
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
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

      {/* Bulk bar */}
      {selectedIds.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-semibold text-foreground">{selectedIds.length} aset terpilih</span>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={toggleSelectPage}
              className="h-4 w-4 accent-primary"
            />
            Semua di halaman ini
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulkAction("restore")}>
              Pulihkan
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={bulkBusy} onClick={() => runBulkAction("archive")}>
              Arsipkan
            </Button>
            <ConfirmAction
              trigger={
                <Button type="button" size="sm" variant="destructive" disabled={bulkBusy}>
                  Hapus
                </Button>
              }
              title="Hapus aset terpilih?"
              description="Aset yang masih dipakai produk/banner/galeri otomatis diarsipkan, bukan dihapus. Aset tak terpakai dihapus permanen beserta file di penyimpanan."
              confirmLabel="Hapus permanen"
              processing={bulkBusy}
              onConfirm={() => runBulkAction("delete")}
            />
            <Button type="button" size="sm" variant="ghost" disabled={bulkBusy} onClick={() => setSelectedIds([])}>
              Batal
            </Button>
          </div>
        </div>
      ) : null}


      {/* Grid asset */}
      {assets.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Belum ada aset yang cocok.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => {
            const isSelected = selectedIds.includes(asset.id)
            const status = liveStatus[asset.id]?.status ?? asset.status
            const thumb = liveThumbs[asset.id] ?? asset.thumb_url
            return (
              <div
                key={asset.id}
                className={cn(
                  "overflow-hidden rounded-xl border bg-card shadow-soft transition-colors",
                  isSelected ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {thumb ? (
                    asset.kind === "video" ? (
                      <video src={thumb} muted preload="metadata" className="size-full object-cover" />
                    ) : (
                      <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
                    )
                  ) : (
                    <div className="flex size-full items-center justify-center text-[10px] text-muted-foreground/60">
                      Tanpa gambar
                    </div>
                  )}
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {CONTEXT_LABELS[asset.context] ?? "Lainnya"}
                  </span>
                  <label className="absolute right-2 top-2 flex size-6 cursor-pointer items-center justify-center rounded-md bg-black/50">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(asset.id)}
                      className="size-4 accent-primary"
                      aria-label={`Pilih ${asset.label}`}
                    />
                  </label>
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate font-mono text-xs font-semibold text-foreground" title={asset.label}>
                    {asset.label}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={asset.kind === "video" ? "video" : "image"} label={asset.kind === "video" ? "Video" : "Gambar"} />
                    <StatusBadge status={status} />
                    <span className="text-[11px] text-muted-foreground">Dipakai di {asset.usage_count} produk</span>
                  </div>
                  <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => openAttach(asset)}>
                    <Icon name="link" className="size-3.5" aria-hidden="true" />
                    {attachingId === asset.id ? "Tutup" : "Pasang ke produk"}
                  </Button>

                  {attachingId === asset.id ? (
                    <div className="space-y-3 rounded-lg border border-border bg-surface-muted p-3">
                      <Field id={`attach-product-${asset.id}`} label="Produk tujuan" error={attachError ?? undefined}>
                        <div className="relative">
                          <Input
                            value={attachQuery}
                            onChange={(event) => {
                              const v = event.target.value
                              setAttachQuery(v)
                              if (!v.trim()) {
                                setAttachResults([])
                                setAttachSearching(false)
                              }
                            }}
                            placeholder="Cari nama produk atau SKU…"
                            autoComplete="off"
                          />
                          {attachQuery.trim() && !attachProduct ? (
                            <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                              {attachSearching ? (
                                <p className="px-3 py-2 text-xs text-muted-foreground">Mencari…</p>
                              ) : attachResults.length === 0 ? (
                                <p className="px-3 py-2 text-xs text-muted-foreground">Tidak ada produk cocok.</p>
                              ) : (
                                attachResults.map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => pickProduct(product)}
                                    className="block w-full truncate px-3 py-2 text-left text-xs text-foreground hover:bg-accent"
                                  >
                                    {product.label}
                                  </button>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field id={`attach-pos-${asset.id}`} label="Posisi">
                          <Input type="number" min="1" max="109" value={attachPosition} onChange={(event) => setAttachPosition(event.target.value)} />
                        </Field>
                        <Field id={`attach-vis-${asset.id}`} label="Visibilitas">
                          <Select value={attachVisibility} onChange={(event) => setAttachVisibility(event.target.value)}>
                            <option value="visible">Visible</option>
                            <option value="hidden">Hidden</option>
                          </Select>
                        </Field>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input type="checkbox" checked={attachCatalog} onChange={(event) => setAttachCatalog(event.target.checked)} className="h-4 w-4 accent-primary" />
                        Tampil di galeri katalog
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs">
                        <input type="checkbox" checked={attachInstallation} onChange={(event) => setAttachInstallation(event.target.checked)} className="h-4 w-4 accent-primary" />
                        Hasil pemasangan
                      </label>
                      {attachError ? (
                        <p role="alert" className="text-xs text-destructive">{attachError}</p>
                      ) : null}
                      <Button type="button" size="sm" className="w-full" disabled={attachBusy} onClick={() => submitAttach(asset)}>
                        {attachBusy ? "Memasang…" : "Pasang media"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pagination && pagination.last_page > 1 ? (
        <div className="mt-6"><Pagination pagination={pagination} /></div>
      ) : null}
    </AdminLayout>
  )
}
