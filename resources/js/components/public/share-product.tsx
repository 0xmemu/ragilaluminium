import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

interface ShareProductProps {
  title: string
  url: string
}

function whatsappShareUrl(title: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Continue with the legacy fallback below when clipboard permissions are denied.
  }

  try {
    const textarea = document.createElement("textarea")
    textarea.value = value
    textarea.setAttribute("readonly", "")
    textarea.style.position = "fixed"
    textarea.style.opacity = "0"
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand("copy")
    textarea.remove()
    return copied
  } catch {
    return false
  }
}

/**
 * Share-to-contact actions for a PDP. This is intentionally separate from the
 * business WhatsApp consultation CTA and from automated order notifications.
 */
export function ShareProduct({ title, url }: ShareProductProps) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function"

  async function shareFromDevice() {
    if (!canNativeShare) return

    try {
      await navigator.share({ title, text: `Lihat produk ini: ${title}`, url })
      setOpen(false)
    } catch (error) {
      // Closing the native sheet is a normal user action, not an error state.
      if ((error as DOMException)?.name === "AbortError") return
    }
  }

  async function copyProductLink() {
    const success = await copyText(url)
    if (!success) return

    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition",
            "hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label="Bagikan produk"
          aria-expanded={open}
          title="Bagikan produk"
        >
          <Icon name="share" className="size-[18px]" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-2">
        <DropdownMenuLabel className="px-2">Bagikan produk</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canNativeShare ? (
          <DropdownMenuItem
            className="min-h-11"
            onSelect={(event) => {
              event.preventDefault()
              void shareFromDevice()
            }}
          >
            <Icon name="share" className="mr-2 size-4" aria-hidden="true" />
            Bagikan dari perangkat
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild className="min-h-11">
          <a
            href={whatsappShareUrl(title, url)}
            target="_blank"
            rel="noreferrer"
            aria-label="Bagikan ke WhatsApp"
          >
            <Icon name="whatsapp" className="mr-2 size-4" aria-hidden="true" />
            WhatsApp
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-11"
          onSelect={(event) => {
            event.preventDefault()
            void copyProductLink()
          }}
        >
          <Icon name={copied ? "check" : "copy"} className="mr-2 size-4" aria-hidden="true" />
          {copied ? "Tautan tersalin" : "Salin tautan"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
