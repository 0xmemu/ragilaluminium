import { Link } from "@inertiajs/react"
import * as React from "react"

import { cn } from "@/lib/utils"

export interface AdminBreadcrumbItem {
  label: string
  href?: string | null
}

/**
 * Breadcrumb admin reusable (Wave 1).
 *
 * Pola: Beranda / [Grup] / [Halaman] / [Detail|Edit]
 * - Dipakai hanya utk halaman NON top-level (items.length >= 2).
 * - Dibangun dari metadata sitemap/nav (`resolveAdminBreadcrumb`), bukan hardcode
 *   per halaman. Halaman detail/edit boleh memberi label akhir via `tail`.
 */
export function AdminBreadcrumbs({
  items,
  className,
}: {
  items: AdminBreadcrumbItem[]
  className?: string
}) {
  if (items.length < 2) return null

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-1.5 text-xs", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <span aria-hidden="true" className="shrink-0 text-muted-foreground/50">
                /
              </span>
            ) : null}
            {isLast ? (
              <span className="truncate font-semibold text-foreground" aria-current="page">
                {item.label}
              </span>
            ) : item.href ? (
              <Link
                href={item.href}
                className="shrink-0 truncate text-muted-foreground transition hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className="shrink-0 truncate text-muted-foreground">{item.label}</span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

/**
 * Bangun breadcrumb dari nav sitemap admin.
 *
 * @param nav admin nav dari props (nav.admin) — bentuk:
 *   { [groupId]: { title?: string, items: Array<{ label, route?, active?, children? }> } }
 * @param routeName nama route aktif, mis. "admin.orders.show"
 * @param tail label akhir opsional (mis. "Detail Pesanan", "Edit Produk")
 */
export function resolveAdminBreadcrumb(
  nav: Record<string, { title?: string | null; items?: Array<{ label: string; route?: string; active?: string[]; children?: Array<{ label: string; route?: string; active?: string[] }> }> }>,
  routeName: string,
  tail?: string | null,
): AdminBreadcrumbItem[] {
  const crumbs: AdminBreadcrumbItem[] = [{ label: "Beranda", href: "/admin" }]

  for (const group of Object.values(nav ?? {})) {
    for (const item of group?.items ?? []) {
      const activeRoutes = [...(item.active ?? []), item.route ? `${item.route}*` : ""]
      const isItemActive = activeRoutes.some((pattern) => routeMatches(pattern, routeName))
      if (!isItemActive) continue

      if (group?.title) crumbs.push({ label: group.title })
      crumbs.push({ label: item.label, href: item.route ? `/${item.route.replace(/\./g, "/").replace(/\/\*/g, "")}` : null })

      // cari child yang aktif
      const child = item.children?.find((c) => [...(c.active ?? []), c.route ? `${c.route}*` : ""].some((p) => routeMatches(p, routeName)))
      if (child) crumbs.push({ label: child.label, href: child.route ? `/${child.route.replace(/\./g, "/")}` : null })

      if (tail) crumbs.push({ label: tail })
      break
    }
  }

  return crumbs
}

function routeMatches(pattern: string, routeName: string): boolean {
  const p = pattern.replace(/\/\*$/g, "").replace(/\*/g, ".*")
  const regex = new RegExp(`^${p}$`)
  return regex.test(routeName)
}
