import { useLayoutEffect, useRef, type ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Satu heading section untuk Home / HowToOrder / CMS About / dll.
 * - `default`: skala katalog (lg → 2xl)
 * - `display`: skala About (2xl → 3xl), biasanya dengan `id` anchor
 */
export function SectionHeading({
  title,
  eyebrow,
  description,
  action,
  align = "center",
  className,
  id,
  children,
  size = "default",
  tone = "default",
  fitHeading = true,
  headingClassName,
}: {
  title?: ReactNode
  eyebrow?: ReactNode
  description?: ReactNode
  action?: ReactNode
  align?: "left" | "center"
  className?: string
  id?: string
  children?: ReactNode
  size?: "default" | "display"
  /** `on-primary` = teks putih di atas Signal Red / primary band. */
  tone?: "default" | "on-primary"
  /** Keep a page-specific heading size fixed instead of shrinking to one line. */
  fitHeading?: boolean
  headingClassName?: string
}) {
  const heading = children ?? title
  const onPrimary = tone === "on-primary"
  const headingRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const element = headingRef.current
    if (!element || !fitHeading) return

    const fit = () => {
      element.style.fontSize = ""
      const baseSize = Number.parseFloat(window.getComputedStyle(element).fontSize)
      const available = element.clientWidth
      const contentWidth = element.scrollWidth
      if (!baseSize || !available || contentWidth <= available) return

      const fittedSize = Math.max(14, baseSize * (available / contentWidth))
      element.style.fontSize = `${fittedSize}px`
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    if (element.parentElement) observer.observe(element.parentElement)
    return () => observer.disconnect()
  }, [fitHeading, heading])

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        align === "center" && "mx-auto max-w-3xl items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-semibold tracking-tight sm:text-sm",
            onPrimary ? "text-white/85" : "text-primary",
            align === "center" ? "mx-auto text-center" : "text-left",
          )}
        >
          {eyebrow}
        </p>
      ) : null}

      <div
        className={cn(
          "w-full",
          align === "left" && action
            ? "flex items-center justify-between gap-3"
            : align === "center"
              ? "text-center"
              : "",
        )}
      >
        <h2
          ref={headingRef}
          id={id}
          className={cn(
            "min-w-0 flex-1 whitespace-normal text-pretty",
            size === "display"
              ? "text-balance text-[clamp(1rem,5vw,1.875rem)] font-bold tracking-tight"
              : "text-[clamp(1.125rem,4.5vw,1.5rem)] font-bold tracking-tight",
            onPrimary ? "text-white" : "text-foreground",
            align === "center" && size === "display" && "text-center",
            headingClassName,
          )}
        >
          {heading}
        </h2>
        {align === "left" && action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {description ? (
        <p
          className={cn(
            "mt-1 text-sm leading-6",
            onPrimary ? "text-white/80" : "text-muted-foreground",
            align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl",
          )}
        >
          {description}
        </p>
      ) : null}

      {align === "center" && action ? (
        <div className="mt-2.5 flex shrink-0 justify-center">{action}</div>
      ) : null}
    </div>
  )
}
