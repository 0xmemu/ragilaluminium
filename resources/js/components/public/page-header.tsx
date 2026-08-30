import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Header halaman seragam (satu elemen `<header>` tunggal):
 * tombol kembali (mobile) + judul + area aksi opsional di kanan.
 * `container` (default true): beri padding container-page sendiri.
 * Set `container={false}` bila sudah berada di dalam `.container-page` induk.
 */
export function PageHeader({
  title,
  backLabel = "Kembali",
  onBack,
  right,
  container = true,
  className,
}: {
  title: ReactNode
  backLabel?: string
  onBack?: () => void
  right?: ReactNode
  container?: boolean
  className?: string
}) {
  return (
    <header
      className={cn(
        container && "container-page !px-2.5 md:!px-8 lg:!px-12",
        "flex min-h-11 items-center gap-2 border-b border-border pt-1 pb-2 sm:pt-1.5 sm:pb-2.5",
        className,
      )}
    >
      <button
        type="button"
        onClick={onBack ?? (() => window.history.back())}
        className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={backLabel}
      >
        <Icon name="arrow-left" className="size-5" aria-hidden="true" />
      </button>
      <h1 className="min-w-0 flex-1 text-base font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </header>
  )
}
