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
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
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
        <header className="sticky top-0 z-header flex min-h-[4.5rem] items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-xl md:px-6">
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground transition hover:bg-accent lg:hidden"
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
            className="mr-auto hidden min-h-11 w-[min(28vw,22rem)] items-center gap-3 rounded-md border border-border bg-surface px-3.5 text-left text-sm text-muted-foreground transition hover:border-foreground/25 lg:flex"
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
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Cari menu admin"
            >
              <Icon name="search" className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
              title={theme === "dark" ? "Mode terang" : "Mode gelap"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="h-5 w-5" aria-hidden="true" />
            </button>
            <Link
              href={routeUrl("admin.profile.edit")}
              className="hidden text-right transition hover:opacity-80 sm:block"
            >
              <p className="text-xs font-semibold text-foreground">{auth.user?.name ?? "Administrator"}</p>
              <p className="text-[10px] text-muted-foreground">{auth.user?.email}</p>
            </Link>
            <Link
              href={routeUrl("logout")}
              method="post"
              as="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Keluar dari admin"
            >
              <Icon name="sign-out" className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <AdminCommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

        <FlashMessages />
        <main id="admin-content" tabIndex={-1} className="outline-none">
          {(title || actions) && (
            <div className="border-b border-border bg-surface/65 px-4 py-6 md:px-6 lg:px-8">
              <div className="mx-auto flex max-w-page flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  {title ? <h1 className="text-3xl font-semibold tracking-tight">{title}</h1> : null}
                  {description ? (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
                  ) : null}
                </div>
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </div>
            </div>
          )}
          <div className="mx-auto max-w-page p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
