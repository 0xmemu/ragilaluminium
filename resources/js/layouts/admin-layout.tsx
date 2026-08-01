import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { AdminCommandSearch } from "@/components/admin/admin-command-search"
import { AdminNavigation } from "@/components/admin/admin-navigation"
import { Button } from "@/components/admin/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/admin/ui/sheet"
import { FlashMessages } from "@/components/admin/ui/flash-messages"
import { Icon } from "@/components/shared/icon"
import {
  applyAdminTheme,
  readAdminTheme,
  writeAdminTheme,
  type AdminTheme,
} from "@/lib/admin-theme"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

function useSearchShortcut(onOpen: () => void) {
  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isEditable =
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable

      // Cmd/Ctrl + K — pola command palette ala AI app.
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpen()
        return
      }

      if (isEditable) return
      if (event.key === "/") {
        event.preventDefault()
        onOpen()
      }
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [onOpen])
}


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

  const openSearch = React.useCallback(() => setSearchOpen(true), [])
  useSearchShortcut(openSearch)

  function toggleTheme() {
    setTheme((current) => {
      const next: AdminTheme = current === "dark" ? "light" : "dark"
      writeAdminTheme(next)
      return next
    })
  }

  const userName = auth.user?.name ?? "Administrator"
  const userEmail = auth.user?.email ?? ""

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#admin-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition focus:translate-y-0"
      >
        Lewati ke konten admin
      </a>

      <aside className="sticky top-0 hidden h-screen border-r border-border lg:block">
        <AdminNavigation />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-header flex h-14 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
          <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Buka navigasi admin"
              >
                <Icon name="menu" className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(85vw,18rem)] p-0">
              <AdminNavigation onNavigate={() => setNavigationOpen(false)} />
            </SheetContent>
          </Sheet>

          <button
            type="button"
            onClick={openSearch}
            className="flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-border bg-surface px-3 text-left text-[13px] text-muted-foreground shadow-soft transition hover:border-foreground/20 sm:max-w-xs"
            aria-label="Cari menu admin"
          >
            <Icon name="search" className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1 truncate">Cari menu…</span>
            <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground sm:inline-flex">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
              title={theme === "dark" ? "Mode terang" : "Mode gelap"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} className="h-4 w-4" aria-hidden="true" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 items-center gap-2 rounded-full border border-border bg-surface pl-1 pr-2.5 shadow-soft transition hover:bg-muted"
                  aria-label="Menu akun admin"
                >
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {userName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[8rem] truncate text-xs font-medium text-foreground sm:block">
                    {userName}
                  </span>
                  <Icon name="caret-down" className="h-3 w-3 text-muted-foreground" weight="bold" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="normal-case">
                  <span className="block truncate text-[13px] font-semibold text-foreground">
                    {userName}
                  </span>
                  {userEmail ? (
                    <span className="block truncate text-xs font-normal text-muted-foreground">
                      {userEmail}
                    </span>
                  ) : null}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={routeUrl("admin.profile.edit")} className="w-full">
                    <Icon name="user" className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Profil saya
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={routeUrl("admin.settings.index")} className="w-full">
                    <Icon name="settings" className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Pengaturan sistem
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={routeUrl("logout")}
                    method="post"
                    as="button"
                    className="w-full text-destructive"
                  >
                    <Icon name="sign-out" className="h-4 w-4" aria-hidden="true" />
                    Keluar
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <AdminCommandSearch open={searchOpen} onOpenChange={setSearchOpen} />

        <FlashMessages />

        <main id="admin-content" tabIndex={-1} className="admin-main outline-none">
          {(title || actions) && (
            <div className="px-4 pb-5 pt-6 md:px-6 lg:px-8">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  {title ? (
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">
                      {title}
                    </h1>
                  ) : null}
                  {description ? (
                    <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
                      {description}
                    </p>
                  ) : null}
                </div>
                {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
              </div>
            </div>
          )}
          <div className="w-full px-4 pb-10 md:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout

