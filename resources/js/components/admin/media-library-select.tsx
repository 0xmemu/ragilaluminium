import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"

export interface LibraryAssetOption {
  id: number
  label: string
  kind: "image" | "video"
  thumb_url: string | null
  folder_name?: string | null
}

/**
 * MediaLibrarySelect (owner 2026-09-16): dropdown pilih aset dari Media
 * Library untuk form CMS (banner, testimoni, dsb). Media Library adalah
 * satu-satunya sumber media; upload file baru dilakukan di halaman
 * /admin/media (Library).
 */
export function MediaLibrarySelect({
  value,
  onChange,
  onPick,
  kind = "image",
  label = "Pilih dari Media Library",
  className,
}: {
  value: string
  onChange: (value: string) => void
  /**
   * Diberi seluruh data aset yang dipilih (label, thumbnail, folder), bukan hanya
   * idnya. Dipakai form yang perlu menampilkan pratinjau atau keterangan aset
   * tanpa memanggil ulang API pemilih.
   */
  onPick?: (asset: LibraryAssetOption) => void
  kind?: "image" | "video"
  label?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [assets, setAssets] = React.useState<LibraryAssetOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [selectedAsset, setSelectedAsset] = React.useState<LibraryAssetOption | null>(null)
  const wrapRef = React.useRef<HTMLDivElement | null>(null)

  const load = React.useCallback((q: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    // Jenis dikirim ke server: daftar dibatasi 48 aset terbaru, jadi penyaringan
    // di sisi klien membuat aset lama (mis. video) tidak pernah muncul.
    params.set("kind", kind)
    fetch(`${routeUrl("admin.media.picker")}?${params.toString()}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => res.json())
      .then((data: { assets?: Array<{ id: number; label: string; kind: string; thumb_url: string | null; folder_name?: string | null }> }) => {
        setAssets(
          (data.assets ?? [])
            .map((a) => ({
              id: a.id,
              label: a.label,
              kind: a.kind === "video" ? "video" : "image",
              thumb_url: a.thumb_url,
              folder_name: a.folder_name,
            })),
        )
      })
      .finally(() => setLoading(false))
  }, [kind])

  React.useEffect(() => {
    if (open) load(query)
  }, [open, query, load])

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  /** Aset yang ditampilkan hanya bila cocok dengan nilai dari pemanggil. */
  const shownAsset = selectedAsset && String(selectedAsset.id) === value ? selectedAsset : null

  function pick(asset: LibraryAssetOption) {
    setSelectedAsset(asset)
    onChange(String(asset.id))
    onPick?.(asset)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 text-left text-xs text-foreground transition hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {shownAsset?.thumb_url ? (
          <img src={shownAsset.thumb_url} alt="" className="size-7 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted/50 text-muted-foreground">
            <Icon name={kind === "video" ? "video" : "image"} className="size-3.5" aria-hidden="true" />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">
          {shownAsset ? shownAsset.label : value ? `Media #${value}` : label}
        </span>
        <Icon name="caret-down" className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute z-40 mt-1.5 w-full rounded-lg border border-border bg-card p-2 shadow-float">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari media di Library…"
            className="h-8 w-full rounded-md border border-border bg-surface px-2.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {loading ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Memuat…</p>
            ) : assets.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Tidak ada media. Unggah dulu di halaman Media Library.
              </p>
            ) : (
              assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => pick(asset)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-xs transition",
                    String(asset.id) === value
                      ? "border-primary bg-primary/10"
                      : "border-transparent hover:bg-muted/50",
                  )}
                >
                  {asset.thumb_url ? (
                    <img src={asset.thumb_url} alt="" className="size-9 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted/50 text-muted-foreground">
                      <Icon name={asset.kind === "video" ? "video" : "image"} className="size-4" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{asset.label}</span>
                    {asset.folder_name ? (
                      <span className="block truncate text-[10px] text-muted-foreground">📁 {asset.folder_name}</span>
                    ) : null}
                  </span>
                  {String(asset.id) === value ? (
                    <Icon name="check" className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
