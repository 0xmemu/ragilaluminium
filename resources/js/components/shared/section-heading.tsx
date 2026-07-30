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
        "flex flex-col gap-1.5",
        align === "center" && "mx-auto max-w-3xl items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-semibold tracking-tight text-primary sm:text-sm",
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
            ? "flex items-baseline justify-between gap-4"
            : align === "center"
              ? "text-center"
              : "",
        )}
      >
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
        {align === "left" && action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {description ? (
        <p
          className={cn(
            "mt-1.5 text-sm leading-6 text-muted-foreground",
            align === "center" ? "mx-auto max-w-2xl" : "max-w-2xl",
          )}
        >
          {description}
        </p>
      ) : null}

      {align === "center" && action ? (
        <div className="mt-2 flex shrink-0 justify-center">{action}</div>
      ) : null}
    </div>
  )
}
