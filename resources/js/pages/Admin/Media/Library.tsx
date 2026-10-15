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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Pagination } from "@/components/admin/ui/pagination"
import { ProductPicker } from "@/components/admin/ui/ProductPicker"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import {
  adaUnggahanBerjalan,
  mulaiUnggah,
  snapshotUnggahan,
  subscribeUnggahan,
  type UploadItem,
} from "@/lib/media-upload-queue"
import { saringBerkasMedia } from "@/lib/media-upload-filter"
import type { Pagination as PaginationData, SharedPageProps } from "@/types"

// --- Status mapper media khusus (bukan shipping) ---
// Preferensi tampilan Media Library diingat per peramban. localStorage bisa
// diblokir; kalau gagal, nilai bawaan tetap dipakai untuk sesi ini.
const FOLDER_SIDEBAR_KEY = "ragil.admin.mediaLibrary.folderSidebar"
const FOLDER_EXPANDED_KEY = "ragil.admin.mediaLibrary.folderExpanded"

const MEDIA_STATUS_META: Record<string, { label: string; tone: "neutral" | "info" | "success" | "danger" | "warning" }> = {
  pending:    { label: "Menunggu diproses", tone: "neutral" },
  uploading:  { label: "Sedang diunggah",   tone: "info" },
  downloading:{ label: "Mengambil media",   tone: "info" },
  processing: { label: "Sedang diproses",   tone: "info" },
  ready:      { label: "Siap digunakan",    tone: "success" },
  failed:     { label: "Gagal diproses",    tone: "danger" },
  archived:   { label: "Diarsipkan",         tone: "neutral" },
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

/** Nilai bawaan stabil: literal array di daftar argumen dibuat ulang tiap render. */
const TANPA_NIAT: UploadIntentRow[] = []

/**
 * Niat unggah yang dicatat server sebelum berkas dikirim.
 *
 * Baris `failed` dan `disconnected` adalah yang penting di layar: keduanya
 * berarti berkas itu belum masuk dan perlu diunggah ulang. Baris `uploading`
 * sengaja tidak ditampilkan karena masih bisa selesai.
 */
interface UploadIntentRow {
  id: number
  file_name: string
  status: "uploading" | "done" | "failed" | "disconnected"
  error_reason: string | null
  created_at: string
}

interface LibraryFilters {
  q: string
  kind: string
  status: string
  visibility: string
  folder_id: string
}

/** Nama folder aset untuk info singkat; Inbox untuk tanpa folder. */
function folderNama(folderId: number | null, folders: FolderNode[]): string {
  if (folderId === null) return "Inbox (tanpa folder)"
  const temukan = (nodes: FolderNode[]): string | null => {
    for (const node of nodes) {
      if (node.id === folderId) return node.name
      const dalam = temukan(node.children)
      if (dalam) return dalam
    }
    return null
  }
  return temukan(folders) ?? `Folder #${folderId}`
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
  inlineCreatingParentId,
  onRequestInlineCreate,
  onCancelInlineCreate,
  onRequestRename,
}: {
  nodes: FolderNode[]
  currentFolderId: string
  onSelect: (id: string) => void
  expandedIds: Record<number, boolean>
  onToggleExpand: (id: number) => void
  /** Parent dari level ini; null = folder root. Dipakai untuk reorder sibling. */
  parentId: number | null
  /** ID folder parent yang sedang membuat subfolder inline. */
  inlineCreatingParentId?: number | null
  /** Aktifkan form inline untuk menambah subfolder baru ke parentId. */
  onRequestInlineCreate?: (parentId: number) => void
  /** Batalkan form inline. */
  onCancelInlineCreate?: () => void
  /** Buka dialog ubah nama folder. */
  onRequestRename: (folderId: number, currentName: string) => void
}) {
  const [menuFor, setMenuFor] = React.useState<number | null>(null)
  const [order, setOrder] = React.useState<FolderNode[]>(nodes)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [dragTarget, setDragTarget] = React.useState<number | null>(null)
  const [inlineName, setInlineName] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const isInlineOpen = parentId !== null && inlineCreatingParentId === parentId
  const menuContainerRef = React.useRef<HTMLDivElement | null>(null)

  function submitInline() {
    const nama = inlineName.trim()
    if (!nama || isSubmitting || parentId === null) return
    const parentUntukMasuk = parentId
    setIsSubmitting(true)
    const fd = new FormData()
    fd.append("name", nama)
    fd.append("parent_id", String(parentUntukMasuk))
    router.post(routeUrl("admin.media.folders.store"), fd, {
      preserveState: true,
      preserveScroll: true,
      onFinish: () => setIsSubmitting(false),
      onSuccess: () => {
        setInlineName("")
        onCancelInlineCreate?.()
        // Muat ulang daftar folder, lalu LANGSUNG MASUK ke folder baru
        // (permintaan owner 15 Okt 2026) supaya tidak perlu diklik lagi.
        router.reload({
          only: ["folders"],
          onSuccess: (page) => {
            const daftar =
              ((page as unknown as { props?: { folders?: FolderNode[] } }).props?.folders) ?? []

            const cariAnak = (list: FolderNode[]): FolderNode | null => {
              for (const node of list) {
                if (node.id === parentUntukMasuk) {
                  return (node.children ?? []).find((anak) => anak.name === nama) ?? null
                }
                const dalam = cariAnak(node.children ?? [])
                if (dalam !== null) return dalam
              }
              return null
            }

            const folderBaru = cariAnak(daftar)
            if (folderBaru === null) return
            // Perluas parent agar folder baru terlihat, lalu pilih folder itu.
            if (!expandedIds[parentUntukMasuk]) onToggleExpand(parentUntukMasuk)
            onSelect(String(folderBaru.id))
          },
        })
      },
    })
  }

  function cancelInline() {
    setInlineName("")
    onCancelInlineCreate?.()
  }

  React.useEffect(() => {
    if (menuFor === null) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Element | null
      if (!target) return
      if (target.closest("[role=\"dialog\"]") || target.closest("[data-radix-portal]")) {
        return
      }
      if (menuContainerRef.current && !menuContainerRef.current.contains(target)) {
        setMenuFor(null)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!document.querySelector("[role=\"dialog\"]")) {
          setMenuFor(null)
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [menuFor])

  // Daftar folder dari server disalin ke urutan lokal saat props berubah.
  // Disesuaikan saat render, bukan lewat effect.
  const [syncedNodes, setSyncedNodes] = React.useState(nodes)
  if (syncedNodes !== nodes) {
    setSyncedNodes(nodes)
    setOrder(nodes)
  }

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

  function submitFolderAction(
    folderId: number,
    action: "rename" | "archive" | "delete",
    name?: string,
    withAssets = false,
  ) {
    if (action === "delete") {
      const url = routeUrl("admin.media.folders.destroy", { folder: folderId })
      router.delete(withAssets ? `${url}?with_assets=1` : url, {
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

  function createSubfolder(folderId: number) {
    setMenuFor(null)
    if (!expandedIds[folderId]) {
      onToggleExpand(folderId)
    }
    onRequestInlineCreate?.(folderId)
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

              <div ref={isOpen ? menuContainerRef : null} className="relative mr-1 flex shrink-0 items-center self-stretch">
                <button
                  type="button"
                  aria-label={`Menu folder ${node.name}`}
                  title="Menu folder"
                  onClick={() => setMenuFor(isOpen ? null : node.id)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-card-hover hover:text-foreground",
                    isOpen ? "opacity-100" : "opacity-0 group-hover/folder:opacity-100",
                  )}
                >
                  <Icon name="dots-three" className="size-3.5" aria-hidden="true" />
                </button>

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
                      description="Pilih caranya: hapus foldernya saja dengan isi dipindahkan ke Semua Media, atau hapus folder sekaligus isinya."
                      confirmLabel="Hapus Folder & Isi"
                      onConfirm={() => submitFolderAction(node.id, "delete", undefined, true)}
                      secondaryAction={{
                        label: "Hapus Foldernya Saja",
                        onConfirm: () => submitFolderAction(node.id, "delete"),
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {((hasChildren || inlineCreatingParentId === node.id) && isExpanded) ? (
              <div className="ml-2.5 border-l border-border pl-2">
                <FolderTreeList
                  nodes={node.children}
                  currentFolderId={currentFolderId}
                  onSelect={onSelect}
                  expandedIds={expandedIds}
                  onToggleExpand={onToggleExpand}
                  parentId={node.id}
                  inlineCreatingParentId={inlineCreatingParentId}
                  onRequestInlineCreate={onRequestInlineCreate}
                  onCancelInlineCreate={onCancelInlineCreate}
                  onRequestRename={onRequestRename}
                />
              </div>
            ) : null}
          </li>
        )
      })}
      {/* Inline Form atau Tombol + di bawah subfolder terakhir */}
      {parentId !== null ? (
        isInlineOpen ? (
          <li className="flex items-center py-0.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-primary bg-surface px-2 py-1 shadow-xs">
              <Icon name="folder" className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <input
                type="text"
                value={inlineName}
                onChange={(e) => setInlineName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    submitInline()
                  } else if (e.key === "Escape") {
                    e.preventDefault()
                    cancelInline()
                  }
                }}
                onBlur={() => {
                  if (!inlineName.trim() && !isSubmitting) {
                    cancelInline()
                  }
                }}
                disabled={isSubmitting}
                placeholder="Nama subfolder…"
                className="h-6 w-full min-w-0 bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
            </div>
          </li>
        ) : (
          <li className="flex items-center py-0.5 pl-5">
            <button
              type="button"
              onClick={() => onRequestInlineCreate?.(parentId)}
              className="flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-card-hover hover:text-primary"
              title="Tambah subfolder baru"
              aria-label="Tambah subfolder"
            >
              <Icon name="plus" className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        )
      ) : null}
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

  // Isian direset saat dialog dibuka atau nama awalnya berganti.
  // Disesuaikan saat render, bukan lewat effect.
  const dialogKey = open ? (initialName ?? "") : null
  const [syncedDialogKey, setSyncedDialogKey] = React.useState<string | null>(dialogKey)
  if (dialogKey !== syncedDialogKey) {
    setSyncedDialogKey(dialogKey)
    if (open) setValue(initialName)
  }

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
  path: string
  node: FolderNode
}

function buildFlattenedFolders(nodes: FolderNode[]): FlattenedFolderNode[] {
  const out: FlattenedFolderNode[] = []

  // Angka folder dari server sudah memuat isi subfolder, satu aturan dengan
  // daftar galeri. Karena itu di sini TIDAK dijumlahkan lagi: menambahkan
  // anak-anaknya akan menghitung isi subfolder dua kali.
  function traverse(list: FolderNode[], depth: number, parentPath: string): void {
    for (const item of list) {
      const path = depth === 0 ? item.name : `${parentPath} / ${item.name}`
      out.push({
        id: item.id,
        name: item.name,
        depth,
        assets_count: item.assets_count ?? 0,
        path,
        node: item,
      })
      traverse(item.children || [], depth + 1, path)
    }
  }

  traverse(nodes, 0, "")
  return out
}

function FolderTree({
  nodes,
  currentFolderId,
  onSelect,
  onRequestCreate: _onRequestCreate,
  onRequestRename,
}: {
  nodes: FolderNode[]
  currentFolderId: string
  onSelect: (id: string) => void
  onRequestCreate: (parentId: number | null) => void
  onRequestRename: (folderId: number, currentName: string) => void
}) {
  const [folderQuery, setFolderQuery] = React.useState("")
  const [inlineCreatingParentId, setInlineCreatingParentId] = React.useState<number | null>(null)
  const [searchMenuFor, setSearchMenuFor] = React.useState<number | null>(null)
  const searchMenuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (searchMenuFor === null) return

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Element | null
      if (!target) return
      if (target.closest("[role=\"dialog\"]") || target.closest("[data-radix-portal]")) {
        return
      }
      if (searchMenuRef.current && !searchMenuRef.current.contains(target)) {
        setSearchMenuFor(null)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!document.querySelector("[role=\"dialog\"]")) {
          setSearchMenuFor(null)
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [searchMenuFor])
  const [expandedIds, setExpandedIds] = React.useState<Record<number, boolean>>(() => {
    let saved: Record<number, boolean> = {}
    try {
      const raw = window.localStorage.getItem(FOLDER_EXPANDED_KEY)
      if (raw) saved = JSON.parse(raw) as Record<number, boolean>
    } catch {
      saved = {}
    }
    const init: Record<number, boolean> = { ...saved }
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
    try {
      window.localStorage.setItem(FOLDER_EXPANDED_KEY, JSON.stringify(expandedIds))
    } catch {
      // localStorage bisa diblokir; status tetap berlaku untuk sesi ini.
    }
  }, [expandedIds])

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

  function submitSearchFolderAction(
    folderId: number,
    action: "rename" | "archive" | "delete",
    name?: string,
    withAssets = false,
  ) {
    if (action === "delete") {
      const url = routeUrl("admin.media.folders.destroy", { folder: folderId })
      router.delete(withAssets ? `${url}?with_assets=1` : url, {
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
    setFolderQuery("")
    if (!expandedIds[parentId]) {
      handleToggleExpand(parentId)
    }
    setInlineCreatingParentId(parentId)
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
          className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/20 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
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
          inlineCreatingParentId={inlineCreatingParentId}
          onRequestInlineCreate={(pId) => setInlineCreatingParentId(pId)}
          onCancelInlineCreate={() => setInlineCreatingParentId(null)}
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
                  {f.assets_count > 0 ? (
                    <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {f.assets_count}
                    </span>
                  ) : null}
                </button>

                <div ref={isMenuOpen ? searchMenuRef : null} className="relative mr-1 flex shrink-0 items-center self-stretch">
                  <button
                    type="button"
                    aria-label={`Menu folder ${f.name}`}
                    title="Menu folder"
                    onClick={() => setSearchMenuFor(isMenuOpen ? null : f.id)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-card-hover hover:text-foreground",
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
                        description="Pilih caranya: hapus foldernya saja dengan isi dipindahkan ke Semua Media, atau hapus folder sekaligus isinya."
                        confirmLabel="Hapus Folder & Isi"
                        onConfirm={() => submitSearchFolderAction(f.id, "delete", undefined, true)}
                        secondaryAction={{
                          label: "Hapus Foldernya Saja",
                          onConfirm: () => submitSearchFolderAction(f.id, "delete"),
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// --- Upload preview modal ---
// Tipe UploadItem dan antrean unggahnya ada di "@/lib/media-upload-queue",
// karena keadaannya harus bertahan lintas halaman.

function UploadModal({ open, onClose, folderId, uploads, onStart }: {
  open: boolean
  onClose: () => void
  folderId: string | null
  uploads: UploadItem[]
  onStart: (files: File[]) => void
}) {
  const [mode, setMode] = React.useState<"file" | "folder" | "url">("file")
  const [files, setFiles] = React.useState<File[]>([])
  // Berkas sistem / bukan media yang dibuang saat pemilihan, ditampilkan
  // sebagai pemberitahuan supaya admin tahu kenapa jumlahnya berkurang.
  const [dilewatiSaatPilih, setDilewatiSaatPilih] = React.useState<string[]>([])
  const [url, setUrl] = React.useState("")
  const [urlResult, setUrlResult] = React.useState<{ name: string; status: string; error?: string } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { csrf } = usePage<SharedPageProps>().props
  const uploading = uploads.filter((u) => u.status === "uploading" || u.status === "memeriksa").length

  const reset = () => { setFiles([]); setUrl(""); setUrlResult(null); setDilewatiSaatPilih([]) }

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
      {/* Susunan bertingkat: kepala dan kaki tetap, dan SATU area gulir di
          tengah yang mengisi seluruh tinggi tersisa. Sebelumnya daftar berkas
          dikurung kotak setinggi 160 px di dalam wadah yang juga bisa
          menggulir, sehingga pada berkas banyak hanya beberapa baris yang
          tampak dan gulirnya membingungkan. Sekarang daftar berkas memakai
          tinggi penuh popup, sama sebelum maupun saat unggahan berjalan. */}
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-surface shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold">Unggah Media</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Tutup jendela unggah"
          >
            <Icon name="x" className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Pemilih mode dan pemilih berkas tidak ikut tergulir: keduanya
            dipakai sekali di awal, jadi lebih baik selalu terlihat. */}
        <div className="shrink-0 space-y-3 border-b border-border px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {(["file", "folder", "url"] as const).map((m) => (
              <Button key={m} type="button" variant={mode === m ? "primary" : "secondary"} size="sm" onClick={() => { setMode(m); reset() }}>
                {m === "file" ? "Pilih File" : m === "folder" ? "Unggah Folder" : "Dari URL"}
              </Button>
            ))}
          </div>

          {mode !== "url" ? (
            <div className="flex flex-wrap items-center gap-2">
              {/* Input berkas asli disembunyikan. Tombol bawaan peramban menolak
                  transform, bayangan, dan opacity, jadi tidak bisa diberi animasi
                  tekan; karena itu pemicunya tombol admin sungguhan. */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                {...(mode === "folder"
                  ? ({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)
                  : {})}
                accept="image/*,video/*"
                className="sr-only"
                onChange={(e) => {
                  // Pemilih folder mengabaikan `accept`, jadi berkas sistem ikut
                  // terbawa dan harus dibuang di sini, bukan dibiarkan ditolak
                  // server dengan pesan yang membingungkan.
                  const { diterima, dilewati } = saringBerkasMedia(Array.from(e.target.files ?? []))
                  setFiles(diterima)
                  setDilewatiSaatPilih(dilewati.map((f) => f.name))
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="active:scale-[0.97] active:bg-muted"
                onClick={() => fileInputRef.current?.click()}
              >
                <Icon name="upload" className="size-4" aria-hidden="true" />
                {mode === "folder" ? "Pilih Folder" : "Pilih Berkas"}
              </Button>
              <span className="text-[13px] text-muted-foreground">
                {files.length > 0 ? files.length + " berkas dipilih" : "Belum ada berkas dipilih"}
              </span>
            </div>
          ) : (
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
          )}
        </div>

        {/* Area gulir tunggal. overscroll-contain menahan gulir di sini supaya
            halaman di belakang tidak ikut bergerak saat daftar mencapai ujung. */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          {mode !== "url" && dilewatiSaatPilih.length > 0 ? (
            <div className="rounded border border-border bg-muted/40 p-2 text-xs text-muted-foreground" role="status">
              <span className="font-medium text-foreground">
                {dilewatiSaatPilih.length} berkas sistem dilewati:
              </span>{" "}
              {dilewatiSaatPilih.join(", ")}
              <span className="mt-0.5 block text-[11px]">
                Berkas seperti Thumbs.db dan desktop.ini dibuat sistem operasi, bukan foto produk.
              </span>
            </div>
          ) : null}

          {mode !== "url" && files.length > 0 ? (
            <div className="rounded border border-border p-2 text-xs">
              {files.map((f) => (
                <div key={f.name} className="flex items-center justify-between py-0.5">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                </div>
              ))}
            </div>
          ) : null}

          {mode !== "url" && uploads.length > 0 ? (
            <div className="rounded border border-border p-2 text-xs">
              {uploads.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-0.5">
                  <span className="truncate">{r.name}</span>
                  {r.status === "memeriksa" ? (
                    <span className="shrink-0 text-muted-foreground">memeriksa…</span>
                  ) : r.status === "uploading" ? (
                    <span className="flex w-28 shrink-0 items-center gap-1.5">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <span className="block h-full rounded-full bg-primary transition-all duration-150" style={{ width: `${r.progress}%` }} />
                      </span>
                      <span className="tabular-nums text-muted-foreground">{r.progress}%</span>
                    </span>
                  ) : r.status === "ditolak" ? (
                    <span className="shrink-0 text-muted-foreground">kembar</span>
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
            <div className={cn("rounded border border-border p-2 text-xs", urlResult.status === "sukses" ? "text-success" : urlResult.status === "gagal" ? "text-destructive" : "text-muted-foreground")}>
              {urlResult.status === "uploading" ? "Mengambil URL…" : urlResult.status === "sukses" ? "✓ Media berhasil ditambahkan" : `✗ ${urlResult.error ?? "Gagal"}`}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3">
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
  assets, pagination, filters, folders, historyHref, backUrl, origin, uploadIntents = TANPA_NIAT,
}: {
  assets: LibraryAsset[]
  pagination: PaginationData | null
  filters: LibraryFilters
  folders: FolderNode[]
  historyHref: string
  backUrl?: string | null
  /** Penanda asal halaman ("products" bila dibuka dari halaman Produk). */
  origin?: string | null
  /** Niat unggah yang belum selesai (gagal/terputus) dari sesi sebelumnya. */
  uploadIntents?: UploadIntentRow[]
}) {
  const { csrf } = usePage<SharedPageProps>().props
  // Dulu berkas seperti ini hilang tanpa jejak ketika tab ditutup di tengah
  // unggahan; sekarang server menyimpannya sampai admin menyatakan mengerti.
  const [intentDibuang, setIntentDibuang] = React.useState<number[]>([])
  const intentTertinggal = uploadIntents.filter((it) => !intentDibuang.includes(it.id))
  const [q, setQ] = React.useState(filters.q)
  const [kind, setKind] = React.useState(filters.kind)
  const [status, setStatus] = React.useState(filters.status)
  const [visibility, setVisibility] = React.useState(filters.visibility)
  const [folderId, setFolderId] = React.useState(filters.folder_id)
  const [showSidebar, setShowSidebar] = React.useState(() => {
    try {
      return window.localStorage.getItem(FOLDER_SIDEBAR_KEY) !== "0"
    } catch {
      return true
    }
  })
  // Dialog nama folder (pengganti window.prompt yang diblokir di browser in-app).
  const [folderDialog, setFolderDialog] = React.useState<
    { mode: "create"; parentId: number | null; name: string } | { mode: "rename"; folderId: number; name: string } | null
  >(null)
  const [folderSaving, setFolderSaving] = React.useState(false)
  const [selectedIds, setSelectedIds] = React.useState<number[]>([])
  // Mode pilih aktif jika tombol teks 'Pilih' ditekan (mirip Cart).
  const [selectMode, setSelectMode] = React.useState(false)
  const [previewAsset, setPreviewAsset] = React.useState<(typeof assets)[number] | null>(null)
  // Aset yang info singkatnya (detail) sedang terbuka.
  const [infoAsset, setInfoAsset] = React.useState<(typeof assets)[number] | null>(null)
  const [deletingAsset, setDeletingAsset] = React.useState<(typeof assets)[number] | null>(null)
  const [showUploadModal, setShowUploadModal] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<number | null>(null)
  const [bulkMoveTarget, setBulkMoveTarget] = React.useState<string>("")

  // Antrean unggah hidup di TINGKAT MODUL (lib/media-upload-queue), bukan di
  // dalam halaman ini. Dua akibatnya: unggahan tetap berjalan walau admin
  // berpindah halaman, dan panel progress-nya tetap ada karena dipasang sekali
  // di shell admin, bukan di sini.
  const { items: uploadItems } = React.useSyncExternalStore(
    subscribeUnggahan,
    snapshotUnggahan,
    snapshotUnggahan,
  )
  const adaBerjalan = adaUnggahanBerjalan(uploadItems)

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

  /** Serahkan berkas terpilih ke antrean unggah tingkat modul. */
  function mulaiDariModal(files: File[]): void {
    void mulaiUnggah({ files, folderId: folderId || null, csrf })
  }

  const assetsRef = React.useRef(assets)
  React.useEffect(() => { assetsRef.current = assets }, [assets])

  // Attach
  const [attachingId, setAttachingId] = React.useState<number | null>(null)
  const [attachProduct, setAttachProduct] = React.useState("")
  // Nama produk terpilih, ditampilkan sebagai penanda di modal.
  const [attachLabel, setAttachLabel] = React.useState("")
  const [attachPosition, setAttachPosition] = React.useState("1")
  const [attachCatalog, setAttachCatalog] = React.useState(true)
  const [attachInstallation, setAttachInstallation] = React.useState(false)
  const [attachVisibility] = React.useState("visible")
  const [attachBusy, setAttachBusy] = React.useState(false)
  const [attachError, setAttachError] = React.useState<string | null>(null)
  const [attachVariant, setAttachVariant] = React.useState("")
  const [attachVariantOptions, setAttachVariantOptions] = React.useState<{ id: number; sku: string; label: string }[]>([])
  const [attachExisting, setAttachExisting] = React.useState<{ product_variant_id: number | null; position: number; is_installation: boolean; show_in_catalog: boolean }[]>([])
  const attachExistingRow = attachExisting.find(
    (row) => (row.product_variant_id ?? null) === (attachVariant ? Number(attachVariant) : null) && row.is_installation === attachInstallation,
  ) ?? null

  const runSearch = React.useCallback((overrides: Partial<LibraryFilters> = {}) => {
    router.get(
      routeUrl("admin.media.library"),
      {
        q: overrides.q ?? (q || undefined),
        kind: overrides.kind ?? (kind || undefined),
        status: overrides.status ?? (status || undefined),
        visibility: overrides.visibility ?? (visibility || undefined),
        folder_id: overrides.folder_id ?? (folderId || undefined),
        origin: origin ?? undefined,
      },
      { preserveState: true, preserveScroll: true },
    )
  }, [q, kind, status, visibility, folderId, origin])

  // Segarkan daftar begitu seluruh unggahan selesai, supaya aset baru muncul.
  // Berguna juga saat unggahan dimulai sebelum berpindah halaman: begitu admin
  // kembali dan unggahannya selesai, daftarnya menyesuaikan sendiri.
  const sebelumnyaBerjalan = React.useRef(false)
  React.useEffect(() => {
    if (sebelumnyaBerjalan.current && !adaBerjalan) runSearch()
    sebelumnyaBerjalan.current = adaBerjalan
  }, [adaBerjalan, runSearch])

  /** Buang pemberitahuan berkas yang tidak selesai diunggah. */
  function bersihkanPemberitahuan(): void {
    const ids = intentTertinggal.map((it) => it.id)
    if (ids.length === 0) return
    setIntentDibuang((prev) => [...prev, ...ids])
    router.post(routeUrl("admin.media.upload-intents.dismiss"), { ids }, { preserveScroll: true })
  }

  React.useEffect(() => {
    try {
      window.localStorage.setItem(FOLDER_SIDEBAR_KEY, showSidebar ? "1" : "0")
    } catch {
      // localStorage bisa diblokir; status tetap berlaku untuk sesi ini.
    }
  }, [showSidebar])

  const skipFirst = React.useRef(true)
  React.useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return }
    const timer = window.setTimeout(() => runSearch(), 350)
    return () => window.clearTimeout(timer)
  }, [q, runSearch])

  React.useEffect(() => {
    if (!previewAsset) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewAsset(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [previewAsset])

  // Popup "Pasang ke produk" mengikuti konvensi modal halaman ini: Escape
  // menutup. Sebelumnya hanya klik latar atau tombol Batal yang bisa menutup.
  React.useEffect(() => {
    if (attachingId === null) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAttachingId(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [attachingId])

  // "Pilih semua" berlaku untuk SELURUH folder + filter aktif, bukan hanya
  // halaman yang sedang tampil. Karena sasarannya bisa lebih dari satu halaman,
  // pilihan disimpan sebagai penanda `selectAllScope` dan diselesaikan di server
  // (parameter `scope_all`), bukan dengan mengirim daftar id.
  const [selectAllScope, setSelectAllScope] = React.useState(false)
  const totalInScope = pagination?.total ?? assets.length
  const selectedCount = selectAllScope ? totalInScope : selectedIds.length
  const hasSelection = selectedCount > 0
  const isSelected = (assetId: number) => selectAllScope || selectedIds.includes(assetId)

  function toggleSelected(id: number) {
    // Saat "Pilih semua" menyala, memilih satu kartu berarti admin ingin memilih
    // sendiri, jadi penanda "semua" dimatikan lebih dulu. Dengan begitu yang
    // dikirim ke server tidak pernah mencampur dua maksud sekaligus.
    if (selectAllScope) {
      setSelectAllScope(false)
      setSelectedIds([id])
      return
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function clearSelection() {
    setSelectAllScope(false)
    setSelectedIds([])
  }

  function cancelSelectMode() {
    clearSelection()
    setSelectMode(false)
  }

  /** Filter aktif, ikut dikirim saat sasaran aksi adalah "semua". */
  function scopeParams(): Record<string, string> {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (kind) params.kind = kind
    if (status) params.status = status
    if (visibility) params.visibility = visibility
    // Folder asal dikirim dengan nama khusus: pada endpoint pindah, `folder_id`
    // berarti TUJUAN, jadi memakai nama yang sama akan menyesatkan filter.
    if (folderId) params.scope_folder_id = folderId
    return params
  }

  /** Isi FormData aksi massal: daftar id eksplisit ATAU penanda "semua". */
  function isiSasaran(form: FormData) {
    if (selectAllScope) {
      form.append("scope_all", "1")
      Object.entries(scopeParams()).forEach(([key, value]) => form.append(key, value))
      return
    }
    selectedIds.forEach((id) => form.append("asset_ids[]", String(id)))
  }

  function runBulkAction(action: "archive" | "delete" | "restore", overrideIds?: number[]) {
    const form = new FormData()
    form.append("action", action)
    if (overrideIds && overrideIds.length > 0) {
      overrideIds.forEach((id) => form.append("asset_ids[]", String(id)))
    } else {
      isiSasaran(form)
    }
    router.post(routeUrl("admin.media.bulk-action"), form, {
      preserveState: true,
      onSuccess: () => {
        if (!overrideIds) clearSelection()
        setDeletingAsset(null)
      },
    })
  }

  async function bulkMove() {
    if (!bulkMoveTarget) return
    const form = new FormData()
    form.append("folder_id", bulkMoveTarget)
    isiSasaran(form)
    router.post(routeUrl("admin.media.folders.move-assets"), form, { preserveState: true, onSuccess: () => { clearSelection(); setBulkMoveTarget("") } })
  }

  async function handleCopyUrl(asset: LibraryAsset) {
    const ok = await copyText(asset.public_url)
    if (ok) { setCopiedId(asset.id); setTimeout(() => setCopiedId(null), 2000) }
  }

  return (
    <AdminLayout
      title="Media Library"
      backUrl={backUrl}
      description="Semua aset media bersama: folder, unggah, salin URL, dan pasang ke produk/banner."
      actions={
        <Button type="button" onClick={() => setShowUploadModal(true)}>
          <Icon name="upload" className="size-4" aria-hidden="true" /> Unggah Media
        </Button>
      }
    >
      <Head title="Media Library | Admin" />

      {/* Berkas dari sesi sebelumnya yang tidak selesai terkirim. Ditampilkan
          supaya admin tahu berkas mana yang perlu diunggah ulang, alih-alih
          kehilangan jejaknya saat tab ditutup di tengah unggahan. */}
      {intentTertinggal.length > 0 ? (
        <div
          className="mb-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs"
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {intentTertinggal.length} berkas tidak selesai diunggah
              </p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {intentTertinggal.slice(0, 5).map((it) => (
                  <li key={it.id} className="truncate" title={it.error_reason ?? ""}>
                    {it.file_name}
                    {it.status === "disconnected" ? " · terputus" : ""}
                  </li>
                ))}
                {intentTertinggal.length > 5 ? (
                  <li>dan {intentTertinggal.length - 5} berkas lain</li>
                ) : null}
              </ul>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={bersihkanPemberitahuan}>
              Mengerti
            </Button>
          </div>
        </div>
      ) : null}

      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        folderId={folderId || null}
        uploads={uploadItems}
        onStart={mulaiDariModal}
      />

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

      <div className="flex min-w-0 max-w-full gap-4 overflow-x-clip">
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
                  parentId: null,
                  name: "",
                })
              }
              className="text-xs font-medium text-primary hover:underline"
              title="Tambah folder utama"
            >
              + Tambah
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

          {/* Tombol teks Pilih (mirip di Cart), aktifkan mode pilih dan munculkan panel */}
          {!selectMode && assets.length > 0 ? (
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="text-xs font-semibold text-primary transition hover:opacity-80"
              >
                Pilih
              </button>
            </div>
          ) : null}

          {/* Panel toolbar aksi: hanya muncul jika tombol 'Pilih' ditekan */}
          {selectMode ? (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 px-3">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-foreground">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-border accent-primary"
                    checked={selectAllScope}
                    ref={(node) => {
                      if (node) node.indeterminate = !selectAllScope && selectedIds.length > 0
                    }}
                    disabled={totalInScope === 0}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectAllScope(true)
                        setSelectedIds([])
                      } else {
                        clearSelection()
                      }
                    }}
                    aria-label="Pilih semua media pada folder dan filter aktif"
                  />
                  {/* (N) hanya muncul jika dicentang, tanpa teks 'N dipilih' */}
                  <span>{hasSelection ? `Pilih semua (${selectedCount})` : "Pilih semua"}</span>
                </label>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelSelectMode}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Batal
                </Button>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <ConfirmAction
                  trigger={<Button type="button" variant="secondary" size="sm" disabled={!hasSelection}>Hapus</Button>}
                  title="Hapus aset terpilih?"
                  description="Aset yang masih dipakai produk/banner akan diarsipkan, bukan dihapus."
                  confirmLabel="Hapus"
                  onConfirm={() => runBulkAction("delete")}
                />
                <ConfirmAction
                  trigger={<Button type="button" variant="secondary" size="sm" disabled={!hasSelection}>Arsipkan</Button>}
                  title="Arsipkan aset terpilih?"
                  description="Aset akan disembunyikan dari daftar aktif."
                  confirmLabel="Arsipkan"
                  onConfirm={() => runBulkAction("archive")}
                />
                {visibility === "archived" ? (
                  <ConfirmAction
                    trigger={<Button type="button" variant="secondary" size="sm" disabled={!hasSelection}>Pulihkan</Button>}
                    title="Pulihkan aset terpilih?"
                    description="Aset akan tampil kembali di daftar aktif."
                    confirmLabel="Pulihkan"
                    onConfirm={() => runBulkAction("restore")}
                  />
                ) : null}

                <Select
                  value={bulkMoveTarget}
                  onChange={(e) => setBulkMoveTarget(e.target.value)}
                  className="w-52"
                  disabled={!hasSelection}
                  aria-label="Pindah ke folder"
                >
                  <option value="">Pindah ke…</option>
                  <option value="0">Inbox (tanpa folder)</option>
                  {flattenFolders(folders).map((f) => (
                    <option key={f.id} value={f.id}>{f.indent}{f.name} ({f.assets_count})</option>
                  ))}
                </Select>
                {bulkMoveTarget ? (
                  <Button type="button" size="sm" disabled={!hasSelection} onClick={bulkMove}>Pindahkan</Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Susunan kartu: enam per layar di desktop lebar, lalu mengecil
              bertingkat begitu lebar layar berkurang (2/3/4/5/6 kolom). Kartu
              memakai aspek persegi, jadi tinggi baris mengikuti lebar kartu dengan
              sendirinya: layar sempit berarti kartu lebih kecil, bukan terpotong. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {assets.map((asset) => {
              const meta = mediaStatusMeta(asset.status)
              const isCopied = copiedId === asset.id
              return (
                <div
                  key={asset.id}
                  role={selectMode ? "checkbox" : "button"}
                  aria-checked={selectMode ? isSelected(asset.id) : undefined}
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
                  className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md ${selectMode && isSelected(asset.id) ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}
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
                        checked={isSelected(asset.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelected(asset.id)}
                        className="absolute left-1.5 top-1.5 size-4 rounded border-border accent-primary"
                        aria-label={`Pilih ${asset.label}`}
                      />
                    ) : null}
                  </div>
                  {/* Baris bawah kartu: nama aset di kiri, dropdown aksi titik 3 di kanan */}
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground" title={asset.label}>{asset.label}</p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            data-no-select
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Aksi media"
                            aria-label={`Aksi untuk ${asset.label}`}
                          >
                            <Icon name="dots-three-vertical" className="size-4" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[8.5rem]">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setAttachingId(asset.id)
                            }}
                          >
                            <Icon name="link" className="size-3.5" aria-hidden="true" />
                            <span>Pasang</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingAsset(asset)
                            }}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          >
                            <Icon name="trash" className="size-3.5" aria-hidden="true" />
                            <span>Hapus</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              setInfoAsset(asset)
                            }}
                          >
                            <Icon name="info" className="size-3.5" aria-hidden="true" />
                            <span>Detail</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Attach modal. Panel dibatasi tinggi viewport dengan gulir sendiri:
          tanpa itu daftar produk yang panjang membuat panel lebih tinggi dari
          layar, bagian atasnya (judul dan kolom cari) keluar layar dan tidak
          bisa dicapai karena overlay-nya tidak menggulir. */}
      {attachingId !== null ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={(e) => {
            // Tutup hanya bila tekanan mulai di latar belakang. Drag pegangan
            // resize yang berakhir di luar panel tidak boleh menutup popup.
            if (e.target === e.currentTarget) setAttachingId(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pasang ke produk"
            className="flex h-[min(42rem,calc(100dvh-2rem))] w-full resize flex-col overflow-auto rounded-lg bg-surface p-5 shadow-float sm:w-[56rem] sm:max-w-[min(80rem,calc(100vw-2rem))] sm:min-w-[28rem] max-h-[calc(100dvh-2rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 shrink-0 text-sm font-semibold">Pasang ke produk</h3>
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Produk tujuan</span>
                  <span className={cn("min-w-0 truncate text-xs", attachLabel ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {attachLabel || "Belum ada produk dipilih"}
                  </span>
                  {attachProduct ? (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachProduct("")
                        setAttachLabel("")
                        setAttachVariant("")
                        setAttachVariantOptions([])
                        setAttachExisting([])
                      }}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Kosongkan
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 flex min-h-0 flex-1 flex-col">
                  <ProductPicker
                    maxSelection={1}
                    className="flex min-h-0 flex-1 flex-col"
                    tableClassName="min-h-0 flex-1"
                    filtersGridClassName="grid grid-cols-1 gap-3 md:grid-cols-4"
                    searchFieldClassName="md:col-span-full"
                    filterExtras={
                      attachProduct ? (
                        <>
                          <div className="grid min-w-0 content-start gap-1.5">
                            <label htmlFor="attach-variant" className="text-[13px] font-medium text-foreground">Varian</label>
                            <select
                              id="attach-variant"
                              value={attachVariant}
                              onChange={(e) => setAttachVariant(e.target.value)}
                              disabled={attachVariantOptions.length === 0}
                              className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:opacity-70"
                            >
                              <option value="">Tanpa varian (foto katalog)</option>
                              {attachVariantOptions.map((v) => (
                                <option key={v.id} value={String(v.id)}>{v.label || v.sku}</option>
                              ))}
                            </select>
                          </div>
                          <div className="grid min-w-0 content-start gap-1.5">
                            <label htmlFor="attach-position" className="text-[13px] font-medium text-foreground">Posisi</label>
                            <Input id="attach-position" type="number" value={attachPosition} onChange={(e) => setAttachPosition(e.target.value)} min="1" />
                          </div>
                          <div className="col-span-full flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-1 text-xs">
                              <input type="checkbox" checked={attachCatalog} onChange={(e) => setAttachCatalog(e.target.checked)} /> Galeri produk
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <input type="checkbox" checked={attachInstallation} onChange={(e) => setAttachInstallation(e.target.checked)} /> Pemasangan
                            </label>
                            {attachExistingRow ? (
                              <p className="text-xs text-warning">
                                Aset ini sudah terpasang pada lingkup ini di posisi {attachExistingRow.position}. Memasang lagi akan memperbarui baris itu.
                              </p>
                            ) : null}
                          </div>
                        </>
                      ) : null
                    }
                    onSelect={(products) => {
                      const produk = products[0] ?? null
                      setAttachProduct(produk ? String(produk.id) : "")
                      setAttachLabel(produk ? `${produk.name} (${produk.parent_sku})` : "")
                      setAttachVariant("")
                      setAttachVariantOptions([])
                      setAttachExisting([])
                      if (produk && attachingId !== null) {
                        void fetch(`${routeUrl("admin.media.attach-options", { asset: attachingId })}?product_id=${encodeURIComponent(String(produk.id))}`, { headers: { Accept: "application/json" } })
                          .then((res) => (res.ok ? res.json() : null))
                          .then((data) => {
                            setAttachVariantOptions(Array.isArray(data?.variants) ? data.variants : [])
                            setAttachExisting(Array.isArray(data?.existing) ? data.existing : [])
                          })
                          .catch(() => {})
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex shrink-0 justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setAttachingId(null); setAttachProduct(""); setAttachLabel(""); setAttachVariant(""); setAttachVariantOptions([]); setAttachExisting([]) }}>Batal</Button>
              <Button type="button" size="sm" disabled={!attachProduct || attachBusy} onClick={async () => {
                setAttachBusy(true); setAttachError(null)
                try {
                  const res = await fetch(routeUrl("admin.media.attach", { asset: attachingId }), {
                    method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "X-CSRF-TOKEN": csrf },
                    body: JSON.stringify({ product_ids: [Number(attachProduct)], product_variant_id: attachVariant ? Number(attachVariant) : null, position: Number(attachPosition), show_in_catalog: attachCatalog, is_installation: attachInstallation, visibility: attachVisibility }),
                  })
                  if (!res.ok) {
                    const data = (await res.json().catch(() => ({}))) as { message?: string }
                    throw new Error(data.message ?? "Gagal memasang media. Coba beberapa saat lagi.")
                  }
                  setAttachingId(null); setAttachProduct(""); setAttachLabel(""); setAttachVariant(""); setAttachVariantOptions([]); setAttachExisting([])
                } catch (e) { setAttachError(e instanceof Error ? e.message : "Gagal memasang media. Coba beberapa saat lagi.") }
                setAttachBusy(false)
              }}>
                {attachBusy ? "Memasang…" : "Pasang"}
              </Button>
            </div>
            {attachError ? <p className="mt-2 text-xs text-destructive">{attachError}</p> : null}
          </div>
        </div>
      ) : null}

      {deletingAsset ? (
        <Dialog open onOpenChange={(next) => { if (!next) setDeletingAsset(null) }}>
          <DialogContent className="max-w-sm">
            <DialogTitle>Hapus media?</DialogTitle>
            <DialogDescription>
              Hapus "{deletingAsset.label}"? Aset yang masih dipakai produk atau banner akan diarsipkan, bukan dihapus.
            </DialogDescription>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletingAsset(null)}>
                Batal
              </Button>
              <Button
                variant="destructive-solid"
                onClick={() => {
                  runBulkAction("delete", [deletingAsset.id])
                }}
              >
                Hapus
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {infoAsset ? (
        <Dialog open onOpenChange={(next) => { if (!next) setInfoAsset(null) }}>
          <DialogContent className="max-w-md bg-card text-card-foreground">
            <DialogTitle>Info media</DialogTitle>
            <dl className="space-y-2 text-xs">
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">Nama</dt>
                <dd className="break-all font-medium text-foreground">{infoAsset.label}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">Media #</dt>
                <dd className="tabular-nums text-foreground">{infoAsset.id}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">Folder</dt>
                <dd className="text-foreground">{folderNama(infoAsset.folder_id, folders)}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">Jenis / status</dt>
                <dd className="text-foreground">{infoAsset.kind} / {mediaStatusMeta(infoAsset.status).label}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">Dipakai</dt>
                <dd className="tabular-nums text-foreground">{infoAsset.usage_count}x</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">Diunggah</dt>
                <dd className="text-foreground">{infoAsset.created_at ? new Date(infoAsset.created_at).toLocaleString("id-ID") : "-"}</dd>
              </div>
              <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-2">
                <dt className="text-muted-foreground">URL</dt>
                <dd className="break-all text-foreground">{infoAsset.public_url}</dd>
              </div>
            </dl>
          </DialogContent>
        </Dialog>
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