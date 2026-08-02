const STORAGE_KEY = "ragil-admin-theme"

export type AdminTheme = "light" | "dark"

/** Admin "Ink" adalah dark-first: default gelap, light jadi alternatif. */
export function readAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "dark"
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

export function writeAdminTheme(theme: AdminTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // private mode / blocked storage — ignore
  }
}

/**
 * Apply theme on <html>: dark = default (class "dark" untuk varian dark:),
 * light = class "light" yang membalik token ke palet terang.
 * Call cleanup on leave admin so storefront stays light.
 */
export function applyAdminTheme(theme: AdminTheme): () => void {
  const root = document.documentElement
  const meta = document.querySelector('meta[name="theme-color"]')

  if (theme === "light") {
    root.classList.remove("dark")
    root.classList.add("light")
    meta?.setAttribute("content", "#F7F6F2")
  } else {
    root.classList.add("dark")
    root.classList.remove("light")
    meta?.setAttribute("content", "#0B0B0B")
  }

  return () => {
    root.classList.remove("dark")
    root.classList.remove("light")
    meta?.setAttribute("content", "#F4F6F5")
  }
}
