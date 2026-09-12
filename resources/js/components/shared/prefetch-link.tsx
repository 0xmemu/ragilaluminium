import { Link } from "@inertiajs/react"
import * as React from "react"

import { useHoverPrefetch } from "@/lib/use-hover-prefetch"

type PrefetchLinkProps = React.ComponentProps<typeof Link>

/**
 * Link Inertia dengan prefetch hover yang aman.
 *
 * Pengganti prop `prefetch` bawaan Inertia: prefetch hanya dipicu oleh mouse dan
 * timer-nya dibatalkan saat link ditekan, sehingga satu klik selalu hanya
 * menghasilkan satu kunjungan. Di perangkat sentuh prefetch tidak dijalankan
 * sama sekali karena hover memang tidak ada di sana.
 *
 * Dipakai seluruh navigasi: kartu produk, kartu model, header publik, bottom
 * nav, sidebar admin, dan bottom nav admin.
 */
export function PrefetchLink({ href, ...props }: PrefetchLinkProps) {
  // router.prefetch hanya menerima URL string; bentuk lain dilewatkan apa adanya.
  const isPlainUrl = typeof href === "string"
  const { onPointerEnter, onPointerLeave, onPointerDown } = useHoverPrefetch(
    isPlainUrl ? href : "",
  )

  if (!isPlainUrl) {
    return <Link href={href} {...props} />
  }

  return (
    <Link
      href={href}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      {...props}
    />
  )
}

export default PrefetchLink
