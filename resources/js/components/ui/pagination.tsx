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

export function Pagination({ pagination }: { pagination?: PaginationData | null }) {
  if (!pagination || pagination.last_page <= 1) return null

  return (
    <nav
      className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Paginasi"
    >
      <p className="text-sm text-muted-foreground">
        Halaman <span className="font-semibold text-foreground">{pagination.current_page}</span> dari{" "}
        <span className="font-semibold text-foreground">{pagination.last_page}</span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {pagination.links.map((link, index) => {
          const { kind, text } = parsePaginationLink(link.label)
          const isNav = kind === "previous" || kind === "next"
          const isEllipsis = kind === "ellipsis"

          const content = isEllipsis ? (
            <span aria-hidden="true">{text}</span>
          ) : isNav ? (
            <>
              <span className="sr-only">{text}</span>
              {kind === "previous" ? (
                <Icon name="arrow-left" className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
              )}
            </>
          ) : (
            <span className="tabular-nums">{text}</span>
          )

          const classes = cn(
            "inline-flex items-center justify-center text-sm font-semibold transition",
            isEllipsis
              ? "min-h-11 w-8 px-0 text-muted-foreground"
              : cn(
                  "h-11 w-11 shrink-0 rounded-full border",
                  link.active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground hover:border-foreground/20 hover:bg-accent",
                  !link.url && "cursor-not-allowed opacity-45",
                ),
          )

          return link.url ? (
            <Link
              key={`${link.label}-${index}`}
              href={link.url}
              preserveScroll
              className={classes}
              aria-current={link.active ? "page" : undefined}
              aria-label={isNav ? text : undefined}
            >
              {content}
            </Link>
          ) : (
            <span
              key={`${link.label}-${index}`}
              className={classes}
              aria-disabled="true"
              aria-label={isNav ? text : undefined}
            >
              {content}
            </span>
          )
        })}
      </div>
    </nav>
  )
}
