import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import { usePage } from "@inertiajs/react"
import type { SharedPageProps } from "@/types"

export type PickedMedia = {
  /** MediaAsset id yang sudah tersimpan di Media Library. */
  assetId: number
  label: string
  thumbUrl: string
  kind: "image" | "video"
  /** Sumber video (kind video): file video untuk pratinjau. */
  videoUrl?: string | null
  /** Pemilik varian (null = media katalog untuk semua varian). */
  productVariantId?: number | null
  variantLabel?: string | null
  folderName?: string | null
  productNames?: string[]
}

type UploadResult = {
  asset: {
    id: number
    label: string
    kind: "image" | "video"
    status: string
    public_url: string
  }
}

type FolderItem = {
  id: number
  parent_id: number | null
  name: string
  assets_count?: number
}

interface FlattenedFolder {
  id: number
  name: string
  parent_id: number | null
  depth: number
  assets_count: number
}

function buildFolderTree(items: FolderItem[]): FlattenedFolder[] {
  const byParent: Record<string, FolderItem[]> = {}
  for (const item of items) {
    const pKey = item.parent_id === null ? "root" : String(item.parent_id)
    if (!byParent[pKey]) byParent[pKey] = []
    byParent[pKey].push(item)
  }

  const out: FlattenedFolder[] = []
  function traverse(parentId: string, depth: number) {
    const children = byParent[parentId] || []
    // Sort alphabetically
    children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    for (const child of children) {
      out.push({
        id: child.id,
        name: child.name,
        parent_id: child.parent_id,
        depth,
        assets_count: child.assets_count ?? 0,
      })
      traverse(String(child.id), depth + 1)
    }
  }

  traverse("root", 0)
  return out
}

/**
 * MediaPicker (ADR-020 + Hierarchical Folder Tree + Product Info):
 * - Tab Upload: file langsung dari komputer (admin.media.upload), masuk Media Library.
 * - Tab Library: cari & pilih aset ready yang sudah ada (admin.media.picker).
 *   Dilengkapi:
 *   1. Dropdown Filter Folder dengan hierarki terstruktur (Root Folder & Subfolder ber-indentasi jelas ↳).
 *   2. Pencarian cerdas (berdasarkan label media atau nama produk).
 *   3. Ikon titik 3 / info di sudut kanan atas kartu untuk cek nama aset & produk yang menggunakannya.
 */
export function MediaPicker({
  open,
  onClose,
  onPick,
  multiple = false,
  title = "Pilih media",
}: {
  open: boolean
  onClose: () => void
  onPick: (media: PickedMedia[]) => void
  multiple?: boolean
  title?: string
}) {
  const { csrf } = usePage<SharedPageProps>().props
  const [tab, setTab] = React.useState<"upload" | "library">("upload")
  const [query, setQuery] = React.useState("")
  const [selectedFolder, setSelectedFolder] = React.useState<string>("all")
  const [folders, setFolders] = React.useState<FolderItem[]>([])
  const [inboxCount, setInboxCount] = React.useState<number>(0)
  const [assets, setAssets] = React.useState<PickedMedia[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<PickedMedia[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const [activeInfoAsset, setActiveInfoAsset] = React.useState<PickedMedia | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const searchAssets = React.useCallback((q: string, folderId: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (folderId && folderId !== "all") params.set("folder_id", folderId)

    fetch(`${routeUrl("admin.media.picker")}?${params.toString()}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => res.json())
      .then(
        (data: {
          assets: Array<{
            id: number
            label: string
            kind: string
            thumb_url: string | null
            folder_name?: string | null
            product_names?: string[]
          }>
          folders?: FolderItem[]
          inbox_count?: number
        }) => {
          setAssets(
            (data.assets ?? []).map((a) => ({
              assetId: a.id,
              label: a.label,
              thumbUrl: a.thumb_url ?? "",
              kind: a.kind === "video" ? "video" : "image",
              folderName: a.folder_name,
              productNames: a.product_names ?? [],
            })),
          )
          if (data.folders) setFolders(data.folders)
          if (typeof data.inbox_count === "number") setInboxCount(data.inbox_count)
        },
      )
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    if (open && tab === "library") {
      searchAssets(query, selectedFolder)
    }
  }, [open, tab, query, selectedFolder, searchAssets])

  function toggle(asset: PickedMedia) {
    setSelected((prev) => {
      if (multiple) {
        return prev.some((a) => a.assetId === asset.assetId)
          ? prev.filter((a) => a.assetId !== asset.assetId)
          : [...prev, asset]
      }
      return [asset]
    })
  }

  function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (!list.length) return
    setUploading(true)
    setUploadError(null)
    Promise.all(
      list.map(
        (file) =>
          new Promise<PickedMedia | null>((resolve) => {
            const fd = new FormData()
            fd.append("media", file)
            const xhr = new XMLHttpRequest()
            xhr.open("POST", routeUrl("admin.media.upload"))
            xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest")
            xhr.setRequestHeader("X-CSRF-TOKEN", csrf ?? "")
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data: UploadResult = JSON.parse(xhr.responseText)
                  resolve({
                    assetId: data.asset.id,
                    label: data.asset.label,
                    thumbUrl: data.asset.public_url,
                    kind: data.asset.kind,
                  })
                  return
                } catch {
                  resolve(null)
                  return
                }
              }
              let message = "Gagal mengunggah"
              try {
                const parsed = JSON.parse(xhr.responseText) as { message?: string }
                if (parsed.message) message = parsed.message
              } catch {
                // keep default
              }
              setUploadError(message)
              resolve(null)
            }
            xhr.onerror = () => {
              setUploadError("Gagal mengunggah (jaringan)")
              resolve(null)
            }
            xhr.send(fd)
          }),
      ),
    ).then((results) => {
      setUploading(false)
      const ok = results.filter((r): r is PickedMedia => r !== null)
      if (ok.length) {
        if (multiple) setSelected((prev) => [...prev, ...ok])
        else {
          onPick(ok)
          onClose()
        }
      }
    })
  }

  function confirmSelection() {
    if (!selected.length) return
    onPick(selected)
    setSelected([])
    onClose()
  }

  const flattenedTree = React.useMemo(() => buildFolderTree(folders), [folders])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-float sm:w-[min(50rem,96vw)] sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <p className="text-[11px] text-muted-foreground">Pilih media dari library atau unggah foto/video baru.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Tutup pilih media"
          >
            <Icon name="x" className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-5 pt-2">
          {([
            ["upload", "Unggah file"],
            ["library", "Dari Media Library"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-t-md px-3 py-2 text-xs font-semibold transition",
                tab === key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "upload" ? (
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(false)
                if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files)
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-muted/40",
              )}
            >
              <Icon name="upload" className="size-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {uploading ? "Mengunggah..." : "Tarik file ke sini atau pilih dari perangkat"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gambar atau video. File otomatis diproses WebP dan langsung masuk Media Library.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
              >
                {uploading ? "Memproses..." : "Pilih file"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple={multiple}
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length) uploadFiles(event.target.files)
                  event.target.value = ""
                }}
              />
              {uploadError ? <p className="mt-3 text-xs font-medium text-destructive">{uploadError}</p> : null}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toolbar Kontrol Pencarian & Filter Folder Hierarkis */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="w-full sm:w-64 shrink-0">
                  <div className="relative">
                    <select
                      value={selectedFolder}
                      onChange={(e) => setSelectedFolder(e.target.value)}
                      className="h-9 w-full appearance-none rounded-md border border-border bg-surface pl-8 pr-8 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
                      aria-label="Filter berdasarkan folder"
                    >
                      <option value="all">📁 Semua Folder</option>
                      <option value="inbox">📥 Inbox ({inboxCount})</option>
                      <option disabled>────────────────────────</option>
                      {flattenedTree.map((f) => {
                        const isRoot = f.depth === 0
                        const prefix = isRoot ? "📁 " : "\u00a0\u00a0".repeat(f.depth) + "↳ "
                        return (
                          <option key={f.id} value={String(f.id)}>
                            {prefix}{f.name} ({f.assets_count})
                          </option>
                        )
                      })}
                    </select>
                    <Icon
                      name="folder"
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Icon
                      name="caret-down"
                      className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                </div>

                <div className="relative flex-1">
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari nama media atau produk..."
                    className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Icon
                    name="search"
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Grid Aset Media */}
              {loading ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-muted-foreground">Memuat media…</p>
                </div>
              ) : assets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-12 text-center">
                  <Icon name="image" className="mx-auto size-8 text-muted-foreground/60" aria-hidden="true" />
                  <p className="mt-2 text-xs font-medium text-foreground">Tidak ada media siap pakai</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Coba ubah kata kunci pencarian atau pilih folder lain.</p>
                </div>
              ) : (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                  {assets.map((asset) => {
                    const active = selected.some((a) => a.assetId === asset.assetId)
                    return (
                      <li key={asset.assetId} className="group relative">
                        <div
                          onClick={() => toggle(asset)}
                          className={cn(
                            "relative block aspect-square w-full cursor-pointer overflow-hidden rounded-md border-2 bg-surface-muted transition",
                            active ? "border-primary ring-2 ring-ring" : "border-border hover:border-foreground/40",
                          )}
                          role="checkbox"
                          aria-checked={active}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault()
                              toggle(asset)
                            }
                          }}
                        >
                          {asset.thumbUrl ? (
                            <img src={asset.thumbUrl} alt="" className="size-full object-cover select-none" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-muted-foreground">
                              <Icon name="image" className="size-6" aria-hidden="true" />
                            </span>
                          )}

                          {/* Checkbox badge aktif */}
                          {active ? (
                            <span className="absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                              <Icon name="check" className="size-3" aria-hidden="true" />
                            </span>
                          ) : null}

                          {/* Ikon Info (titik tiga) di kanan atas kartu */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveInfoAsset(activeInfoAsset?.assetId === asset.assetId ? null : asset)
                            }}
                            className={cn(
                              "absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded bg-background/85 text-foreground backdrop-blur-sm shadow transition hover:bg-background",
                              activeInfoAsset?.assetId === asset.assetId
                                ? "opacity-100 ring-2 ring-primary"
                                : "opacity-0 group-hover:opacity-100",
                            )}
                            title="Lihat detail info media"
                            aria-label={`Detail ${asset.label}`}
                          >
                            <Icon name="dots-three" className="size-3.5" aria-hidden="true" />
                          </button>

                          {/* Overlay tooltip info cepat di bawah kartu saat hover */}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 pt-4 text-left opacity-0 transition-opacity group-hover:opacity-100">
                            <p className="truncate text-[10px] font-medium text-white leading-tight">{asset.label}</p>
                            {asset.folderName ? (
                              <p className="truncate text-[9px] text-white/80">📁 {asset.folderName}</p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Modal / Card Info Media Popover (Jika admin klik titik 3) */}
        {activeInfoAsset ? (
          <div className="border-t border-border bg-muted/40 px-5 py-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground truncate max-w-xs">{activeInfoAsset.label}</span>
                  {activeInfoAsset.folderName ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      📁 {activeInfoAsset.folderName}
                    </span>
                  ) : (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Inbox
                    </span>
                  )}
                </div>
                {activeInfoAsset.productNames && activeInfoAsset.productNames.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">Dipakai pada: </span>
                    {activeInfoAsset.productNames.join(", ")}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Belum ditautkan ke produk manapun.</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveInfoAsset(null)}
                className="text-muted-foreground hover:text-foreground p-1 text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 bg-card">
          <p className="text-xs text-muted-foreground">
            {selected.length ? (
              <span>
                <span className="font-semibold tabular-nums text-foreground">{selected.length}</span> media dipilih
              </span>
            ) : (
              "Pilih media terlebih dahulu"
            )}
          </p>
          <div className="flex items-center gap-2">
            {selected.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Kosongkan
              </button>
            ) : null}
            <button
              type="button"
              onClick={confirmSelection}
              disabled={!selected.length}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
            >
              Gunakan media
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
