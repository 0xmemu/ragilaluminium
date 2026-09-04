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

/**
 * MediaPicker (ADR-020): pilih media untuk form produk dengan dua jalur.
 * - Tab Upload: file langsung dari komputer (admin.media.upload), masuk Media Library.
 * - Tab Library: cari & pilih aset ready yang sudah ada (admin.media.picker).
 * Komponen ini TIDAK melampirkan ke produk; memanggil onPick agar form yang
 * menentukan tujuan attach (katalog/pemasangan/varian).
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
  const [assets, setAssets] = React.useState<PickedMedia[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<PickedMedia[]>([])
  const [uploading, setUploading] = React.useState(false)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const searchAssets = React.useCallback((q: string) => {
    setLoading(true)
    fetch(`${routeUrl("admin.media.picker")}?q=${encodeURIComponent(q)}`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((res) => res.json())
      .then((data: { assets: Array<{ id: number; label: string; kind: string; thumb_url: string | null }> }) => {
        setAssets(
          (data.assets ?? []).map((a) => ({
            assetId: a.id,
            label: a.label,
            thumbUrl: a.thumb_url ?? "",
            kind: a.kind === "video" ? "video" : "image",
          })),
        )
      })
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    if (open && tab === "library") searchAssets(query)
  }, [open, tab, query, searchAssets])

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-float sm:w-[min(38rem,100%)] sm:rounded-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Tutup pilih media"
          >
            <Icon name="x" className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-border px-4 pt-2">
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

        <div className="flex-1 overflow-y-auto p-4">
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
                "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-surface-muted/40",
              )}
            >
              <Icon name="upload" className="size-8 text-muted-foreground" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium text-foreground">
                {uploading ? "Mengunggah..." : "Tarik file ke sini atau pilih dari perangkat"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Gambar atau video. File langsung masuk Media Library.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
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
              {uploadError ? <p className="mt-2 text-xs font-medium text-destructive">{uploadError}</p> : null}
            </div>
          ) : (
            <div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari label media…"
                className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {loading ? (
                <p className="mt-4 text-xs text-muted-foreground">Mencari…</p>
              ) : assets.length === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">Tidak ada media siap pakai.</p>
              ) : (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {assets.map((asset) => {
                    const active = selected.some((a) => a.assetId === asset.assetId)
                    return (
                      <li key={asset.assetId}>
                        <button
                          type="button"
                          onClick={() => toggle(asset)}
                          className={cn(
                            "relative block aspect-square w-full overflow-hidden rounded-md border-2 bg-surface-muted transition",
                            active ? "border-primary ring-2 ring-ring" : "border-border hover:border-foreground/30",
                          )}
                          aria-pressed={active}
                          aria-label={`Pilih ${asset.label}`}
                        >
                          {asset.thumbUrl ? (
                            <img src={asset.thumbUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-muted-foreground">
                              <Icon name="image" className="size-6" aria-hidden="true" />
                            </span>
                          )}
                          {active ? (
                            <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Icon name="check" className="size-3" aria-hidden="true" />
                            </span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {multiple ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">{selected.length} dipilih</p>
            <button
              type="button"
              onClick={confirmSelection}
              disabled={!selected.length}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
            >
              Gunakan yang dipilih
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
