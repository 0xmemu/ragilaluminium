import type { ReactNode } from "react"

import { usePage } from "@inertiajs/react"
import * as React from "react"
import { AnnouncementBar } from "@/components/public/announcement-bar"
import { FlyingCart } from "@/components/public/flying-cart"

import { MobileBottomNav } from "@/components/public/mobile-bottom-nav"
import { PublicFooter } from "@/components/public/public-footer"
import { PublicHeader } from "@/components/public/public-header"
import { BackToTop } from "@/components/public/back-to-top"
import { FlashMessages } from "@/components/shared/flash-messages"

/**
 * Penanda bahwa halaman sedang berada di dalam PublicShell.
 * Dipakai PublicLayout agar chrome tidak dibangun dua kali.
 */
const PublicShellContext = React.createContext(false)

/**
 * Persistent layout untuk seluruh halaman publik.
 *
 * Dipasang lewat `Component.layout` di app.tsx. Karena shell-nya sama untuk
 * semua halaman publik, React tidak membongkar header, pengumuman, keranjang
 * terbang, footer, dan bottom nav saat berpindah halaman. Yang berganti hanya
 * isi <main>.
 */
export function publicShellLayout(page: ReactNode) {
  return <PublicShell>{page}</PublicShell>
}

/**
 * Chrome publik yang bertahan antar navigasi.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const { component } = usePage()
  const isHome = component === "Public/Home"

  return (
    <PublicShellContext.Provider value={true}>
      <div className="public-title-case min-h-screen overflow-x-clip bg-background text-body">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition focus:translate-y-0"
        >
          Lewati ke konten utama
        </a>
        {isHome ? <AnnouncementBar /> : null}
        <PublicHeader />
        <FlashMessages />
        {children}
        <FlyingCart />
        <BackToTop />
        <PublicFooter className="hidden lg:block" />
        {/* Clears fixed MobileBottomNav (no mobile footer per Figma) */}
        <div id="cta-bottom-marker" className="pb-mobile-nav lg:hidden" aria-hidden="true" />
        <MobileBottomNav />
      </div>
    </PublicShellContext.Provider>
  )
}

export function PublicLayout({ children }: { children: ReactNode }) {
  const insideShell = React.useContext(PublicShellContext)

  const frame = (
    <main id="main-content" tabIndex={-1} className="min-h-[55dvh] w-full min-w-0 max-w-full overflow-x-hidden outline-none">
      {children}
    </main>
  )

  // Sudah dibungkus persistent layout (PublicShell) oleh Inertia: cukup frame.
  // Belum dibungkus (dipakai langsung): render shell sekalian.
  return insideShell ? frame : <PublicShell>{frame}</PublicShell>
}

export default PublicLayout
