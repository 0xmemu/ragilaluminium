import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * Tombol bagikan produk (native share / salin tautan + feedback "Tersalin").
 */
export function ShareActionButton({ title, url, className }: { title: string; url: string; className?: string }) {
  const [copied, setCopied] = React.useState(false)

  async function handleShare() {
    if (typeof navigator === "undefined") return
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: `Lihat produk ini: ${title}`, url })
        return
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return
      }
    }
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        const textarea = document.createElement("textarea")
        textarea.value = url
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        document.body.appendChild(textarea)
        textarea.select()
        ok = document.execCommand("copy")
        textarea.remove()
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={cn("relative inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/70 text-background shadow-md backdrop-blur-sm transition hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      aria-label={copied ? "Tautan tersalin" : "Bagikan produk"}
      title={copied ? "Tautan tersalin" : "Bagikan produk"}
    >
      <Icon name={copied ? "check" : "share"} className="size-5" aria-hidden="true" />
      {copied ? (
        <span className="pointer-events-none absolute -bottom-1.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[9px] font-semibold text-background">
          Tersalin
        </span>
      ) : null}
    </button>
  )
}
