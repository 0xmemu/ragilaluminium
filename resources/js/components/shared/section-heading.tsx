import type { ReactNode } from "react"

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
}) {
  const heading = children ?? title

  return (
    <div
      className={cn(
        "flex gap-5",
        align === "center"
          ? "mx-auto max-w-3xl flex-col items-center text-center"
          : "flex-row items-start justify-between gap-3 sm:items-end",
        className,
      )}
    >
      <div className={cn("min-w-0 flex-1", align === "center" && "mx-auto w-full")}>
        {eyebrow ? (
          <p
            className={cn(
              "mb-1.5 text-xs font-semibold uppercase tracking-tight text-primary sm:text-sm",
              align === "center" ? "mx-auto text-center" : "text-left",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          id={id}
          className={cn(
            size === "display"
              ? "text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              : "text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl",
            align === "center" && size === "display" && "text-center",
          )}
        >
          {heading}
        </h2>
        {description ? (
          <p
            className={cn(
              "mt-3 text-sm leading-6 text-muted-foreground",
              align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className={cn("shrink-0", align === "center" && "mt-2 flex justify-center")}>
          {action}
        </div>
      ) : null}
    </div>
  )
}
