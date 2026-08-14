import { Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { formatNumber } from "@/lib/format"
import type { ModelCardData } from "@/types"

/**
 * Kartu kategori x model (gaya Zalora): gambar 1:1 + badge merah jumlah
 * produk + judul + divider + "N model produk" + panah.
 * Dipakai di halaman Semua Model Produk dan carousel homepage.
 */
export function ModelCategoryCard({ model }: { model: ModelCardData }) {
  const href = model.detail_href?.trim() || model.href
  const designCount = model.designs?.length ?? 0

  return (
    <article className="group h-full overflow-hidden rounded-[5px] border border-[#dee3e0] bg-white transition-colors duration-200 hover:border-[#b9c2bd]">
      <Link
        href={href}
        prefetch
        className="flex h-full min-w-0 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-[#f7f8f8]">
          <ResponsiveImage
            src={model.image}
            alt={model.title}
            wrapperClassName="absolute inset-0"
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-2 left-2 rounded-[4px] bg-[#c20000] px-2 py-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
            {formatNumber(Number(model.count) || 0)} produk
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
          <h3 className="line-clamp-2 shrink-0 text-[13px] font-semibold leading-snug text-[#333333]">
            {model.title}
          </h3>
          <div className="flex-1" aria-hidden="true" />
          <div className="h-px w-full bg-[#dee3e0]" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] leading-snug text-[#666666]">
              {designCount > 0 ? `${formatNumber(designCount)} model produk` : "Model katalog"}
            </span>
            <Icon name="arrow-up-right" className="size-3.5 shrink-0 text-[#333333]" aria-hidden="true" />
          </div>
        </div>
      </Link>
    </article>
  )
}
