import * as React from "react"

import { SortArrowsIcon } from "@/components/public/filter-berdasarkan-control"
import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** Urutan ulasan: "all" = urutan bawaan halaman (default). */
export type ReviewSortValue = "all" | "newest" | "oldest"

export interface ReviewRatingCount {
  /** "1" sampai "5". */
  value: string
  /** Jumlah ulasan pada rating ini. */
  count: number
}

const SORT_LABELS: Record<ReviewSortValue, string> = {
  all: "Semua",
  newest: "Terbaru",
  oldest: "Terlama",
}

const SORT_OPTIONS: ReviewSortValue[] = ["all", "newest", "oldest"]

/** Pill dasar bersama untuk tiga filter di halaman ulasan. */
function pillClass(active: boolean, className?: string): string {
  return cn(
    "inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-surface text-foreground hover:border-foreground/25",
    className,
  )
}

/**
 * Tiga pill filter untuk daftar ulasan: urutan, kelengkapan media, dan rating.
 *
 * Dipakai bersama oleh halaman ulasan (/reviews/web dan /reviews/ss) dan
 * halaman model produk, supaya perilaku filter di semua tempat sama:
 * - Pill pertama: urutan ulasan (Semua, Terbaru, Terlama). Default "Semua".
 * - Pill kedua: hanya ulasan yang punya foto atau video.
 * - Pill ketiga: pilih rating 1 sampai 5. Boleh lebih dari satu rating, dan
 *   baru berlaku setelah tombol Terapkan ditekan. Tombol Hapus mengosongkan
 *   pilihan sekaligus menerapkannya, sehingga tidak pernah tampak tidak
 *   berfungsi bila ditekan tanpa menekan Terapkan.
 *
 *   Pilihan rating selalu lengkap 1 sampai 5, termasuk bintang yang belum
 *   punya ulasan (count 0), permintaan owner 2026-09-21.
 */
export function ReviewFilterPills({
  sort,
  onSortChange,
  mediaOnly,
  onMediaOnlyChange,
  ratings,
  selectedRatings,
  onRatingsChange,
  totalCount,
  className,
  idPrefix = "reviews",
  disabled = false,
}: {
  sort: ReviewSortValue
  onSortChange: (value: ReviewSortValue) => void
  mediaOnly: boolean
  onMediaOnlyChange: (value: boolean) => void
  /** Pilihan rating 1 sampai 5, urut menaik. `count` 0 berarti belum ada ulasan. */
  ratings: ReviewRatingCount[]
  selectedRatings: number[]
  onRatingsChange: (value: number[]) => void
  /** Jumlah seluruh ulasan, untuk label pill pertama. */
  totalCount: number
  className?: string
  idPrefix?: string
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState<"sort" | "rating" | null>(null)
  // Pilihan rating di dalam dropdown bersifat draf: baru dikirim ke pemanggil
  // saat Terapkan ditekan, atau saat Hapus ditekan. Draf disegarkan saat menu
  // dibuka (bukan lewat effect) supaya tidak memicu render berantai.
  const [draft, setDraft] = React.useState<number[]>(selectedRatings)

  function handleOpenChange(next: boolean) {
    if (next) setDraft(selectedRatings)
    setOpen(next ? "rating" : null)
  }

  const ratingLabel =
    selectedRatings.length === 0
      ? null
      : [...selectedRatings].sort((a, b) => a - b).join(",")

  function toggleDraft(value: number) {
    setDraft((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value].sort((a, b) => a - b),
    )
  }

  function applyDraft() {
    onRatingsChange(draft)
    setOpen(null)
  }

  function clearRatings() {
    setDraft([])
    onRatingsChange([])
    setOpen(null)
  }


  return (
    <div
      className={cn(
        "scrollbar-none -mx-1 flex items-center gap-2 overflow-x-auto px-1 py-0.5",
        className,
      )}
    >
      {/* Pill 1: urutan ulasan */}
      <DropdownMenu open={open === "sort"} onOpenChange={(next) => setOpen(next ? "sort" : null)}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            id={`${idPrefix}-sort`}
            className={pillClass(false)}
            aria-label="Urutkan ulasan"
            disabled={disabled}
          >
            <span>
              {SORT_LABELS[sort]} ({totalCount})
            </span>
            <SortArrowsIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[11rem]">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSortChange(option)
                setOpen(null)
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-muted",
                option === sort ? "text-primary" : "text-foreground",
              )}
            >
              {SORT_LABELS[option]}
              {option === sort ? (
                <Icon name="check" className="size-3.5" weight="bold" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pill 2: hanya ulasan berfoto atau bervideo */}
      <button
        type="button"
        id={`${idPrefix}-media`}
        aria-pressed={mediaOnly}
        onClick={() => onMediaOnlyChange(!mediaOnly)}
        className={pillClass(mediaOnly)}
        disabled={disabled}
      >
        <Icon name="image" className="size-3.5" weight={mediaOnly ? "fill" : "regular"} aria-hidden="true" />
        Foto/Video
      </button>

      {/* Pill 3: filter rating. Selalu tampil lengkap 1 sampai 5, termasuk
          bintang yang belum punya ulasan, supaya pilihannya tidak hilang. */}
      <DropdownMenu open={open === "rating"} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            id={`${idPrefix}-rating`}
            className={pillClass(ratingLabel !== null)}
            aria-label="Filter rating ulasan"
            disabled={disabled}
          >
            <Icon name="star" className="size-3.5" weight="fill" aria-hidden="true" />
            <span>{ratingLabel === null ? "Bintang" : `Bintang ${ratingLabel}`}</span>
            <SortArrowsIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[15rem] p-0">
          <div className="flex flex-col">
            {ratings.map((option) => {
              const value = Number(option.value)
              const checked = draft.includes(value)
              return (
                <button
                  key={option.value}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleDraft(value)}
                  className="flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground transition hover:bg-muted"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border transition",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
                    )}
                  >
                    {checked ? <Icon name="check" className="size-3" weight="bold" aria-hidden="true" /> : null}
                  </span>
                  {/* Jumlah ikon bintang mengikuti ratingnya, jadi "2 bintang"
                      tampil dengan dua bintang dan seterusnya. */}
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-warning" aria-hidden="true">
                    {Array.from({ length: value }).map((_, starIndex) => (
                      <Icon key={starIndex} name="star" className="size-3" weight="fill" />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.value} bintang</span>
                  <span className="tabular-nums shrink-0 text-muted-foreground">({option.count})</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2 border-t border-border p-2">
            <button
              type="button"
              onClick={clearRatings}
              className="h-8 flex-1 rounded-md border border-border bg-surface text-xs font-semibold text-foreground transition hover:bg-muted"
            >
              Hapus
            </button>
            <button
              type="button"
              onClick={applyDraft}
              className="h-8 flex-1 rounded-md bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary-hover"
            >
              Terapkan
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
