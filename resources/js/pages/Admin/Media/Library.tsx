import { Head, Link, router, usePage } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { ErrorState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
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

// --- FolderTree component dengan fitur Expand/Collapse & Hapus Folder ---
function FolderTreeList({
  nodes,
  currentFolderId,
  onSelect,
  expandedIds,
  onToggleExpand,
  parentId,
  onRequestCreate,
  onRequestRename,
}: {
  nodes: FolderNode[]
  currentFolderId: string
  onSelect: (id: string) => void
  expandedIds: Record<number, boolean>
  onToggleExpand: (id: number) => void
  /** Parent dari level ini; null = folder root. Dipakai untuk reorder sibling. */
  parentId: number | null
  /** Buka dialog buat subfolder (parentId = folder tempat subfolder dibuat). */
  onRequestCreate: (parentId: number | null) => void
  /** Buka dialog ubah nama folder. */
  onRequestRename: (folderId: number, currentName: string) => void
}) {
  const [menuFor, setMenuFor] = React.useState<number | null>(null)
  const [order, setOrder] = React.useState<FolderNode[]>(nodes)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [dragTarget, setDragTarget] = React.useState<number | null>(null)

  React.useEffect(() => {
    setOrder(nodes)
  }, [nodes])

  /**
   * Urutkan hanya ANTAR-SIBLING di level ini (folder tidak bisa pindah ke
   * dalam folder lain lewat drag). Simpan langsung setelah drop.
   */
  function persistOrder(next: FolderNode[]) {
    setOrder(next)
    router.put(
      routeUrl("admin.media.folders.reorder"),
      { parent_id: parentId, ids: next.map((n) => n.id) },
      { preserveState: true, preserveScroll: true },
    )
  }

  function dropOn(targetIndex: number) {
    const from = dragIndex
    setDragIndex(null)
    setDragTarget(null)
    if (from === null || from === targetIndex) return
    const next = [...order]
    const [moved] = next.splice(from, 1)
    next.splice(targetIndex, 0, moved)
    persistOrder(next)
  }

  function submitFolderAction(folderId: number, action: "rename" | "archive" | "delete", name?: string) {
    if (action === "delete") {
      router.delete(routeUrl("admin.media.folders.destroy", { folder: folderId }), {
        preserveState: true,
        onSuccess: () => {
          if (currentFolderId === String(folderId)) {
            onSelect("")
          }
        },
      })
      setMenuFor(null)
      return
    }
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
    setMenuFor(null)
    if (!expandedIds[parentId]) {
      onToggleExpand(parentId)
    }
    window.setTimeout(() => onRequestCreate(parentId), 0)
  }

  return (
    <ul className="space-y-0.5">
      {order.map((node, index) => {
        const isActive = String(node.id) === currentFolderId
        const hasChildren = node.children.length > 0
        const isExpanded = Boolean(expandedIds[node.id])
        const isOpen = menuFor === node.id

        return (
          <li
            key={node.id}
            className={cn(
              "relative rounded-md",
              dragIndex === index && "opacity-40",
              dragTarget === index && dragIndex !== null && dragIndex !== index && "ring-1 ring-primary",
            )}
            onDragOver={(event) => {
              if (dragIndex === null) return
              event.preventDefault()
              if (dragTarget !== index) setDragTarget(index)
            }}
            onDragLeave={() => setDragTarget((cur) => (cur === index ? null : cur))}
            onDrop={(event) => {
              if (dragIndex === null) return
              event.preventDefault()
              event.stopPropagation()
              dropOn(index)
            }}
          >
            <div className={cn("group/folder flex items-center gap-0.5 rounded-md", isActive && "bg-primary/10")}>
              {/* Ikon grab: seret untuk mengurutkan antar-folder sejajar */}
              <span
                draggable
                onDragStart={(event) => {
                  event.stopPropagation()
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", String(node.id))
                  setDragIndex(index)
                }}
                onDragEnd={() => {
                  setDragIndex(null)
                  setDragTarget(null)
                }}
                className="flex size-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground transition hover:bg-card-hover hover:text-foreground active:cursor-grabbing"
                title="Seret untuk mengurutkan folder"
                aria-label={`Urutkan folder ${node.name}`}
              >
                <Icon name="dots-six-vertical" className="size-3.5" aria-hidden="true" />
              </span>

              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand(node.id)
                  }}
                  className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-card-hover hover:text-foreground"
                  aria-label={isExpanded ? "Ciutkan subfolder" : "Bentangkan subfolder"}
                  title={isExpanded ? "Ciutkan subfolder" : "Bentangkan subfolder"}
                >
                  <Icon
                    name={isExpanded ? "caret-down" : "caret-right"}
                    className="size-3"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <span className="size-5 shrink-0" aria-hidden="true" />
              )}

              <button
                type="button"
                onClick={() => {
                  onSelect(String(node.id))
                  if (hasChildren && !isExpanded) {
                    onToggleExpand(node.id)
                  }
                }}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs font-medium transition-colors",
                  isActive ? "text-primary font-semibold" : "text-muted-foreground hover:bg-card-hover",
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
              <div className="absolute right-0 top-full z-30 mt-1 w-48 space-y-0.5 rounded-lg border border-border bg-card p-1 shadow-float">
                <button
                  type="button"
                  onClick={() => createSubfolder(node.id)}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                >
                  Buat subfolder
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuFor(null)
                    // Tunda satu tick: klik yang sama tidak boleh dianggap
                    // interaksi luar oleh Radix Dialog (dialog langsung tertutup).
                    window.setTimeout(() => onRequestRename(node.id, node.name), 0)
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                >
                  Ganti nama
                </button>
                <ConfirmAction
                  trigger={
                    <button
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                    >
                      Arsipkan
                    </button>
                  }
                  title="Arsipkan folder?"
                  description="Aset di dalamnya ikut diarsipkan."
                  confirmLabel="Arsipkan"
                  onConfirm={() => submitFolderAction(node.id, "archive")}
                />
                <ConfirmAction
                  trigger={
                    <button
                      type="button"
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                    >
                      Hapus folder
                    </button>
                  }
                  title={`Hapus folder "${node.name}"?`}
                  description="Semua aset di dalam folder ini (jika ada) akan otomatis dipindahkan ke Semua Media."
                  confirmLabel="Hapus Folder"
                  onConfirm={() => submitFolderAction(node.id, "delete")}
                />
              </div>
            ) : null}

            {hasChildren && isExpanded ? (
              <div className="ml-2.5 border-l border-border pl-2">
                <FolderTreeList
                  nodes={node.children}
                  currentFolderId={currentFolderId}
                  onSelect={onSelect}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  parentId={node.id}
                  onRequestCreate={onRequestCreate}
                  onRequestRename={onRequestRename}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Dialog nama folder (buat / ubah nama). window.prompt diblokir di browser
 * in-app sehingga tombol tidak bereaksi; dialog UI ini menggantikannya.
 */
function FolderNameDialog({
  mode,
  open,
  initialName = "",
  onClose,
  onSubmit,
  processing,
}: {
  mode: "create" | "rename"
  open: boolean
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => void
  processing?: boolean
}) {
  const [value, setValue] = React.useState(initialName)

  React.useEffect(() => {
    if (open) setValue(initialName)
  }, [open, initialName])

  const isCreate = mode === "create"

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogTitle>{isCreate ? "Folder baru" : "Ubah nama folder"}</DialogTitle>
        <DialogDescription>
          {isCreate
            ? "Folder baru dibuat di dalam folder yang sedang dibuka (atau di tingkat utama)."
            : "Nama folder hanya label organisasi; berkas media tidak berubah."}
        </DialogDescription>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!value.trim() || processing) return
            onSubmit(value.trim())
          }}
        >
          <Field id="folder-name-dialog" label="Nama folder">
            <Input
              id="folder-name-dialog"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="mis. Hasil Pemasangan"
              autoFocus
            />
          </Field>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={processing || !value.trim()}>
              {processing ? "Menyimpan..." : isCreate ? "Buat folder" : "Simpan nama"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface FlattenedFolderNode {
  id: number
  name: string
  depth: number
  assets_count: number
  assets_total: number
  path: string
  node: FolderNode
}

function buildFlattenedFolders(nodes: FolderNode[]): FlattenedFolderNode[] {
  const out: FlattenedFolderNode[] = []

  function traverse(list: FolderNode[], depth: number, parentPath: string): number {
    let subtreeTotal = 0
    for (const item of list) {
      const path = depth === 0 ? item.name : `${parentPath} / ${item.name}`
      const own = item.assets_count ?? 0
      const index = out.length
      out.push({
        id: item.id,
        name: item.name,
        depth,
        assets_count: own,
        assets_total: own,
        path,
        node: item,
      })
      const nested = traverse(item.children || [], depth + 1, path)
      out[index].assets_total = own + nested
      subtreeTotal += own + nested
    }
    return subtreeTotal
  }

  traverse(nodes, 0, "")
  return out
}

function FolderTree({
  nodes,
  currentFolderId,
  onSelect,
  onRequestCreate,
  onRequestRename,
}: {
  nodes: FolderNode[]
  currentFolderId: string
  onSelect: (id: string) => void
  onRequestCreate: (parentId: number | null) => void
  onRequestRename: (folderId: number, currentName: string) => void
}) {
  const [folderQuery, setFolderQuery] = React.useState("")
  const [searchMenuFor, setSearchMenuFor] = React.useState<number | null>(null)
  const [expandedIds, setExpandedIds] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {}
    if (currentFolderId && currentFolderId !== "0") {
      const activeId = Number(currentFolderId)
      const findAncestors = (list: FolderNode[], path: number[] = []): boolean => {
        for (const n of list) {
          if (n.id === activeId) {
            path.forEach((pid) => { init[pid] = true })
            return true
          }
          if (n.children?.length) {
            if (findAncestors(n.children, [...path, n.id])) return true
          }
        }
        return false
      }
      findAncestors(nodes)
    }
    return init
  })

  React.useEffect(() => {
    if (currentFolderId && currentFolderId !== "0") {
      const activeId = Number(currentFolderId)
      const findAncestors = (list: FolderNode[], path: number[] = []): boolean => {
        for (const n of list) {
          if (n.id === activeId) {
            setExpandedIds((prev) => {
              const next = { ...prev }
              path.forEach((pid) => { next[pid] = true })
              return next
            })
            return true
          }
          if (n.children?.length) {
            if (findAncestors(n.children, [...path, n.id])) return true
          }
        }
        return false
      }
      findAncestors(nodes)
    }
  }, [currentFolderId, nodes])

  function handleToggleExpand(id: number) {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const flattened = React.useMemo(() => buildFlattenedFolders(nodes), [nodes])
  const searching = folderQuery.trim() !== ""
  const filtered = React.useMemo(() => {
    const q = folderQuery.trim().toLowerCase()
    if (!q) return flattened
    return flattened.filter((f) => f.path.toLowerCase().includes(q))
  }, [flattened, folderQuery])

  function submitSearchFolderAction(folderId: number, action: "rename" | "archive" | "delete", name?: string) {
    if (action === "delete") {
      router.delete(routeUrl("admin.media.folders.destroy", { folder: folderId }), {
        preserveState: true,
        onSuccess: () => {
          if (currentFolderId === String(folderId)) {
            onSelect("")
          }
        },
      })
      setSearchMenuFor(null)
      return
    }
    const fd = new FormData()
    if (action === "rename") {
      if (!name?.trim()) return
      fd.append("name", name.trim())
      router.post(routeUrl("admin.media.folders.rename", { folder: folderId }), fd, { preserveState: true })
    } else {
      router.post(routeUrl("admin.media.folders.archive", { folder: folderId }), fd, { preserveState: true })
    }
    setSearchMenuFor(null)
  }

  function createSearchSubfolder(parentId: number) {
    setSearchMenuFor(null)
    if (!expandedIds[parentId]) {
      handleToggleExpand(parentId)
    }
    window.setTimeout(() => onRequestCreate(parentId), 0)
  }

  return (
    <div className="space-y-2">
      {/* Searchbar khusus folder (cara kerja selaras dengan MediaPicker) */}
      <div className="relative shrink-0">
        <input
          type="search"
          value={folderQuery}
          onChange={(e) => setFolderQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFolderQuery("")
            }
            if (e.key === "Enter" && filtered.length > 0) {
              e.preventDefault()
              onSelect(String(filtered[0].id))
            }
          }}
          placeholder="Cari folder…"
          className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Icon
          name="search"
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        {folderQuery ? (
          <button
            type="button"
            onClick={() => setFolderQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
            aria-label="Bersihkan pencarian folder"
          >
            <Icon name="x" className="size-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {!searching ? (
        <FolderTreeList
          nodes={nodes}
          currentFolderId={currentFolderId}
          onSelect={onSelect}
          expandedIds={expandedIds}
          onToggleExpand={handleToggleExpand}
          parentId={null}
          onRequestCreate={onRequestCreate}
          onRequestRename={onRequestRename}
        />
      ) : filtered.length === 0 ? (
        <p className="px-2 py-4 text-center text-xs text-muted-foreground">Tidak ada folder yang cocok.</p>
      ) : (
        <ul className="space-y-0.5">
          {filtered.map((f) => {
            const isActive = String(f.id) === currentFolderId
            const isMenuOpen = searchMenuFor === f.id
            return (
              <li
                key={f.id}
                className={cn("group/folder relative flex items-center gap-0.5 rounded-md", isActive && "bg-primary/10")}
              >
                <button
                  type="button"
                  onClick={() => onSelect(String(f.id))}
                  style={{ paddingLeft: 6 + f.depth * 10 }}
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-1.5 rounded-md py-1.5 pr-1.5 text-left text-xs transition-colors",
                    isActive ? "text-primary font-semibold" : "text-muted-foreground hover:bg-card-hover",
                  )}
                >
                  <Icon
                    name={isActive ? "folder-open" : "folder"}
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {f.depth === 0 ? "" : "↳ "}
                      {f.name}
                    </span>
                    {f.depth > 0 ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {f.path.split(" / ").slice(0, -1).join(" / ")}
                      </span>
                    ) : null}
                  </span>
                  {f.assets_total > 0 ? (
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {f.assets_total}
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  aria-label={`Menu folder ${f.name}`}
                  title="Menu folder"
                  onClick={() => setSearchMenuFor(isMenuOpen ? null : f.id)}
                  className={cn(
                    "mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-card-hover hover:text-foreground",
                    isMenuOpen ? "opacity-100" : "opacity-0 group-hover/folder:opacity-100",
                  )}
                >
                  <Icon name="dots-three" className="size-3.5" aria-hidden="true" />
                </button>

                {isMenuOpen ? (
                  <div className="absolute right-0 top-full z-30 mt-1 w-48 space-y-0.5 rounded-lg border border-border bg-card p-1 shadow-float">
                    <button
                      type="button"
                      onClick={() => createSearchSubfolder(f.id)}
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                    >
                      Buat subfolder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchMenuFor(null)
                        window.setTimeout(() => onRequestRename(f.id, f.name), 0)
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                    >
                      Ganti nama
                    </button>
                    <ConfirmAction
                      trigger={
                        <button
                          type="button"
                          className="block w-full rounded px-2 py-1.5 text-left text-xs text-foreground hover:bg-card-hover"
                        >
                          Arsipkan
                        </button>
                      }
                      title="Arsipkan folder?"
                      description="Aset di dalamnya ikut diarsipkan."
                      confirmLabel="Arsipkan"
                      onConfirm={() => submitSearchFolderAction(f.id, "archive")}
                    />
                    <ConfirmAction
                      trigger={
                        <button
                          type="button"
                          className="block w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                        >
                          Hapus folder
                        </button>
                      }
                      title={`Hapus folder "${f.name}"?`}
                      description="Semua aset di dalam folder ini (jika ada) akan otomatis dipindahkan ke Semua Media."
                      confirmLabel="Hapus Folder"
                      onConfirm={() => submitSearchFolderAction(f.id, "delete")}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
function UploadTracker({ uploads }: { uploads: UploadItem[]; onDismiss: () => void }) {
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
  // Dialog nama folder (pengganti window.prompt yang diblokir di browser in-app).
  const [folderDialog, setFolderDialog] = React.useState<
    { mode: "create"; parentId: number | null; name: string } | { mode: "rename"; folderId: number; name: string } | null
  >(null)
  const [folderSaving, setFolderSaving] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  // Owner 2026-09-24: pemilihan massal default tidak aktif; klik kartu
  // membuka pratinjau gambar, bukan memilih. Pemilihan hanya lewat mode
  // "Pilih Media" yang dinyalakan lewat tombol di header.
  const [selectMode, setSelectMode] = React.useState(false)
  const [previewAsset, setPreviewAsset] = React.useState<(typeof assets)[number] | null>(null)
  const [showUploadModal, setShowUploadModal] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<number | null>(null)
  const [bulkMoveTarget, setBulkMoveTarget] = React.useState<string>("")

  // Upload tracking (persisten walau modal ditutup)
  const [uploads, setUploads] = React.useState<UploadItem[]>([])
  const uploadIdRef = React.useRef(0)

  /** Buat folder (root atau subfolder) memakai dialog. */
  function submitFolderDialog(name: string) {
    if (!folderDialog) return
    setFolderSaving(true)
    const fd = new FormData()
    fd.append("name", name)

    if (folderDialog.mode === "create") {
      const parentId = folderDialog.parentId
      if (parentId !== null) fd.append("parent_id", String(parentId))
      router.post(routeUrl("admin.media.folders.store"), fd, {
        preserveState: true,
        preserveScroll: true,
        onFinish: () => setFolderSaving(false),
        onSuccess: () => {
          setFolderDialog(null)
          // Muat ulang props folders agar pohon folder langsung menampilkan
          // folder baru (preserveState menahan render props baru).
          router.reload({ only: ["folders"] })
        },
      })
      return
    }

    router.post(routeUrl("admin.media.folders.rename", { folder: folderDialog.folderId }), fd, {
      preserveState: true,
      preserveScroll: true,
      onFinish: () => setFolderSaving(false),
      onSuccess: () => {
        setFolderDialog(null)
        router.reload({ only: ["folders"] })
      },
    })
  }

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

  const assetsRef = React.useRef(assets)
  React.useEffect(() => { assetsRef.current = assets }, [assets])

  // Attach
  const [attachingId, setAttachingId] = React.useState<number | null>(null)
  const [attachProduct, setAttachProduct] = React.useState("")
  const [attachQuery, setAttachQuery] = React.useState("")
  const [attachResults, setAttachResults] = React.useState<ProductOption[]>([])
  const [attachSearching, setAttachSearching] = React.useState(false)
  // Galat pencarian produk dibedakan dari "tidak ditemukan": keduanya dulu
  // berakhir sebagai daftar kosong, jadi admin tidak tahu bedanya.
  const [attachSearchError, setAttachSearchError] = React.useState(false)
  const [attachSearchNonce, setAttachSearchNonce] = React.useState(0)
  const [attachPosition, setAttachPosition] = React.useState("1")
  const [attachCatalog, setAttachCatalog] = React.useState(true)
  const [attachInstallation, setAttachInstallation] = React.useState(false)
  const [attachVisibility] = React.useState("visible")
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
      setAttachSearchError(false)
      fetch(`${routeUrl("admin.media.products.search")}?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((b) => setAttachResults(b.products ?? []))
        .catch(() => {
          setAttachResults([])
          setAttachSearchError(true)
        })
        .finally(() => setAttachSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [attachQuery, attachingId, attachSearchNonce])

  React.useEffect(() => {
    if (!previewAsset) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewAsset(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [previewAsset])

  function toggleSelected(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Pilihan berlaku untuk halaman aktif saja. Saat daftar berganti (pindah
  // halaman atau ganti filter), id dari halaman sebelumnya dibuang supaya
  // aksi massal tidak pernah menyentuh item yang tidak terlihat.
  const pageAssetIds = React.useMemo(() => assets.map((a) => a.id), [assets])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds((prev) => {
      const kept = prev.filter((id) => pageAssetIds.includes(id))
      return kept.length === prev.length ? prev : kept
    })
  }, [pageAssetIds])

  const allOnPageSelected =
    pageAssetIds.length > 0 && pageAssetIds.every((id) => selectedIds.includes(id))
  const someOnPageSelected = selectedIds.some((id) => pageAssetIds.includes(id))

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
          <Button
            type="button"
            variant={selectMode ? "secondary" : "outline"}
            onClick={() => {
              setSelectMode((v) => {
                if (v) setSelectedIds([])
                return !v
              })
            }}
          >
            {selectMode ? (
              <Icon name="check" className="size-4" aria-hidden="true" />
            ) : (
              <Icon name="selection" className="size-4" aria-hidden="true" />
            )}
            {selectMode ? "Selesai" : "Pilih Media"}
          </Button>
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

      <div className="flex min-w-0 max-w-full gap-4 overflow-hidden">
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
              onClick={() =>
                setFolderDialog({
                  mode: "create",
                  parentId: folderId && folderId !== "0" ? Number(folderId) : null,
                  name: "",
                })
              }
              className="text-xs font-medium text-primary hover:underline"
            >
              + Baru
            </button>
          </div>
          <FolderTree
            nodes={folders}
            currentFolderId={folderId}
            onSelect={(id) => { setFolderId(id); runSearch({ folder_id: id }) }}
            onRequestCreate={(parentId) => setFolderDialog({ mode: "create", parentId, name: "" })}
            onRequestRename={(id, currentName) => setFolderDialog({ mode: "rename", folderId: id, name: currentName })}
          />
        </aside>
        ) : null}

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
            <div className="min-w-0 flex-1">
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

          {/* Pilih semua pada halaman aktif. Kotak centang ini menyatakan
              keadaan halaman sekarang: penuh bila semua kartu terpilih,
              setengah bila sebagian. Hitungan terpilih selalu ditampilkan. */}
          {selectMode && assets.length > 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border accent-primary"
                  checked={allOnPageSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someOnPageSelected && !allOnPageSelected
                  }}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageAssetIds])))
                    } else {
                      setSelectedIds((prev) => prev.filter((id) => !pageAssetIds.includes(id)))
                    }
                  }}
                  aria-label="Pilih semua media di halaman ini"
                />
                Pilih semua di halaman ini
              </label>
              <span className="text-xs text-muted-foreground" role="status">
                <span className="tabular-nums font-semibold text-foreground">{selectedIds.length}</span>{" "}
                dipilih dari {assets.length} media di halaman ini
              </span>
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
                  role={selectMode ? "checkbox" : "button"}
                  aria-checked={selectMode ? selectedIds.includes(asset.id) : undefined}
                  aria-label={selectMode ? `Pilih ${asset.label}` : `Lihat pratinjau ${asset.label}`}
                  tabIndex={0}
                  onClick={(e) => {
                    // Tombol/link di dalam card tetap berfungsi normal.
                    const target = e.target as HTMLElement
                    if (target.closest('button, a, input, [data-no-select]')) return
                    if (selectMode) toggleSelected(asset.id)
                    else setPreviewAsset(asset)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      const target = e.target as HTMLElement
                      if (target.closest('button, a, input, [data-no-select]')) return
                      e.preventDefault()
                      if (selectMode) toggleSelected(asset.id)
                      else setPreviewAsset(asset)
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
                      className={`absolute bottom-1.5 left-1.5 size-3 rounded-full ${
                        asset.status === "ready" ? "bg-success"
                          : asset.status === "failed" ? "bg-destructive"
                          : asset.status === "archived" ? "bg-muted-foreground"
                          : "bg-warning"
                      }`}
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
                    {selectMode ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(asset.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelected(asset.id)}
                        className="absolute left-1.5 top-1.5 size-4 rounded border-border accent-primary"
                        aria-label={`Pilih ${asset.label}`}
                      />
                    ) : null}
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
              ) : attachSearchError ? (
                <ErrorState
                  title="Pencarian produk gagal"
                  description="Daftar produk belum dapat dimuat. Periksa koneksi lalu coba lagi."
                  className="min-h-0 p-4"
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAttachSearchNonce((n) => n + 1)}
                    >
                      Coba lagi
                    </Button>
                  }
                />
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

      {previewAsset ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau ${previewAsset.label}`}
          onClick={() => setPreviewAsset(null)}
        >
          <div className="max-h-full w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium text-white">{previewAsset.label}</p>
              <button
                type="button"
                onClick={() => setPreviewAsset(null)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Tutup pratinjau"
              >
                <Icon name="x" className="size-4" aria-hidden="true" />
              </button>
            </div>
            {previewAsset.kind === "video" ? (
              <video
                src={previewAsset.media_url ?? previewAsset.public_url}
                controls
                autoPlay
                className="max-h-[75vh] w-full rounded-lg bg-black object-contain"
              />
            ) : (
              <img
                src={previewAsset.public_url}
                alt={previewAsset.label}
                className="max-h-[75vh] w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      ) : null}

      <FolderNameDialog
        mode={folderDialog?.mode ?? "create"}
        open={folderDialog !== null}
        initialName={folderDialog?.name ?? ""}
        processing={folderSaving}
        onClose={() => setFolderDialog(null)}
        onSubmit={submitFolderDialog}
      />
    </AdminLayout>
  )
}