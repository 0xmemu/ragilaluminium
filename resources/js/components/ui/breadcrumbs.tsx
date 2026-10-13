import { Link, router } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { backFallbackHref, shouldUseHistoryBack } from "@/lib/breadcrumb-back"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem { label: string; href?: string | null }

export function Breadcrumbs({ items, className, tone = "default", singleLine = false }: {
  items: BreadcrumbItem[]
  className?: string
  tone?: "default" | "onDark"
  singleLine?: boolean
}) {
  if (!items.length) return null

  // Tombol kembali SELALU tampil. Sebelumnya tombol disembunyikan saat riwayat
  // browser kosong, dan di desktop itu berarti tidak ada tombol kembali sama
  // sekali (mulai 768px tombol di samping judul memang sengaja disembunyikan,
  // lihat docs/STANDAR-DESAIN-HALAMAN-PUBLIK.md bagian 4). Riwayat browser tidak
  // bisa dipercaya: tab baru, alamat yang diketik langsung, dan browser dalam
  // aplikasi bisa melaporkannya sebagai 1. Saat riwayat kosong, tombol memakai
  // href induk terdekat dari breadcrumb itu sendiri.
  const fallbackHref = backFallbackHref(items, routeUrl("home"))

  function goBack() {
    if (typeof window !== "undefined" && shouldUseHistoryBack(window.history.length)) {
      window.history.back()
      return
    }
    router.visit(fallbackHref)
  }

  return <nav aria-label="Breadcrumb" className={cn("flex items-center gap-2", className)}>
    <button
      type="button"
      onClick={goBack}
      className={cn(
        "inline-flex size-11 shrink-0 -ml-2.5 items-center justify-center rounded-full transition-colors",
        tone === "onDark"
          ? "text-white/70 hover:bg-white/10 hover:text-white"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      aria-label="Kembali ke halaman sebelumnya"
    >
      <Icon name="arrow-left" className="size-5" weight="bold" aria-hidden="true" />
    </button>
    <ol className={cn("flex items-center gap-2 text-xs font-medium", singleLine ? "flex-nowrap overflow-hidden" : "flex-wrap", tone === "onDark" ? "text-white/55" : "text-muted-foreground")}>
      {items.map((item, index) => {
        const current = index === items.length - 1
        return <li key={`${item.label}-${index}`} className={cn("flex min-w-0 items-center gap-2", singleLine && current ? "flex-1" : "shrink-0")}>
          {index > 0 ? <Icon name="chevron-right" className={cn("h-3.5 w-3.5 shrink-0", tone === "onDark" ? "text-white/35" : undefined)} aria-hidden="true" /> : null}
          {item.href && !current ? <Link href={item.href} className={cn("inline-flex min-h-11 items-center transition", tone === "onDark" ? "text-white/70 hover:text-white" : "hover:text-foreground")}>{item.label}</Link> :
            <span className={cn(singleLine && current ? "block truncate" : undefined, current ? tone === "onDark" ? "text-white" : "text-foreground" : undefined)} aria-current={current ? "page" : undefined} title={singleLine && current ? item.label : undefined}>{item.label}</span>}
        </li>
      })}
    </ol>
  </nav>
}
