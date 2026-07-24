import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

interface ResponsiveImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null
  alt: string
  wrapperClassName?: string
}

export function ResponsiveImage({
  src,
  alt,
  className,
  wrapperClassName,
  loading = "lazy",
  onError,
  onLoad,
  ...props
}: ResponsiveImageProps) {
  const [failed, setFailed] = React.useState(false)
  const canRender = Boolean(src) && !failed

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-[linear-gradient(145deg,hsl(var(--muted)),hsl(var(--secondary)))]",
        wrapperClassName,
      )}
    >
      {canRender ? (
        <img
          src={src ?? undefined}
          alt={alt}
          loading={loading}
          className={cn(
            "absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 ease-standard",
            className,
          )}
          onLoad={(event) => {
            event.currentTarget.classList.remove("opacity-0")
            onLoad?.(event)
          }}
          onError={(event) => {
            setFailed(true)
            onError?.(event)
          }}
          {...props}
        />
      ) : (
        <div
          className="flex h-full min-h-[inherit] w-full items-center justify-center text-muted-foreground"
          role="img"
          aria-label={alt}
        >
          <Icon name="image" className="h-8 w-8" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
