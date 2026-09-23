import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { AdminBottomNav } from "@/components/admin/admin-bottom-nav"
import { AdminCommandSearch } from "@/components/admin/admin-command-search"
import { ActivityLogBell, type ActivityLogItem } from "@/components/admin/activity-log-bell"
import { NotificationBell, type NotificationItem } from "@/components/admin/notification-bell"
import { LiveNotificationManager } from "@/components/admin/live-notification-manager"
import { AdminNavigation } from "@/components/admin/admin-navigation"
import { Button } from "@/components/admin/ui/button"
import { AdminBreadcrumbs, resolveAdminBreadcrumb } from "@/components/admin/ui/breadcrumb"
import { PageGuide } from "@/components/admin/page-guide"
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

      // Cmd/Ctrl + K - pola command palette ala AI app.
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

/** Nama route aktif, dibaca dari helper Ziggy global. Aman bila belum siap. */
function useCurrentRouteName(): string | undefined {
  return React.useMemo(() => {
    const current = (
      globalThis as {
        route?: (...args: unknown[]) => { current: (p?: string | string[]) => string | boolean | undefined }
      }
    ).route
    try {
      const value = current?.().current()
      return typeof value === "string" ? value : undefined
    } catch {
      return undefined
    }
  }, [])
}

/**
 * Penanda bahwa halaman sedang berada di dalam AdminShell.
 * Dipakai AdminLayout agar chrome tidak dibangun dua kali.
 */
const AdminShellContext = React.createContext(false)

/**
 * Persistent layout untuk seluruh halaman admin.
 *
 * Dipasang lewat `Component.layout` di app.tsx. Karena komponen shell-nya
 * sama untuk semua halaman admin, React TIDAK membongkar sidebar, header,
 * bell notifikasi, dan state tema saat pindah menu. Yang berganti hanya
 * frame halaman di dalamnya.
 */
export function adminShellLayout(page: React.ReactNode) {
  return <AdminShell>{page}</AdminShell>
}

/**
 * Chrome admin yang bertahan antar navigasi: sidebar, header, pencarian,
 * notifikasi, bottom nav, dan live notification manager.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { auth, adminNotifications, adminActivityLogs } = usePage<SharedPageProps>().props

  const notifications = (adminNotifications as NotificationItem[] | undefined) ?? []
  const activityLogs = (adminActivityLogs as ActivityLogItem[] | undefined) ?? []
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
  const userHandle = auth.user?.username ?? ""

  return (
    <AdminShellContext.Provider value={true}>
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
              <ActivityLogBell activityLogs={activityLogs} />
              <NotificationBell notifications={notifications} />

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
                    {userHandle ? (
                      <span className="block truncate font-mono text-xs font-normal text-muted-foreground">
                        {userHandle}
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

          {children}
        </div>
        <AdminBottomNav onOpenMenu={() => setNavigationOpen(true)} />
        <LiveNotificationManager />
      </div>
    </AdminShellContext.Provider>
  )
}

/**
 * Frame isi halaman admin: breadcrumb, judul, deskripsi, tombol aksi,
 * dan area konten. Bagian inilah yang berganti saat pindah menu.
 */
function AdminPageFrame({
  children,
  title,
  description,
  actions,
  backUrl,
  fullWidth = false,
}: {
  children: React.ReactNode
  title?: string
  description?: string | null
  actions?: React.ReactNode
  backUrl?: string | null
  fullWidth?: boolean
}) {
  const { nav } = usePage<SharedPageProps>().props
  const routeName = useCurrentRouteName()

  const breadcrumbItems = React.useMemo(
    () => resolveAdminBreadcrumb(nav?.admin ?? {}, routeName ?? ""),
    [nav, routeName],
  )

  return (
    <main
      id="admin-content"
      tabIndex={-1}
      className={`admin-main outline-none ${fullWidth ? "h-[calc(100vh-3.5rem)] overflow-hidden flex flex-col" : ""}`}
    >
      {!fullWidth && (title || actions) && (
        <div className="relative px-4 pb-5 pt-6 md:px-6 lg:px-8">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 sm:flex-1">
              {/* Panduan sebaris dengan breadcrumb, rata kanan. Sebelumnya
                  diposisikan absolute di kanan atas sehingga menimpa tombol
                  aksi header saat baris aksi melebar (Simpan di Beranda,
                  Tambah di Halaman CMS), dan tombol itu jadi tidak bisa diklik. */}
              <div className="mb-[26px] flex w-full min-w-0 items-center gap-3">
                <AdminBreadcrumbs items={breadcrumbItems} className="min-w-0" />
                <PageGuide routeName={routeName} className="ml-auto shrink-0" />
              </div>
              {title && backUrl ? (
                <Link href={backUrl} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  <Icon name="arrow-left" className="size-3.5" aria-hidden="true" />
                  Kembali
                </Link>
              ) : null}
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
      <div className={fullWidth ? "flex-1 min-h-0 w-full overflow-hidden p-0" : "w-full px-4 pb-24 pt-4 md:px-6 md:pt-5 lg:px-8 lg:pb-10"}>
        {children}
      </div>
    </main>
  )
}

export function AdminLayout({
  children,
  title,
  description,
  actions,
  backUrl,
  fullWidth = false,
}: {
  children: React.ReactNode
  title?: string
  description?: string | null
  actions?: React.ReactNode
  backUrl?: string | null
  fullWidth?: boolean
}) {
  const insideShell = React.useContext(AdminShellContext)

  const frame = (
    <AdminPageFrame
      title={title}
      description={description}
      actions={actions}
      backUrl={backUrl}
      fullWidth={fullWidth}
    >
      {children}
    </AdminPageFrame>
  )

  // Sudah dibungkus persistent layout (AdminShell) oleh Inertia: cukup frame.
  // Belum dibungkus (dipakai langsung): render shell sekalian.
  return insideShell ? frame : <AdminShell>{frame}</AdminShell>
}

export default AdminLayout
