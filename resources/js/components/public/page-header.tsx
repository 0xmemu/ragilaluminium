import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

/**
 * Header halaman seragam untuk konten (TANPA tombol kembali — tombol kembali mobile
 * ditangani PageTopBar, agar tidak ada back ganda). Tombol kembali HANYA di PageTopBar.
 * `container` (default true): beri padding container-page sendiri.
 * Set `container={false}` bila sudah berada di dalam `.container-page` induk.
 */
export function PageHeader({
  title,
  right,
  container = true,
  className,
}: {
  title: ReactNode
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
      <h1 className="min-w-0 flex-1 text-base font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </header>
  )
}