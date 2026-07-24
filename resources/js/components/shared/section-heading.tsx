import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/**
 * Satu heading section untuk Home / HowToOrder / CMS About / dll.
 * - `default`: skala katalog (lg → 2xl)
 * - `display`: skala About (2xl → 3xl), biasanya dengan `id` anchor
 */
export function SectionHeading({
  title,
  description,
  action,
  align = "center",
  className,
  id,
  children,
  size = "default",
}: {
  title?: ReactNode
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
        "flex flex-col gap-5",
        align === "center"
          ? "mx-auto max-w-3xl items-center text-center"
          : "md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className={cn(align === "center" && "mx-auto w-full")}>
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
