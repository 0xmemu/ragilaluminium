import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"

/**
 * Thumbnail foto ulasan (satu sumber untuk semua halaman).
 *
 * - Ukuran & radius konsisten (size-14, radius 3px) sesuai DS v2.
 * - Mode "button": bisa diklik (buka preview) dengan hover zoom halus.
 * - Mode "static": hanya gambar, opsional overlay +N (badge count).
 * - Video ulasan dirender sebagai elemen video dengan lencana putar.
 */
export function ReviewPhotoThumb({
  src,
  alt,
  isVideo = false,
  asButton = false,
  onButtonClick,
  buttonClassName,
  ariaLabel,
  overlayCount,
}: {
  src: string
  alt: string
  /** Pratinjau video ulasan: memakai elemen video, bukan gambar. */
  isVideo?: boolean
  asButton?: boolean
  onButtonClick?: () => void
  buttonClassName?: string
  ariaLabel?: string
  overlayCount?: number
}) {
  const body = (
    <>
      {isVideo ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className={cn(
            "size-full object-cover",
            asButton && "transition duration-300 group-hover/img:scale-[1.03]",
          )}
        />
      ) : (
        <ResponsiveImage
          src={src}
          alt={alt}
          wrapperClassName="size-full bg-surface-muted"
          className={cn(
            "size-full object-cover",
            asButton && "transition duration-300 group-hover/img:scale-[1.03]",
          )}
        />
      )}
      {isVideo ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 text-white">
          <Icon name="play" weight="fill" className="size-5 drop-shadow" aria-hidden="true" />
        </span>
      ) : null}
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
