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
import { routeUrl } from "@/lib/routes"
import type { Pagination as PaginationData, SharedPageProps } from "@/types"

// --- Status mapper media khusus (bukan shipping) ---
const MEDIA_STATUS_META: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" }> = {
  pending:    { label: "Menunggu diproses", tone: "neutral" },
  uploading:  { label: "Sedang diunggah",   tone: "info" },
  downloading:{ label: "Mengambil media",   tone: "info" },
  processing: { label: "Sedang diproses",   tone: "info" },
  ready:      { label: "Siap digunakan",    tone: "success" },
  failed:     { label: "Gagal diproses",    tone: "danger" },
  archived:   { label: "Diarsipkan",         tone: "neutral" },
  duplicate:  { label: "Duplikat terdeteksi", tone: "warning" },
}

function mediaStatusMeta(status: string): { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" } {
  return MEDIA_STATUS_META[status] ?? { label: status, tone: "neutral" }
}

// --- Types ---
interface FolderNode {
  id: number | string
  name: string
  assets_count: number
  children: FolderNode[]
}

interface LibraryAsset {
  id: number
  label: string
  kind: string
  status: string
  usage_count: number
  folder_id: number | null
  thumb_url?: string | null
  media_url?: string | null
  public_url: string
  error_reason?: string | null
  context: string
  attach_url: string
  created_at: string | null
}

interface LibraryFilters {
  q: string
  kind: string
  status: string
  visibility: string
  folder_id: string
}

interface ProductOption {
  id: number
  label: string
}

// --- FolderTree component ---
function FolderTree({ nodes, currentFolderId, onSelect }: {
  nodes: FolderNode[]
  currentFolderId: string
  onSelect: (id: string) => void
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const isActive = String(node.id) === currentFolderId
        const hasChildren = node.children.length > 0
        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(String(node.id))}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card-hover",
              )}
            >
              <Icon name="folder" className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{node.name}</span>
              {node.assets_count > 0 ? (
                <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  {node.assets_count}
                </span>
              ) : null}
            </button>
            {hasChildren ? (
              <div className="ml-3 border-l border-border pl-2">
                <FolderTree nodes={node.children} currentFolderId={currentFolderId} onSelect={onSelect} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

// --- Upload preview modal ---
function UploadModal({ open, onClose, folderId, onUploadDone }: {
  open: boolean
  onClose: () => void
  folderId: string | null
  onUploadDone: () => void
}) {
  const [mode, setMode] = React.useState<"file" | "multiple" | "folder" | "url">("file")
  const [files, setFiles] = React.useState<File[]>([])
  const [url, setUrl] = React.useState("")
  const [results, setResults] = React.useState<{ name: string; status: string; error?: string; progress: number }[]>([])
  const [busy, setBusy] = React.useState(false)
  const { csrf } = usePage<SharedPageProps>().props

  const reset = () => { setFiles([]); setUrl(""); setResults([]); setBusy(false) }

  async function startUpload() {
    setBusy(true)
    const uploads = files.map((f) => ({ name: f.name, file: f }))
    setResults(uploads.map((u) => ({ name: u.name, status: "uploading", progress: 0 })))
    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i]
      await new Promise<void>((resolve) => {
        const fd = new FormData()
        fd.append("media", u.file)
        if (folderId) fd.append("folder_id", folderId)
        const xhr = new XMLHttpRequest()
        xhr.open("POST", routeUrl("admin.media.upload"))
        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
        xhr.setRequestHeader("X-CSRF-TOKEN", csrf)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.min(99, Math.round((e.loaded / e.total) * 100))
            setResults((prev) => prev.map((r, j) => (j === i ? { ...r, progress: pct } : r)))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: "sukses", progress: 100 } : r)))
          } else {
            let msg = "Upload gagal"
            try {
              const body = JSON.parse(xhr.responseText)
              if (body?.message) msg = body.message
            } catch { /* respon bukan JSON */ }
            setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: "gagal", error: msg } : r)))
          }
          resolve()
        }
        xhr.onerror = () => {
          setResults((prev) => prev.map((r, j) => (j === i ? { ...r, status: "gagal", error: "Upload gagal, periksa koneksi." } : r)))
          resolve()
        }
        xhr.send(fd)
      })
    }
    setBusy(false)
    onUploadDone()
  }

  async function importUrl() {
    setBusy(true)
    try {
      const res = await fetch(routeUrl("admin.media.import-url"), {
        method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf },
        body: JSON.stringify({ source_url: url, folder_id: folderId || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Gagal")
      setResults([{ name: url, status: "sukses", progress: 100 }])
    } catch (e) {
      setResults([{ name: url, status: "gagal", error: String(e), progress: 0 }])
    }
    setBusy(false); onUploadDone()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Unggah Media</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="x" className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["file", "multiple", "folder", "url"] as const).map((m) => (
            <Button key={m} type="button" variant={mode === m ? "primary" : "secondary"} size="sm" onClick={() => { setMode(m); reset() }}>
              {m === "file" ? "Pilih File" : m === "multiple" ? "Pilih Banyak File" : m === "folder" ? "Unggah Folder" : "Dari URL"}
            </Button>
          ))}
        </div>

        {mode !== "url" ? (
          <input
            type="file"
            multiple={mode !== "file"}
            {...(mode === "folder" ? { webkitdirectory: "" as any } : {})}
            accept="image/*,video/*"
            className="mb-3 w-full text-xs text-muted-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        ) : (
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/image.jpg" className="mb-3" />
        )}

        {files.length > 0 ? (
          <div className="mb-3 max-h-40 overflow-y-auto rounded border border-border p-2 text-xs">
            {files.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-0.5">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        ) : null}

        {results.length > 0 ? (
          <div className="mb-3 max-h-40 overflow-y-auto rounded border border-border p-2 text-xs">
            {results.map((r, idx) => (
              <div key={`${r.name}-${idx}`} className="flex items-center gap-2 py-0.5">
                <span className="truncate">{r.name}</span>
                {r.status === "uploading" ? (
                  <span className="flex w-28 shrink-0 items-center gap-1.5">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <span className="block h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${r.progress}%` }} />
                    </span>
                    <span className="tabular-nums text-muted-foreground">{r.progress}%</span>
                  </span>
                ) : (
                  <span className={cn("shrink-0", r.status === "sukses" ? "text-success" : "text-destructive")}>
                    {r.status === "sukses" ? "✓" : `✗ ${r.error ?? ""}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
          <Button type="button" size="sm" disabled={(!files.length && !url) || busy} onClick={mode === "url" ? importUrl : startUpload}>
            {busy ? "Memproses…" : "Mulai Unggah"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// --- Copy URL helper ---
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ====== MAIN PAGE ======
export default function MediaLibrary({
  assets, pagination, filters, folders, historyHref, indexHref,
}: {
  assets: LibraryAsset[]
  pagination: PaginationData | null
  filters: LibraryFilters
  folders: FolderNode[]
  historyHref: string
  indexHref: string
}) {
  const { csrf } = usePage<SharedPageProps>().props
  const [q, setQ] = React.useState(filters.q)
  const [kind, setKind] = React.useState(filters.kind)
  const [status, setStatus] = React.useState(filters.status)
  const [visibility, setVisibility] = React.useState(filters.visibility)
  const [folderId, setFolderId] = React.useState(filters.folder_id)
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [showUploadModal, setShowUploadModal] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<number | null>(null)
  const [bulkMoveTarget, setBulkMoveTarget] = React.useState<string>("")

  // Live status
  const [liveStatus, setLiveStatus] = React.useState<Record<number, { status: string; error_reason?: string | null }>>({})
  const [liveThumbs, setLiveThumbs] = React.useState<Record<number, string | null | undefined>>({})
  const [readyNotice, setReadyNotice] = React.useState<string | null>(null)
  const liveStatusRef = React.useRef(liveStatus)
  const notifiedRef = React.useRef<number[]>([])
  const assetsRef = React.useRef(assets)
  React.useEffect(() => { liveStatusRef.current = liveStatus }, [liveStatus])
  React.useEffect(() => { assetsRef.current = assets }, [assets])

  // Attach
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

  const runSearch = React.useCallback((overrides: Partial<LibraryFilters> = {}) => {
    router.get(
      routeUrl("admin.media.library"),
      {
        q: overrides.q ?? (q || undefined),
        kind: overrides.kind ?? (kind || undefined),
        status: overrides.status ?? (status || undefined),
        visibility: overrides.visibility ?? (visibility || undefined),
        folder_id: overrides.folder_id ?? (folderId || undefined),
      },
      { preserveState: true, preserveScroll: true },
    )
  }, [q, kind, status, visibility, folderId])

  const skipFirst = React.useRef(true)
  React.useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    const timer = window.setTimeout(() => runSearch(), 350)
    return () => window.clearTimeout(timer)
  }, [q, runSearch])

  // Attach search
  React.useEffect(() => {
    if (attachingId === null) return
    const query = attachQuery.trim()
    if (!query) return
    const timer = window.setTimeout(() => {
      setAttachSearching(true)
      fetch(`${routeUrl("admin.media.products.search")}?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((b) => setAttachResults(b.products ?? []))
        .catch(() => setAttachResults([]))
        .finally(() => setAttachSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [attachQuery, attachingId])

  function toggleSelected(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function runBulkAction(action: "archive" | "delete" | "restore") {
    const form = new FormData()
    form.append("action", action)
    selectedIds.forEach((id) => form.append("asset_ids[]", String(id)))
    router.post(routeUrl("admin.media.bulk-action"), form, { preserveState: true, onSuccess: () => setSelectedIds([]) })
  }

  async function bulkMove() {
    if (!bulkMoveTarget) return
    const form = new FormData()
    form.append("folder_id", bulkMoveTarget)
    selectedIds.forEach((id) => form.append("asset_ids[]", String(id)))
    router.post(routeUrl("admin.media.folders.move-assets"), form, { preserveState: true, onSuccess: () => { setSelectedIds([]); setBulkMoveTarget("") } })
  }

  async function handleCopyUrl(asset: LibraryAsset) {
    const ok = await copyText(asset.public_url)
    if (ok) { setCopiedId(asset.id); setTimeout(() => setCopiedId(null), 2000) }
  }

  return (
    <AdminLayout
      title="Media Library"
      description="Semua aset media bersama: folder, unggah, salin URL, dan pasang ke produk/banner."
      actions={
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setShowUploadModal(true)}>
            <Icon name="upload" className="size-4" aria-hidden="true" /> Unggah Media
          </Button>
          <Button asChild variant="secondary">
            <Link href={indexHref}><Icon name="arrow-left" className="size-4" aria-hidden="true" /> Media produk</Link>
          </Button>
        </div>
      }
    >
      <Head title="Media Library | Admin" />

      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        folderId={folderId || null}
        onUploadDone={() => { setShowUploadModal(false); runSearch() }}
      />

      <div className="flex gap-4">
        {/* Sidebar folder */}
        <aside className="w-64 shrink-0">
          <div className="mb-2 space-y-1">
            <button
              type="button"
              onClick={() => { setFolderId(""); runSearch({ folder_id: "" }) }}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium", !folderId && !filters.folder_id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card-hover")}
            >
              <Icon name="layout-grid" className="size-3.5" aria-hidden="true" /> Semua Media
            </button>
            <button
              type="button"
              onClick={() => { setFolderId("0"); runSearch({ folder_id: "0" }) }}
              className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium", folderId === "0" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-card-hover")}
            >
              <Icon name="inbox" className="size-3.5" aria-hidden="true" /> Inbox
            </button>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Folder</span>
            <button
              type="button"
              onClick={() => {
                const name = window.prompt("Nama folder baru:")
                if (name?.trim()) {
                  const fd = new FormData()
                  fd.append("name", name.trim())
                  if (folderId && folderId !== "0") fd.append("parent_id", folderId)
                  router.post(routeUrl("admin.media.folders.store"), fd, { preserveState: true })
                }
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Baru
            </button>
          </div>
          <FolderTree nodes={folders} currentFolderId={folderId} onSelect={(id) => { setFolderId(id); runSearch({ folder_id: id }) }} />
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
            <div className="min-w-52 flex-1">
              <label className="text-xs font-semibold text-muted-foreground">Cari label / URL</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. produck, banner…" />
            </div>
            <div className="w-36">
              <label className="text-xs font-semibold text-muted-foreground">Jenis</label>
              <Select value={kind} onChange={(e) => { setKind(e.target.value); runSearch({ kind: e.target.value }) }}>
                <option value="">Semua</option>
                <option value="image">Gambar</option>
                <option value="video">Video</option>
              </Select>
            </div>
            <div className="w-36">
              <label className="text-xs font-semibold text-muted-foreground">Status</label>
              <Select value={status} onChange={(e) => { setStatus(e.target.value); runSearch({ status: e.target.value }) }}>
                <option value="">Semua status</option>
                <option value="ready">Siap</option>
                <option value="pending">Menunggu</option>
                <option value="processing">Diproses</option>
                <option value="failed">Gagal</option>
                <option value="archived">Diarsipkan</option>
              </Select>
            </div>
            <div className="w-36">
              <label className="text-xs font-semibold text-muted-foreground">Visibilitas</label>
              <Select value={visibility} onChange={(e) => { setVisibility(e.target.value); runSearch({ visibility: e.target.value }) }}>
                <option value="">Semua</option>
                <option value="visible">Tampil</option>
                <option value="hidden">Sembunyi</option>
                <option value="archived">Diarsipkan</option>
              </Select>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={historyHref}><Icon name="clock" className="size-3.5" aria-hidden="true" /> Riwayat</Link>
            </Button>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 px-3">
              <span className="text-xs font-semibold">{selectedIds.length} dipilih</span>
              <ConfirmAction
                trigger={<Button type="button" variant="secondary" size="sm">Arsipkan</Button>}
                title="Arsipkan" description="Arsipkan aset terpilih?" confirmLabel="Arsipkan"
                onConfirm={() => runBulkAction("archive")}
              />
              <ConfirmAction
                trigger={<Button type="button" variant="secondary" size="sm">Pulihkan</Button>}
                title="Pulihkan" description="Pulihkan aset?" confirmLabel="Pulihkan"
                onConfirm={() => runBulkAction("restore")}
              />
              <ConfirmAction
                trigger={<Button type="button" variant="secondary" size="sm" className="text-destructive">Hapus</Button>}
                title="Hapus" description="Aset yang masih digunakan akan diarsipkan, bukan dihapus." confirmLabel="Hapus"
                onConfirm={() => runBulkAction("delete")}
              />
              <Select value={bulkMoveTarget} onChange={(e) => setBulkMoveTarget(e.target.value)} className="w-48">
                <option value="">Pindah ke folder…</option>
                <option value="0">Inbox</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
              {bulkMoveTarget ? (
                <Button type="button" size="sm" onClick={bulkMove}>Pindahkan</Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Batal</Button>
            </div>
          ) : null}

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {assets.map((asset) => {
              const meta = mediaStatusMeta(asset.status)
              const isCopied = copiedId === asset.id
              return (
                <div key={asset.id} className="group relative overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {asset.thumb_url ? (
                      <img src={asset.thumb_url} alt={asset.label} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Icon name={asset.kind === "video" ? "video" : "image"} className="size-8" aria-hidden="true" />
                      </div>
                    )}
                    {asset.status === "ready" ? (
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(asset)}
                        aria-label={`Salin URL publik ${asset.label}`}
                        title="Salin URL publik"
                        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-md bg-surface/80 text-muted-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-surface hover:text-foreground"
                      >
                        <Icon name={isCopied ? "check" : "copy"} className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                    {asset.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => router.post(routeUrl("admin.media.redownload", { media: asset.id }), {}, { preserveState: true })}
                        className="absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-md bg-surface/80 text-destructive"
                        title="Coba lagi"
                      >
                        <Icon name="rotate-cw" className="size-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(asset.id)}
                      onChange={() => toggleSelected(asset.id)}
                      className="absolute left-1.5 top-1.5 size-4 rounded border-border accent-primary opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label={`Pilih ${asset.label}`}
                    />
                  </div>
                  <div className="space-y-1 p-2.5">
                    <p className="truncate text-xs font-medium text-foreground" title={asset.label}>{asset.label}</p>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                    {asset.usage_count > 0 ? (
                      <p className="text-[10px] text-muted-foreground">Digunakan di {asset.usage_count} tempat</p>
                    ) : null}
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => setAttachingId(asset.id)}>
                        <Icon name="link" className="size-3" aria-hidden="true" /> Pasang
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]">
                        <Link href={asset.attach_url}><Icon name="info" className="size-3" aria-hidden="true" /> Detail</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
            {assets.length === 0 ? (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                <Icon name="image" className="mx-auto mb-2 size-8 text-muted-foreground/50" aria-hidden="true" />
                Belum ada media. Unggah file untuk memulai.
              </div>
            ) : null}
          </div>

          {pagination ? <Pagination pagination={pagination} /> : null}
        </div>
      </div>

      {/* Attach modal */}
      {attachingId !== null ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setAttachingId(null)}>
          <div className="w-full max-w-md rounded-lg bg-surface p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold">Pasang ke produk</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Cari produk</label>
                <Input value={attachQuery} onChange={(e) => setAttachQuery(e.target.value)} placeholder="Nama atau SKU produk…" />
              </div>
              {attachSearching ? <p className="text-xs text-muted-foreground">Mencari…</p> : null}
              {attachResults.length > 0 ? (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {attachResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => setAttachProduct(String(p.id))} className={cn("block w-full rounded px-2 py-1 text-left text-xs hover:bg-card-hover", attachProduct === String(p.id) ? "bg-primary/10 text-primary" : "text-foreground")}>
                      {p.label}
                    </button>
                  ))}
                </div>
              ) : attachQuery.trim() && !attachSearching ? <p className="text-xs text-muted-foreground">Tidak ditemukan</p> : null}
              {attachProduct ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Posisi</label>
                    <Input type="number" value={attachPosition} onChange={(e) => setAttachPosition(e.target.value)} min="1" />
                  </div>
                  <div className="flex items-end gap-1">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={attachCatalog} onChange={(e) => setAttachCatalog(e.target.checked)} /> Tampilkan katalog
                    </label>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={attachInstallation} onChange={(e) => setAttachInstallation(e.target.checked)} /> Pemasangan
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setAttachingId(null); setAttachProduct("") }}>Batal</Button>
              <Button type="button" size="sm" disabled={!attachProduct || attachBusy} onClick={async () => {
                setAttachBusy(true); setAttachError(null)
                try {
                  const res = await fetch(routeUrl("admin.media.attach", { media: attachingId }), {
                    method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf },
                    body: JSON.stringify({ product_id: Number(attachProduct), position: Number(attachPosition), show_in_catalog: attachCatalog, is_installation: attachInstallation, visibility: attachVisibility }),
                  })
                  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Gagal")
                  setAttachingId(null); setAttachProduct("")
                } catch (e) { setAttachError(String(e)) }
                setAttachBusy(false)
              }}>
                {attachBusy ? "Memasang…" : "Pasang"}
              </Button>
            </div>
            {attachError ? <p className="mt-2 text-xs text-destructive">{attachError}</p> : null}
          </div>
        </div>
      ) : null}
    </AdminLayout>
  )
}