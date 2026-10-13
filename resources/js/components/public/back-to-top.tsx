import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Tombol kembali ke atas - muncul setelah scroll, sembunyi saat di atas. */
export function BackToTop() {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-[calc(var(--mobile-bottom-nav-height)+var(--mobile-sticky-cta-height)+1rem)] right-3 z-40 aspect-square rounded-full p-0",
        buttonVariants({ variant: "primary", size: "icon" }) + " size-10 shadow-md !bg-foreground/70 !text-background backdrop-blur-sm",
        "transition-colors duration-200 hover:!bg-foreground",
        "lg:bottom-6 lg:right-6",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <Icon name="chevron-up" className="size-6" aria-hidden="true" />
    </button>
  )
}
