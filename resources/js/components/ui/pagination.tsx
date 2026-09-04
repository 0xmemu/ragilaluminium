import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

type PaginationLinkKind = "previous" | "next" | "ellipsis" | "page"

function parsePaginationLink(label: string): { kind: PaginationLinkKind; text: string } {
  const cleaned = label.replace(/&[^;]+;/g, "").trim()
  const lower = cleaned.toLowerCase()

  if (lower.includes("previous") || lower.includes("sebelum")) {
    return { kind: "previous", text: "Sebelumnya" }
  }

  if (lower.includes("next") || lower.includes("berikut")) {
    return { kind: "next", text: "Berikutnya" }
  }

  if (cleaned === "...") {
    return { kind: "ellipsis", text: "..." }
  }

  return { kind: "page", text: cleaned }
}

/**
 * Hitung daftar nomor halaman yang tampil dengan ellipsis, adaptif terhadap slot.
 * Misal total=10, current=5, visible=5 -> [1, "...", 4, 5, 6, "...", 10].
 * Aturan: halaman pertama & terakhir SELALU tampil; jendela tengah mengikuti jumlah slot.
 */
function buildVisiblePages(lastPage: number, current: number, visible: number): Array<number | "gap"> {
  if (lastPage <= visible) {
    return Array.from({ length: lastPage }, (_, i) => i + 1)
  }

  // Jumlah nomor halaman murni di antara dua ellipsis (first & last tak termasuk jatah)
  const middleCount = Math.max(3, visible - 2)
  let start = Math.max(2, current - Math.floor((middleCount - 1) / 2))
  const end = Math.min(lastPage - 1, start + middleCount - 1)
  // Geser balik bila mendekati akhir
  start = Math.max(2, end - middleCount + 1)

  const pages: Array<number | "gap"> = [1]
  if (start > 2) pages.push("gap")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < lastPage - 1) pages.push("gap")
  pages.push(lastPage)
  return pages
}

/**
 * Satu komponen pagination reusable untuk semua halaman publik/admin.
 * Adaptif: jumlah dot menyusut mengikuti lebar layar (container query),
 * jika sempit tampil mis. < 1 ... 4 5 6 ... 10 >.
 */
export function Pagination({ pagination, className }: { pagination?: PaginationData | null; className?: string }) {
  if (!pagination || pagination.last_page <= 1) return null

  const currentPage = pagination.current_page ?? 1
  const lastPage = pagination.last_page
  const prevUrl = pagination.links.find((l) => l.label.toLowerCase().includes("previous") || l.label.toLowerCase().includes("sebelum"))
  const nextUrl = pagination.links.find((l) => l.label.toLowerCase().includes("next") || l.label.toLowerCase().includes("berikut"))

  const pages = buildVisiblePages(lastPage, currentPage, 5)

  const navButton = (kind: "previous" | "next", url: string | null | undefined) => {
    const label = kind === "previous" ? "Sebelumnya" : "Berikutnya"
    const content = (
      <>
        <span className="sr-only">{label}</span>
        <Icon name={kind === "previous" ? "arrow-left" : "arrow-right"} className="h-3.5 w-3.5" aria-hidden="true" />
      </>
    )
    const classes = cn(
      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs transition",
      url
        ? "border-border bg-surface text-foreground hover:border-foreground/30 hover:bg-accent"
        : "cursor-not-allowed border-border bg-surface text-muted-foreground opacity-40",
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
    <nav className={cn("mt-5 flex items-center justify-center gap-2 border-t border-border py-5", className)} aria-label="Paginasi">
      <div className="pag-viewport flex items-center justify-center gap-2">
        {navButton("previous", prevUrl?.url)}

        {/* Tablet & desktop: daftar halaman adaptif dengan ellipsis.
            Breakpoint konsisten (sm=640px) agar devtools mobile & HP asli
            menampilkan varian yang sama. */}
        <div className="hidden items-center justify-center gap-2 sm:flex">
          {pages.map((page, index) =>
            page === "gap" ? (
              <span key={`gap-${index}`} className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-xs font-medium text-muted-foreground">
                …
              </span>
            ) : (
              (() => {
                const active = page === currentPage
                const href = pagination.links.find((l) => l.label === String(page))?.url
                const classes = cn(
                  "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-xs tabular-nums transition",
                  active
                    ? "border-primary bg-primary font-semibold text-primary-foreground shadow-sm"
                    : "border-border bg-surface font-medium text-foreground hover:border-foreground/30 hover:bg-accent",
                )
                return href && !active ? (
                  <Link key={page} href={href} preserveScroll className={classes} aria-label={`Halaman ${page}`}>
                    {page}
                  </Link>
                ) : (
                  <span key={page} className={classes} aria-current={active ? "page" : undefined}>
                    {page}
                  </span>
                )
              })()
            ),
          )}
        </div>

        {/* Layar sangat sempit (<420px): hanya halaman aktif + total */}
        <span className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3 text-xs font-medium tabular-nums text-foreground sm:hidden">
          {currentPage} / {lastPage}
        </span>

        {navButton("next", nextUrl?.url)}
      </div>
    </nav>
  )
}
