export type RouteParameters = Record<string, string | number | boolean | null | undefined>

export function routeUrl(
  name: string,
  parameters?: RouteParameters,
  fallback = "/",
): string {
  try {
    if (!route().has(name)) return fallback
    // Relative URLs keep Inertia on the current origin (critical for WSL/IP e2e hosts).
    return route(name, parameters, false)
  } catch {
    return fallback
  }
}

export function isRouteActive(patterns: string[] | undefined): boolean {
  if (!patterns?.length) return false

  try {
    return patterns.some((pattern) => Boolean(route().current(pattern)))
  } catch {
    return false
  }
}

export function withQuery(
  href: string,
  parameters: Record<string, string | number | null | undefined>,
): string {
  const url = new URL(href, window.location.origin)

  Object.entries(parameters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      url.searchParams.delete(key)
    } else {
      url.searchParams.set(key, String(value))
    }
  })

  return `${url.pathname}${url.search}${url.hash}`
}
