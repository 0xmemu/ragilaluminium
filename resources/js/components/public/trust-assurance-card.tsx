import { usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import type { SharedPageProps } from "@/types"

/** Teks bawaan, sama dengan INITIAL_TEXT['trust'] di CtaSettings. */
const FALLBACK_TITLE = "Belanja Aman & Terpercaya"
const FALLBACK_BODY = "Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik."

/**
 * Kartu jaminan belanja - dipakai berulang di halaman transaksi (keranjang,
 * checkout, konfirmasi pesanan, daftar pesanan, pelacakan).
 *
 * Teksnya diatur admin lewat Pengaturan Website > CTA Storefront, blok
 * "Kartu Jaminan (semua halaman)". Props title/body menjadi cadangan bila
 * pengaturan belum tersedia, supaya tampilan tidak pernah kosong.
 */
export function TrustAssuranceCard({
  className,
  title,
  body,
}: {
  className?: string
  title?: string
  body?: string
}) {
  const { ctaSettings } = usePage<SharedPageProps>().props
  const configured = ctaSettings?.pages?.trust
  const resolvedTitle = configured?.eyebrow || title || FALLBACK_TITLE
  const resolvedBody = configured?.heading || body || FALLBACK_BODY

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-surface-muted px-3 py-3.5",
        className,
      )}
    >
      <Icon
        name="shield-check"
        className="mt-0.5 h-6 w-6 shrink-0 text-copper"
        weight="regular"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-tight text-foreground">{resolvedTitle}</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{resolvedBody}</p>
      </div>
    </div>
  )
}
