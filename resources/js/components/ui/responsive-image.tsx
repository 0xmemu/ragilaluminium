import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

interface ResponsiveImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null
  alt: string
  wrapperClassName?: string
  /** Keep the image area occupied with a shimmer until the asset is ready. */
  skeleton?: boolean
}

export function ResponsiveImage({
  src,
  alt,
  className,
  wrapperClassName,
  loading = "lazy",
  skeleton = true,
  onLoad,
  onError,
  ...props
}: ResponsiveImageProps) {
  const [failed, setFailed] = React.useState(false)
  const [loaded, setLoaded] = React.useState(false)
  const canRender = Boolean(src) && !failed

  React.useEffect(() => {
    // A changed variant/media source starts a fresh loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false)
    setLoaded(false)
  }, [src])

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden bg-[linear-gradient(145deg,hsl(var(--muted)),hsl(var(--secondary)))]",
        wrapperClassName,
      )}
      aria-busy={canRender && !loaded ? true : undefined}
    >
      {canRender ? (
        <>
          <img
            src={src ?? undefined}
            alt={alt}
            loading={loading}
            className={cn("absolute inset-0 h-full w-full object-cover", className)}
            onLoad={(event) => {
              setLoaded(true)
              onLoad?.(event)
            }}
            onError={(event) => {
              setFailed(true)
              setLoaded(true)
              onError?.(event)
            }}
            {...props}
          />
          {skeleton && !loaded ? (
            <span
              className="pointer-events-none absolute inset-0 skeleton-shimmer bg-muted transition-opacity duration-200"
              aria-hidden="true"
            />
          ) : null}
        </>
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
