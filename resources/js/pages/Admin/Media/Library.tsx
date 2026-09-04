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
  id: number
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

function flattenFolders(nodes: FolderNode[], depth = 0, out: Array<{ id: number; name: string; indent: string; assets_count: number }> = []) {
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, indent: "\u00a0".repeat(depth * 4) + (depth > 0 ? "\u21b3 " : ""), assets_count: node.assets_count ?? 0 })
    flattenFolders(node.children, depth + 1, out)
  }
  return out
}

// --- FolderTree component ---
function FolderTree({ nodes, currentFolderId, onSelect }: {
  nodes: FolderNode[]
  currentFolderId: string
  onSelect: (id: string) => void
}) {
  const [menuFor, setMenuFor] = React.useState<number | null>(null)

  function submitFolderAction(folderId: number, action: "rename" | "archive", name?: string) {
    const fd = new FormData()
    if (action === "rename") {
      if (!name?.trim()) return
      fd.append("name", name.trim())
      router.post(routeUrl("admin.media.folders.rename", { folder: folderId }), fd, { preserveState: true })
    } else {
      router.post(routeUrl("admin.media.folders.archive", { folder: folderId }), fd, { preserveState: true })
    }
    setMenuFor(null)
  }

  function createSubfolder(parentId: number) {
    const name = window.prompt("Nama subfolder baru:")
    if (name?.trim()) {
      const fd = new FormData()
      fd.append("name", name.trim())
      fd.append("parent_id", String(parentId))
      router.post(routeUrl("admin.media.folders.store"), fd, { preserveState: true })
    }
    setMenuFor(null)
  }

  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => {
        const isActive = String(node.id) === currentFolderId
        const hasChildren = node.children.length > 0
        const isOpen = menuFor === node.id
        return (
          <li key={node.id} className="relative">
            <div className={cn("group/folder flex items-center gap-1 rounded-md", isActive && "bg-primary/10")}>
              <button
                type="button"
                onClick={() => onSelect(String(node.id))}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:bg-card-hover",
                )}
              >
                <Icon name={isActive ? "folder-open" : "folder"} className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{node.name}</span>
                {node.assets_count > 0 ? (
                  <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                    {node.assets_count}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`Menu folder ${node.name}`}
                title="Menu folder"
                onClick={() => setMenuFor(isOpen ? null : node.id)}
                className={cn(
                  "mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-card-hover hover:text-foreground",
                  isOpen ? "opacity-100" : "opacity-0 group-hover/folder:opacity-100",
                )}
              >
                <Icon name="dots-three" className="size-3.5" aria-hidden="true" />
              </button>
            </div>
            {isOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 w-44 space-y-0.5 rounded-lg border border-border bg-card p-1 shadow-float">
                <button type="button" onClick={() => createSubfolder(node.id)} className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover">
                  Buat subfolder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const name = window.prompt("Nama folder baru:", node.name)
                    if (name?.trim()) submitFolderAction(node.id, "rename", name)
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                >
                  Rename
                </button>
                <ConfirmAction
                  trigger={<span className="block w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-card-hover">Arsipkan</span>}
                  title="Arsipkan folder?" description="Aset di dalamnya ikut diarsipkan." confirmLabel="Arsipkan"
                  onConfirm={() => submitFolderAction(node.id, "archive")}
                />
              </div>
            ) : null}
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
// State upload dinaikkan ke halaman (uploads + startUploads) agar progress
// tetap terlihat walau modal ditutup (lihat UploadTracker di bawah).
type UploadItem = { id: number; name: string; status: "uploading" | "sukses" | "gagal"; progress: number; error?: string }

function UploadModal({ open, onClose, folderId, uploads, onStart }: {
  open: boolean
  onClose: () => void
  folderId: string | null
  uploads: UploadItem[]
  onStart: (files: File[]) => void
}) {
  const [mode, setMode] = React.useState<"file" | "multiple" | "folder" | "url">("file")
  const [files, setFiles] = React.useState<File[]>([])
  const [url, setUrl] = React.useState("")
  const [urlResult, setUrlResult] = React.useState<{ name: string; status: string; error?: string } | null>(null)
  const { csrf } = usePage<SharedPageProps>().props
  const uploading = uploads.filter((u) => u.status === "uploading").length

  const reset = () => { setFiles([]); setUrl(""); setUrlResult(null) }

  async function importUrl() {
    if (!url.trim()) return
    setUrlResult({ name: url, status: "uploading" })
    try {
      const res = await fetch(routeUrl("admin.media.import-url"), {
        method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf },
        body: JSON.stringify({ source_url: url, folder_id: folderId || undefined }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? "Gagal")
      setUrlResult({ name: url, status: "sukses" })
    } catch (e) {
      setUrlResult({ name: url, status: "gagal", error: String(e) })
    }
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

        {mode !== "url" && files.length > 0 ? (
          <div className="mb-3 max-h-40 overflow-y-auto rounded border border-border p-2 text-xs">
            {files.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-0.5">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
            ))}
          </div>
        ) : null}

        {mode !== "url" && uploads.length > 0 ? (
          <div className="mb-3 max-h-40 overflow-y-auto rounded border border-border p-2 text-xs">
            {uploads.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-0.5">
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

        {mode === "url" && urlResult ? (
          <div className={cn("mb-3 rounded border border-border p-2 text-xs", urlResult.status === "sukses" ? "text-success" : urlResult.status === "gagal" ? "text-destructive" : "text-muted-foreground")}>
            {urlResult.status === "uploading" ? "Mengambil URL…" : urlResult.status === "sukses" ? "✓ Media berhasil ditambahkan" : `✗ ${urlResult.error ?? "Gagal"}`}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Batal</Button>
          <Button
            type="button"
            size="sm"
            disabled={mode === "url" ? !url.trim() : !files.length}
            onClick={mode === "url" ? importUrl : () => { onStart(files); setFiles([]) }}
          >
            {uploading > 0 ? `Mengunggah ${uploading}…` : "Mulai Unggah"}
          </Button>
        </div>
        {uploading > 0 ? (
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Boleh tutup jendela ini, progress tetap berjalan di panel kanan bawah.
          </p>
        ) : null}
      </div>
    </div>
  )
}

// --- Panel tracking upload (persisten walau modal ditutup) ---
function UploadTracker({ uploads, onDismiss }: { uploads: UploadItem[]; onDismiss: () => void }) {
  const [hidden, setHidden] = React.useState(false)
  const active = uploads.filter((u) => u.status === "uploading").length
  const allDone = uploads.length > 0 && active === 0

  React.useEffect(() => {
    if (!allDone) return
    const t = window.setTimeout(() => setHidden(true), 5000)
    return () => window.clearTimeout(t)
  }, [allDone])

  if (uploads.length === 0 || hidden) return null
  const ok = uploads.filter((u) => u.status === "sukses").length
  const fail = uploads.filter((u) => u.status === "gagal").length

  return (
    <div className="fixed bottom-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 shadow-float">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold">Unggah Media</p>
        <button type="button" onClick={() => setHidden(true)} className="text-muted-foreground hover:text-foreground" aria-label="Tutup panel unggah">
          <Icon name="x" className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {uploads.map((u) => (
          <div key={u.id} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">{u.name}</span>
              {u.status === "uploading" ? (
                <span className="shrink-0 tabular-nums text-muted-foreground">{u.progress}%</span>
              ) : u.status === "sukses" ? (
                <span className="shrink-0 text-success">✓</span>
              ) : (
                <span className="shrink-0 text-destructive" title={u.error ?? ""}>✗</span>
              )}
            </div>
            {u.status === "uploading" ? (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${u.progress}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
        {allDone ? `${ok} berhasil${fail ? `, ${fail} gagal` : ""}` : `Sedang mengunggah ${active} media…`}
      </p>
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
  assets, pagination, filters, folders, historyHref,
}: {
  assets: LibraryAsset[]
  pagination: PaginationData | null
  filters: LibraryFilters
  folders: FolderNode[]
  historyHref: string
}) {
  const { csrf } = usePage<SharedPageProps>().props
  const [q, setQ] = React.useState(filters.q)
  const [kind, setKind] = React.useState(filters.kind)
  const [status, setStatus] = React.useState(filters.status)
  const [visibility, setVisibility] = React.useState(filters.visibility)
  const [folderId, setFolderId] = React.useState(filters.folder_id)
  const [showSidebar, setShowSidebar] = React.useState(true)
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  const [showUploadModal, setShowUploadModal] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<number | null>(null)
  const [bulkMoveTarget, setBulkMoveTarget] = React.useState<string>("")

  // Upload tracking (persisten walau modal ditutup)
  const [uploads, setUploads] = React.useState<UploadItem[]>([])
  const uploadIdRef = React.useRef(0)

  function patchUpload(id: number, patch: Partial<Omit<UploadItem, "id" | "name">>): void {
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  function uploadOne(id: number, file: File, folder: string | null): Promise<void> {
    return new Promise((resolve) => {
      const fd = new FormData()
      fd.append("media", file)
      if (folder) fd.append("folder_id", folder)
      const xhr = new XMLHttpRequest()
      xhr.open("POST", routeUrl("admin.media.upload"))
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
      xhr.setRequestHeader("X-CSRF-TOKEN", csrf)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) patchUpload(id, { progress: Math.min(99, Math.round((e.loaded / e.total) * 100)) })
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          patchUpload(id, { status: "sukses", progress: 100 })
        } else {
          let msg = "Upload gagal"
          try {
            const body = JSON.parse(xhr.responseText)
            if (body?.message) msg = body.message
          } catch { /* respon bukan JSON */ }
          patchUpload(id, { status: "gagal", error: msg })
        }
        resolve()
      }
      xhr.onerror = () => {
        patchUpload(id, { status: "gagal", error: "Upload gagal, periksa koneksi." })
        resolve()
      }
      xhr.send(fd)
    })
  }

  async function startUploads(files: File[]): Promise<void> {
    const folder = folderId || null
    const items = files.map((f) => ({ id: ++uploadIdRef.current, name: f.name, file: f }))
    setUploads((prev) => [...prev, ...items.map(({ id, name }) => ({ id, name, status: "uploading" as const, progress: 0 }))])
    for (const it of items) {
      await uploadOne(it.id, it.file, folder)
    }
    runSearch()
  }

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
        </div>
      }
    >
      <Head title="Media Library | Admin" />

      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        folderId={folderId || null}
        uploads={uploads}
        onStart={(files) => { void startUploads(files) }}
      />
      <UploadTracker uploads={uploads} onDismiss={() => setUploads([])} />

      {/* Toggle panel folder: ikon folder, kiri */}
      <div className="mb-2 flex items-center">
        <button
          type="button"
          onClick={() => setShowSidebar((v) => !v)}
          aria-label={showSidebar ? "Sembunyikan panel folder" : "Tampilkan panel folder"}
          title={showSidebar ? "Sembunyikan panel folder" : "Tampilkan panel folder"}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-md border border-border transition",
            showSidebar
              ? "bg-primary/10 text-primary"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon name={showSidebar ? "folder-open" : "folder"} className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex gap-4">
        {/* Sidebar folder (bisa disembunyikan agar galeri lebih lebar) */}
        {showSidebar ? (
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
        ) : null}

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
            <div className="min-w-52 flex-1">
              <label className="text-xs font-semibold text-muted-foreground">Cari label / URL</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. produk, banner…" />
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
              <Link href={historyHref}><Icon name="clock" className="size-3.5" aria-hidden="true" /> Aktivitas Media</Link>
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
              <Select value={bulkMoveTarget} onChange={(e) => setBulkMoveTarget(e.target.value)} className="w-56">
                <option value="">Pindah ke folder…</option>
                <option value="0">Inbox (tanpa folder)</option>
                {flattenFolders(folders).map((f) => (
                  <option key={f.id} value={f.id}>{f.indent}{f.name} ({f.assets_count})</option>
                ))}
              </Select>
              {bulkMoveTarget ? (
                <Button type="button" size="sm" onClick={bulkMove}>Pindahkan</Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Batal</Button>
            </div>
          ) : null}

          {/* Pilih semua */}
          {assets.length > 0 ? (
            <div className="mb-3 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedIds(assets.map((a) => a.id))}
                disabled={selectedIds.length === assets.length}
              >
                Pilih semua
              </Button>
              {selectedIds.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                  Kosongkan
                </Button>
              ) : null}
              <span className="text-xs text-muted-foreground">Klik kartu untuk memilih; klik lagi untuk batal.</span>
            </div>
          ) : null}

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {assets.map((asset) => {
              const meta = mediaStatusMeta(asset.status)
              const isCopied = copiedId === asset.id
              return (
                <div
                  key={asset.id}
                  role="checkbox"
                  aria-checked={selectedIds.includes(asset.id)}
                  tabIndex={0}
                  onClick={(e) => {
                    // Tombol/link di dalam card tetap berfungsi normal.
                    const target = e.target as HTMLElement
                    if (target.closest('button, a, input, [data-no-select]')) return
                    toggleSelected(asset.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const target = e.target as HTMLElement
                      if (target.closest('button, a, input, [data-no-select]')) return
                      e.preventDefault()
                      toggleSelected(asset.id)
                    }
                  }}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md ${selectedIds.includes(asset.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {asset.thumb_url ? (
                      <img src={asset.thumb_url} alt={asset.label} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Icon name={asset.kind === "video" ? "video" : "image"} className="size-8" aria-hidden="true" />
                      </div>
                    )}
                    <span
                      className="absolute bottom-1.5 left-1.5 size-2.5 rounded-full ring-2 ring-surface"
                      style={{ backgroundColor: asset.status === "ready" ? "#2b734e" : asset.status === "failed" ? "#c20000" : asset.status === "archived" ? "#666666" : "#8d570c" }}
                      title={meta.label}
                    />
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
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelected(asset.id)}
                      className="absolute left-1.5 top-1.5 size-4 rounded border-border accent-primary"
                      aria-label={`Pilih ${asset.label}`}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground" title={asset.label}>{asset.label}</p>
                      {asset.usage_count > 0 ? (
                        <p className="text-[10px] text-muted-foreground">Dipakai {asset.usage_count}x</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setAttachingId(asset.id)}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
                        title="Pasang ke produk"
                        aria-label={`Pasang ${asset.label}`}
                      >
                        <Icon name="link" className="size-3.5" aria-hidden="true" />
                      </button>
                      <Link
                        href={asset.attach_url}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground"
                        title="Detail"
                        aria-label={`Detail ${asset.label}`}
                      >
                        <Icon name="info" className="size-3.5" aria-hidden="true" />
                      </Link>
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