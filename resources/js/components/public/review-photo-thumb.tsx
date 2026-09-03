import * as React from "react"

import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"

/**
 * Thumbnail foto ulasan (satu sumber untuk semua halaman).
 *
 * - Ukuran & radius konsisten (size-14, radius 3px) sesuai DS v2.
 * - Mode "button": bisa diklik (buka preview) dengan hover zoom halus.
 * - Mode "static": hanya gambar, opsional overlay +N (badge count).
 */
export function ReviewPhotoThumb({
  src,
  alt,
  asButton = false,
  onButtonClick,
  buttonClassName,
  ariaLabel,
  overlayCount,
}: {
  src: string
  alt: string
  asButton?: boolean
  onButtonClick?: () => void
  buttonClassName?: string
  ariaLabel?: string
  overlayCount?: number
}) {
  const body = (
    <>
      <ResponsiveImage
        src={src}
        alt={alt}
        wrapperClassName="size-full bg-surface-muted"
        className={cn(
          "size-full object-cover",
          asButton && "transition duration-300 group-hover/img:scale-[1.03]",
        )}
      />
      {typeof overlayCount === "number" ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50">
          <span className="text-base font-semibold leading-none tabular-nums text-white">
            +{overlayCount}
          </span>
        </span>
      ) : null}
    </>
  )

  if (asButton) {
    return (
      <button
        type="button"
        onClick={onButtonClick}
        className={cn(
          "group/img relative size-14 shrink-0 overflow-hidden rounded-[3px] bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          buttonClassName,
        )}
        aria-label={ariaLabel ?? alt}
      >
        {body}
      </button>
    )
  }

  return (
    <span className="relative size-14 shrink-0 overflow-hidden rounded-[3px] bg-surface-muted">
      {body}
    </span>
  )
}
