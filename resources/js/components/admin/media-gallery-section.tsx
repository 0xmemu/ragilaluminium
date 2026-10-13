import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { MediaPickerSheet, type PickedMedia } from "@/components/admin/media-picker-sheet"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { cn } from "@/lib/utils"

export interface MediaGalleryItem {
  /** Kunci stabil untuk React; aset pakai `lib-<assetId>`, foto tautan pakai kunci halaman. */
  key: string
  /** Terisi bila foto berasal dari Media Library. */
  assetId?: number
  /** Sumber pratinjau; untuk aset isi dengan thumbUrl. */
  url: string
  label?: string
}

/**
 * Seksi galeri media siap pakai (pola seksi Foto Produk, owner 2026-10-13):
 * satu daftar berurutan, foto pertama jadi gambar utama (badge Utama), foto
 * berikutnya jadi galeri. Dipakai form produk, model produk, dan ulasan supaya
 * cara kerjanya sama; halaman cukup memetakan daftar ke kolom simpan masing
 * masing.
 *
 * Urutan diubah lewat tombol geser saat hover dan seret-lepas. Bila daftar
 * memuat foto tautan lama tanpa assetId, geseran dibatasi dalam kelompoknya
 * (kelompok aset atau kelompok tautan) karena penyimpanan menaruh aset lebih
 * dulu; tanpa aturan itu urutan di layar bisa berbeda dari hasil simpan.
 */
export function MediaGallerySection({
  title,
  items,
  onChange,
  max = 10,
  icon = "image",
  legacy,
  errors = [],
}: {
  /** Judul kartu; jumlah foto ditambahkan otomatis jadi "(N foto)". */
  title: string
  items: MediaGalleryItem[]
  onChange: (next: MediaGalleryItem[]) => void
  /** Kuota total foto, termasuk gambar utama. */
  max?: number
  icon?: string
  /** Gambar utama lama berbasis URL di luar daftar; tampil sebagai ubin Utama yang bisa dilepas. */
  legacy?: { url: string; onClear: () => void } | null
  errors?: Array<string | undefined>
}) {
  const penuh = items.length >= max
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)

  function tambah(picked: PickedMedia[]) {
    const ada = new Set(items.map((item) => item.assetId).filter(Boolean))
    const next = [...items]
    for (const aset of picked) {
      if (ada.has(aset.assetId)) continue
      if (next.length >= max) break
      ada.add(aset.assetId)
      next.push({
        key: `lib-${aset.assetId}`,
        assetId: aset.assetId,
        url: aset.thumbUrl,
        label: aset.label,
      })
    }
    onChange(next)
  }

  function pindah(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return
    const dipindah = items[from]
    const sekelompok = (lain: MediaGalleryItem) => Boolean(lain.assetId) === Boolean(dipindah.assetId)
    let ke = to
    while (ke >= 0 && ke < items.length && !sekelompok(items[ke])) {
      ke += to > from ? 1 : -1
    }
    if (ke < 0 || ke >= items.length || ke === from) return
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(ke, 0, item)
    onChange(next)
  }

  function hapus(key: string) {
    onChange(items.filter((item) => item.key !== key))
  }

  const pesanError = errors.filter(Boolean) as string[]

  const ubinTambah = (
    <li>
      <MediaPickerSheet
        title={title}
        multiple
        onPick={tambah}
        trigger={(open) => (
          <button
            type="button"
            onClick={open}
            aria-label="Tambah media dari Media Library"
            className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-foreground"
          >
            <Icon name="plus" className="size-5" aria-hidden="true" />
          </button>
        )}
      />
    </li>
  )

  return (
    <SectionCard
      title={`${title} (${items.length} foto)`}
      icon={icon}
      action={
        penuh ? null : (
          <MediaPickerSheet
            title={title}
            multiple
            onPick={tambah}
            trigger={(open) => (
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={open}
                title="Tambah media dari Media Library"
              >
                <Icon name="plus" className="size-3.5" aria-hidden="true" />
                Tambah
              </Button>
            )}
          />
        )
      }
    >
      {items.length === 0 && legacy ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          <li className="relative select-none">
            <span className="pointer-events-none relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
              <img
                src={legacy.url}
                alt="Gambar utama lama"
                className="pointer-events-none size-full object-cover select-none"
                draggable={false}
              />
              <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">
                Utama
              </span>
            </span>
            <button
              type="button"
              onClick={legacy.onClear}
              className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
              aria-label="Hapus gambar utama lama"
              title="Hapus gambar utama lama"
            >
              <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </li>
          {penuh ? null : ubinTambah}
        </ul>
      ) : items.length ? (
        <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {items.map((item, index) => (
            <li
              key={item.key}
              className={cn(
                "group relative cursor-grab select-none transition-transform active:cursor-grabbing",
                dragIndex === index ? "scale-95 opacity-40" : "opacity-100",
              )}
              draggable
              onDragStart={(event) => {
                setDragIndex(index)
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", String(index))
              }}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = "move"
              }}
              onDrop={(event) => {
                event.preventDefault()
                const dariTeks = event.dataTransfer?.getData("text/plain")
                const from = dragIndex !== null ? dragIndex : dariTeks ? parseInt(dariTeks, 10) : null
                if (from !== null && !isNaN(from)) pindah(from, index)
                setDragIndex(null)
              }}
              onDragEnd={() => setDragIndex(null)}
            >
              <span className="pointer-events-none relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
                {item.url ? (
                  <img
                    src={item.url}
                    alt=""
                    className="pointer-events-none size-full object-cover select-none"
                    draggable={false}
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon name="image" className="size-5" aria-hidden="true" />
                  </span>
                )}
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">
                    Utama
                  </span>
                ) : null}
                {!item.assetId ? (
                  <span
                    className="absolute right-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow"
                    title="Foto lama dari tautan luar. Masih tampil di storefront; hapus lalu pilih ulang dari Media Library bila ingin menggantinya."
                  >
                    URL
                  </span>
                ) : null}
              </span>

              {/* Tombol geser cepat kiri/kanan di hover */}
              <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={(event) => {
                    event.stopPropagation()
                    pindah(index, index - 1)
                  }}
                  className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                  title="Geser ke kiri"
                >
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={(event) => {
                    event.stopPropagation()
                    pindah(index, index + 1)
                  }}
                  className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                  title="Geser ke kanan"
                >
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => hapus(item.key)}
                className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
                aria-label={`Hapus ${item.label || "media"}`}
                title="Hapus foto"
              >
                <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </li>
          ))}
          {penuh ? null : ubinTambah}
        </ul>
      ) : (
        <MediaPickerSheet
          title={title}
          multiple
          onPick={tambah}
          trigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-surface-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            >
              <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
              <span className="text-xs font-medium">Unggah atau pilih media dari Media Library</span>
            </button>
          )}
        />
      )}
      {pesanError.map((pesan) => (
        <p key={pesan} className="mt-2 text-xs text-destructive">
          {pesan}
        </p>
      ))}
    </SectionCard>
  )
}
