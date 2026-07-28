import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { AdminCommandSearch } from "@/components/admin/admin-command-search"
import { AdminNavigation } from "@/components/admin/admin-navigation"
import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { FlashMessages } from "@/components/shared/flash-messages"
import { Icon } from "@/components/shared/icon"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import {
  applyAdminTheme,
  readAdminTheme,
  writeAdminTheme,
  type AdminTheme,
} from "@/lib/admin-theme"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

export function AdminLayout({
  children,
  title,
  description,
  actions,
}: {
  children: React.ReactNode
  title?: string
  description?: string | null
  actions?: React.ReactNode
}) {
  const { auth } = usePage<SharedPageProps>().props
  const [navigationOpen, setNavigationOpen] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<AdminTheme>(() => readAdminTheme())

  React.useEffect(() => {
    return applyAdminTheme(theme)
  }, [theme])

  React.useEffect(() => {
    document.documentElement.classList.add("admin-shell")
    return () => document.documentElement.classList.remove("admin-shell")
  }, [])

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.key !== "/" || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
      if (target.isContentEditable) return
      event.preventDefault()
      setSearchOpen(true)
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  function toggleTheme() {
    setTheme((current) => {
      const next: AdminTheme = current === "dark" ? "light" : "dark"
      writeAdminTheme(next)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[12rem_minmax(0,1fr)]">
      <a
        href="#admin-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition focus:translate-y-0"
      >
        Lewati ke konten admin
      </a>
      <aside className="sticky top-0 hidden h-screen lg:block">
        <AdminNavigation />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-header flex min-h-[2.75rem] items-center gap-2 border-b border-border bg-surface px-3 md:px-4 lg:px-5">
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground transition hover:bg-accent lg:hidden"
                aria-label="Buka navigasi admin"
              >
                <Icon name="menu" className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SheetTitle className="sr-only">Navigasi admin</SheetTitle>
              <SheetDescription className="sr-only">
                Pilih modul operasional Ragil Aluminium.
              </SheetDescription>
              <AdminNavigation onNavigate={() => setNavigationOpen(false)} />
            </SheetContent>
          </Sheet>

          <BrandWordmark
            compact
            href={routeUrl("admin.dashboard")}
            className="mr-auto lg:hidden"
          />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="mr-auto hidden h-8 max-w-xl flex-1 items-center gap-2 rounded border border-border bg-muted/40 px-2.5 text-left text-[11px] text-muted-foreground transition hover:border-foreground/25 lg:flex xl:max-w-lg"
            aria-label="Cari menu admin"
          >
            <Icon name="search" className="h-4 w-4" aria-hidden="true" />
            <span className="flex-1">Cari menu admin</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              /
            </kbd>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Cari menu admin"
            >
              <Icon name="search" className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
              title={theme === "dark" ? "Mode terang" : "Mode gelap"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link
              href={routeUrl("admin.profile.edit")}
              className="hidden text-right transition hover:opacity-80 sm:block"
            >
              <p className="max-w-[9rem] truncate text-[11px] font-semibold text-foreground">
                {auth.user?.name ?? "Administrator"}
              </p>
            </Link>
            <Link
              href={routeUrl("logout")}
              method="post"
              as="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Keluar dari admin"
            >
              <Icon name="sign-out" className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <AdminCommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

        <FlashMessages />
        <main id="admin-content" tabIndex={-1} className="admin-main outline-none">
          {(title || actions) && (
            <div className="border-b border-border bg-surface px-3 py-2.5 md:px-4 lg:px-5">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  {title ? <h1 className="text-base font-semibold tracking-tight">{title}</h1> : null}
                  {description ? (
                    <p className="mt-1 max-w-3xl text-[11px] leading-4 text-muted-foreground">{description}</p>
                  ) : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-1.5">{actions}</div> : null}
              </div>
            </div>
          )}
          <div className="w-full p-2.5 md:p-3 lg:p-4">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
