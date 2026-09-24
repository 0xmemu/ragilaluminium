import * as React from "react"
import { createPortal } from "react-dom"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

/** Tinggi daftar folder pada dropdown filter dapat diatur dengan menarik tepi bawah. */
const FOLDER_LIST_HEIGHT_KEY = "media-picker:folder-list-height"
const FOLDER_LIST_DEFAULT_HEIGHT = 224
const FOLDER_LIST_MIN_HEIGHT = 120
const FOLDER_LIST_MAX_HEIGHT = 560

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
  /** Aset langsung di folder ini. */
  assets_count: number
  /** Aset folder ini + seluruh sub-folder di bawahnya (angka yang tampil di daftar). */
  assets_total: number
  /** Jalur lengkap dari akar, mis. "Jendela Swing / 70x60". Dipakai untuk pencarian. */
  path: string
}

function buildFolderTree(items: FolderItem[]): FlattenedFolder[] {
  const byParent: Record<string, FolderItem[]> = {}
  for (const item of items) {
    const pKey = item.parent_id === null ? "root" : String(item.parent_id)
    if (!byParent[pKey]) byParent[pKey] = []
    byParent[pKey].push(item)
  }

  const out: FlattenedFolder[] = []
  // Mengembalikan total aset subtree agar induk menampilkan angka gabungan
  // (aset umumnya tersimpan di sub-folder, bukan di folder induknya).
  function traverse(parentId: string, depth: number, parentPath: string): number {
    const children = byParent[parentId] || []
    // Sort alphabetically
    children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    let subtreeTotal = 0
    for (const child of children) {
      const path = depth === 0 ? child.name : parentPath + " / " + child.name
      const own = child.assets_count ?? 0
      const index = out.length
      out.push({
        id: child.id,
        name: child.name,
        parent_id: child.parent_id,
        depth,
        assets_count: own,
        assets_total: own,
        path,
      })
      const nested = traverse(String(child.id), depth + 1, path)
      out[index].assets_total = own + nested
      subtreeTotal += own + nested
    }
    return subtreeTotal
  }

  traverse("root", 0, "")
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
/**
 * Combobox filter folder dengan kotak pencarian (owner 2026-09-16):
 * daftar folder bisa puluhan, jadi select native diganti popover yang
 * bisa dicari ketik langsung. Dipakai global oleh semua pemakai MediaPicker.
 */
function FolderFilterCombobox({
  folders,
  inboxCount,
  value,
  onChange,
}: {
  folders: FlattenedFolder[]
  inboxCount: number
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  // Tinggi daftar diingat agar tidak perlu diatur ulang setiap kali dibuka.
  const [listHeight, setListHeight] = React.useState(() => {
    if (typeof window === "undefined") return FOLDER_LIST_DEFAULT_HEIGHT
    const saved = Number(window.localStorage.getItem(FOLDER_LIST_HEIGHT_KEY))
    return Number.isFinite(saved) && saved >= FOLDER_LIST_MIN_HEIGHT && saved <= FOLDER_LIST_MAX_HEIGHT
      ? saved
      : FOLDER_LIST_DEFAULT_HEIGHT
  })
  const [availableHeight, setAvailableHeight] = React.useState(320)
  const [dragging, setDragging] = React.useState(false)
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({})
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const wrapRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const popoverRef = React.useRef<HTMLDivElement | null>(null)

  function labelFor(val: string) {
    if (val === "all") return "📁 Semua Folder"
    if (val === "inbox") return "📥 Inbox (" + inboxCount + ")"
    const folder = folders.find((f) => String(f.id) === val)
    return folder ? (folder.depth === 0 ? "📁 " : "↳ ") + folder.name : "📁 Semua Folder"
  }

  const applyHeight = React.useCallback((next: number) => {
    const clamped = Math.round(
      Math.min(FOLDER_LIST_MAX_HEIGHT, Math.max(FOLDER_LIST_MIN_HEIGHT, next)),
    )
    setListHeight(clamped)
    try {
      window.localStorage.setItem(FOLDER_LIST_HEIGHT_KEY, String(clamped))
    } catch {
      // localStorage bisa diblokir; tinggi tetap berlaku untuk sesi ini.
    }
  }, [])

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = listHeight
    setDragging(true)
    const onMove = (moveEvent: PointerEvent) => applyHeight(startHeight + (moveEvent.clientY - startY))
    const onUp = () => {
      setDragging(false)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  // Dropdown dirender lewat portal supaya daftar yang diperpanjang tidak
  // terpotong oleh area scroll dialog media picker.
  const positionPopover = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const available = Math.max(220, window.innerHeight - rect.bottom - 16)
    setAvailableHeight(available)
    setPopoverStyle({
      position: "fixed",
      left: Math.round(rect.left),
      width: Math.max(Math.round(rect.width), 280),
      top: Math.round(rect.bottom + 6),
      maxHeight: Math.round(available),
      zIndex: 90,
    })
  }, [])

  React.useEffect(() => {
    if (!open) return
    positionPopover()
    window.addEventListener("scroll", positionPopover, true)
    window.addEventListener("resize", positionPopover)
    return () => {
      window.removeEventListener("scroll", positionPopover, true)
      window.removeEventListener("resize", positionPopover)
    }
  }, [open, positionPopover])

  React.useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (wrapRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
      setQuery("")
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [])

  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function pick(val: string) {
    onChange(val)
    setOpen(false)
    setQuery("")
  }

  const searching = query.trim() !== ""

  // Pencarian folder memakai JALUR lengkap, bukan hanya nama folder, sehingga
  // mencari "swing" ikut menampilkan sub-folder di dalamnya (mis.
  // Jendela Swing / 70x60) - di situlah aset biasanya tersimpan.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return folders
    return folders.filter((f) => f.path.toLowerCase().includes(q))
  }, [folders, query])
  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-left text-xs font-medium text-foreground outline-none transition hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter berdasarkan folder"
      >
        <Icon name="folder" className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{labelFor(value)}</span>
        <Icon name="caret-down" className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open ? createPortal(
        <div
          ref={popoverRef}
          style={popoverStyle}
          className="flex flex-col rounded-lg border border-border bg-card p-2 shadow-float"
        >
          <div className="relative shrink-0">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false)
                  setQuery("")
                }
                if (event.key === "Enter" && filtered.length > 0) {
                  event.preventDefault()
                  pick(String(filtered[0].id))
                }
              }}
              placeholder="Cari folder…"
              className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Icon
              name="search"
              className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <div
            className="mt-2 space-y-0.5 overflow-y-auto"
            style={{ height: Math.min(listHeight, Math.max(120, availableHeight - 106)) }}
          >
            <button
              type="button"
              onClick={() => pick("all")}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition",
                value === "all" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/60",
              )}
            >
              📁 Semua Folder
            </button>
            <button
              type="button"
              onClick={() => pick("inbox")}
              className={cn(
                "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition",
                value === "inbox" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/60",
              )}
            >
              📥 Inbox ({inboxCount})
            </button>
            <div className="my-1 border-t border-border" />
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">Tidak ada folder yang cocok.</p>
            ) : (
              filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pick(String(f.id))}
                  style={{ paddingLeft: 8 + f.depth * 14 }}
                  className={cn(
                    "flex w-full items-start gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition",
                    String(f.id) === value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/60",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {f.depth === 0 ? "📁 " : "↳ "}
                      {f.name}
                    </span>
                    {searching && f.depth > 0 ? (
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {f.path.split(" / ").slice(0, -1).join(" / ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 pt-0.5 tabular-nums text-[10px] text-muted-foreground">
                    {f.assets_total}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Pegangan tarik di tepi bawah: perpanjang/pendekkan daftar folder. */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Tarik untuk mengubah tinggi daftar folder"
            title="Tarik untuk mengubah tinggi daftar. Klik dua kali untuk ukuran default."
            onPointerDown={startResize}
            onDoubleClick={() => applyHeight(FOLDER_LIST_DEFAULT_HEIGHT)}
            className={cn(
              "mt-1.5 flex h-4 shrink-0 cursor-ns-resize items-center justify-center rounded-b-md text-muted-foreground/50 transition hover:bg-muted/50 hover:text-muted-foreground",
              dragging && "bg-muted/60 text-muted-foreground",
            )}
          >
            <span className="h-0.5 w-10 rounded-full bg-current" aria-hidden="true" />
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}


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
  // Owner 2026-09-16: Media Library satu-satunya sumber media. Upload hanya
  // lewat halaman /admin/media (Library); picker tidak punya tab upload.
  const [tab] = React.useState<"library">("library")
  const [query, setQuery] = React.useState("")
  const [selectedFolder, setSelectedFolder] = React.useState<string>("all")
  const [folders, setFolders] = React.useState<FolderItem[]>([])
  const [inboxCount, setInboxCount] = React.useState<number>(0)
  const [assets, setAssets] = React.useState<PickedMedia[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<PickedMedia[]>([])
  const [activeInfoAsset, setActiveInfoAsset] = React.useState<PickedMedia | null>(null)

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

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "library" ? (
            <div className="space-y-4">
              {/* Toolbar Kontrol Pencarian & Filter Folder Hierarkis */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="w-full sm:w-64 shrink-0">
                  <FolderFilterCombobox
                      folders={flattenedTree}
                      inboxCount={inboxCount}
                      value={selectedFolder}
                      onChange={setSelectedFolder}
                    />
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
          ) : null}
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
