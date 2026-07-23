import type { AdminNavGroup, RouteNavItem } from "@/types"
import { routeUrl } from "@/lib/routes"

export type AdminSearchHit = {
  id: string
  label: string
  group: string
  href: string
  icon?: string
  route: string
}

export function flattenAdminNav(
  groups: Record<string, AdminNavGroup> | undefined | null,
): AdminSearchHit[] {
  if (!groups) return []

  const hits: AdminSearchHit[] = []

  Object.entries(groups).forEach(([key, group]) => {
    const groupTitle = group.title?.trim() || (key === "core" ? "Utama" : key)
    group.items.forEach((item: RouteNavItem) => {
      hits.push({
        id: `${key}:${item.route}`,
        label: item.label,
        group: groupTitle,
        href: routeUrl(item.route, item.params),
        icon: item.icon,
        route: item.route,
      })
    })
  })

  return hits
}

export function filterAdminSearchHits(hits: AdminSearchHit[], query: string): AdminSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return hits

  return hits.filter((hit) => {
    const haystack = `${hit.label} ${hit.group} ${hit.route}`.toLowerCase()
    return haystack.includes(q)
  })
}
