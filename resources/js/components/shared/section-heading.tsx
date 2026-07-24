import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function SectionHeading({
  title,
  description,
  action,
  align = "center",
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  align?: "left" | "center"
  className?: string
}) {
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
        <h2 className="text-lg font-bold tracking-tight sm:text-xl md:text-2xl">
          {title}
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
        <div className={cn("shrink-0", align === "center" && "mt-2 flex justify-center")}>{action}</div>
      ) : null}
    </div>
  )
}
