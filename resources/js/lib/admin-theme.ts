const STORAGE_KEY = "ragil-admin-theme"

export type AdminTheme = "light" | "dark"

export function readAdminTheme(): AdminTheme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

export function writeAdminTheme(theme: AdminTheme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // private mode / blocked storage — ignore
  }
}

/** Apply theme on <html>. Call cleanup on leave admin so storefront stays light. */
export function applyAdminTheme(theme: AdminTheme): () => void {
  const root = document.documentElement
  const meta = document.querySelector('meta[name="theme-color"]')

  if (theme === "dark") {
    root.classList.add("dark")
    meta?.setAttribute("content", "#151512")
  } else {
    root.classList.remove("dark")
    meta?.setAttribute("content", "#F7F6F2")
  }

  return () => {
    root.classList.remove("dark")
    meta?.setAttribute("content", "#F4F6F5")
  }
}
