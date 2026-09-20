import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * Link aksi kecil preset untuk slot `action` SectionHeading (mis. "Lihat Semua").
 * Satu sumber gaya: dilarang copy-paste class ini per section.
 */
export function SectionHeadingAction({
  href,
  children,
  label,
  className,
}: {
  href: string
  children?: React.ReactNode
  /** Teks tombol dari pengaturan admin; menang atas children. */
  label?: string
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1 self-end px-1 text-[12px] font-bold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      <span className="shrink-0">{label ?? children}</span>
      <Icon name="arrow-right" weight="bold" className="size-4 shrink-0" aria-hidden="true" />
    </Link>
  )
}
