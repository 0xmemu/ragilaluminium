import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import {
  buildVisiblePages,
  PAGINATION_MIDDLE_DESKTOP,
  PAGINATION_MIDDLE_MOBILE,
  type PaginationItem,
} from "@/lib/pagination"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

function PageNumbers({
  items,
  currentPage,
  links,
  className,
  itemClassName,
}: {
  items: PaginationItem[]
  currentPage: number
  links: PaginationData["links"]
  className?: string
  itemClassName?: string
}) {
  return (
    <div className={cn("items-center justify-center gap-1.5", className)}>
      {items.map((item, index) => {
        if (item === "gap") {
          return (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className={cn(
                "inline-flex items-center justify-center text-xs font-medium text-muted-foreground",
                itemClassName,
              )}
            >
              …
            </span>
          )
        }

        const active = item === currentPage
        const href = links.find((link) => link.label === String(item))?.url
        const classes = cn(
          "inline-flex size-9 min-w-9 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition",
          active
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-border bg-surface text-foreground hover:border-foreground/30 hover:bg-muted",
          itemClassName,
        )

        return href && !active ? (
          <Link
            key={item}
            href={href}
            preserveScroll
            className={classes}
            aria-label={`Halaman ${item}`}
          >
            {item}
          </Link>
        ) : (
          <span key={item} className={classes} aria-current={active ? "page" : undefined}>
            {item}
          </span>
        )
      })}
    </div>
  )
}

/**
 * Satu komponen pagination reusable untuk halaman publik.
 *
 * Nomor halaman tampil di SEMUA ukuran layar; yang menyesuaikan hanyalah
 * cakupan nomornya (kontrak owner 2026-09-16): desktop `1 2 3 4 … 8`,
 * mobile `1 2 3 … 8`. Dihitung dua varian sekaligus lalu dipilih lewat CSS
 * agar tidak ada perhitungan ulang saat resize maupun masalah hidrasi.
 */
export function Pagination({ pagination, className }: { pagination?: PaginationData | null; className?: string }) {
  if (!pagination || pagination.last_page <= 1) return null

  const currentPage = pagination.current_page ?? 1
  const lastPage = pagination.last_page
  const prevUrl = pagination.links.find((l) => l.label.toLowerCase().includes("previous") || l.label.toLowerCase().includes("sebelum"))
  const nextUrl = pagination.links.find((l) => l.label.toLowerCase().includes("next") || l.label.toLowerCase().includes("berikut"))

  const desktopPages = buildVisiblePages(lastPage, currentPage, PAGINATION_MIDDLE_DESKTOP)
  const mobilePages = buildVisiblePages(lastPage, currentPage, PAGINATION_MIDDLE_MOBILE)

  const navButton = (kind: "previous" | "next", url: string | null | undefined) => {
    const label = kind === "previous" ? "Sebelumnya" : "Berikutnya"
    const content = (
      <>
        <span className="sr-only">{label}</span>
        <Icon name={kind === "previous" ? "arrow-left" : "arrow-right"} className="size-4" aria-hidden="true" />
      </>
    )
    const classes = cn(
      "inline-flex size-9 shrink-0 items-center justify-center rounded-full border text-xs transition",
      url
        ? "border-border bg-surface text-foreground hover:border-foreground/30 hover:bg-muted"
        : "cursor-not-allowed border-border/50 bg-surface text-muted-foreground/40 opacity-50",
    )
    return url ? (
      <Link href={url} preserveScroll className={classes} aria-label={label}>
        {content}
      </Link>
    ) : (
      <span className={classes} aria-disabled="true" aria-label={label}>
        {content}
      </span>
    )
  }

  return (
    <nav
      className={cn(
        "mt-2.5 w-full border-t border-border py-2.5",
        className,
      )}
      aria-label="Paginasi"
    >
      <div className="mx-auto flex w-full max-w-fit items-center justify-center gap-2">
        {navButton("previous", prevUrl?.url)}

        {/* Mobile (<640px): cakupan nomor lebih sedikit. */}
        <PageNumbers
          items={mobilePages}
          currentPage={currentPage}
          links={pagination.links}
          className="flex sm:hidden"
        />

        {/* Tablet & desktop: cakupan nomor lebih luas. */}
        <PageNumbers
          items={desktopPages}
          currentPage={currentPage}
          links={pagination.links}
          className="hidden sm:flex"
        />

        {navButton("next", nextUrl?.url)}
      </div>
    </nav>
  )
}
