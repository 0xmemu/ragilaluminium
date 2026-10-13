import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * Tombol salin tunggal untuk seluruh panel admin.
 *
 * Dipakai bersama oleh Orders Index/Show, Payments, Shipping, Vouchers, dan
 * Performa Toko supaya perilaku salin tidak berbeda antar halaman.
 *
 * Perilaku:
 * - Menghentikan propagasi klik supaya tidak memicu aksi baris di tabel.
 * - Pakai Clipboard API bila tersedia, lalu jatuh ke execCommand untuk
 *   konteks tidak aman (HTTP internal) atau browser lama.
 * - Umpan balik ikon berubah ke centang selama 1,5 detik.
 */
export function CopyButton({
  text,
  label = "Salin",
  className,
  compact = false,
  showTextInTitle = false,
  onCopied,
}: {
  text: string
  label?: string
  className?: string
  /** Ukuran rapat tanpa lingkar tombol, untuk baris tabel padat. */
  compact?: boolean
  /** Sertakan nilai yang disalin di judul dan label aksesibilitas. */
  showTextInTitle?: boolean
  onCopied?: () => void
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        onCopied?.()
        return
      }
    } catch {
      // Clipboard API ditolak atau tidak tersedia, lanjut ke fallback.
    }

    try {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.setAttribute("readonly", "")
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      setCopied(true)
      onCopied?.()
    } catch {
      // Kedua jalur gagal: biarkan admin menyalin manual tanpa umpan balik palsu.
    }
  }

  const judul = copied ? "Tersalin!" : showTextInTitle ? `${label} ${text}` : label

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center justify-center text-muted-foreground transition hover:bg-muted hover:text-foreground",
        compact ? "rounded p-0.5" : "size-5 shrink-0 rounded",
        className,
      )}
      aria-label={judul}
      title={judul}
    >
      <Icon
        name={copied ? "check" : "copy"}
        className={cn("size-3", copied ? "text-success" : "text-muted-foreground")}
        aria-hidden="true"
      />
    </button>
  )
}
