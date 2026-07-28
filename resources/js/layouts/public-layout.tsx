import type { ReactNode } from "react"

import { AnnouncementBar } from "@/components/public/announcement-bar"
import { MobileBottomNav } from "@/components/public/mobile-bottom-nav"
import { PublicFooter } from "@/components/public/public-footer"
import { PublicHeader } from "@/components/public/public-header"
import { FlashMessages } from "@/components/shared/flash-messages"

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-title-case min-h-screen overflow-x-clip bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition focus:translate-y-0"
      >
        Lewati ke konten utama
      </a>
      <AnnouncementBar />
      <PublicHeader />
      <FlashMessages />
      <main id="main-content" tabIndex={-1} className="min-h-[55dvh] outline-none">
        {children}
      </main>
      <PublicFooter className="hidden lg:block" />
      {/* Clears fixed MobileBottomNav (no mobile footer per Figma) */}
      <div className="pb-mobile-nav lg:hidden" aria-hidden="true" />
      <MobileBottomNav />
    </div>
  )
}

export default PublicLayout
