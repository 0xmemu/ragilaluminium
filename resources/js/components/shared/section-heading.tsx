import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "center",
  className,
}: {
  eyebrow?: string
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
        {eyebrow ? (
          <p className="text-[11px] font-bold tracking-tight text-sale">{eyebrow}</p>
        ) : null}
        <h2 className={cn("text-lg font-bold tracking-tight sm:text-xl md:text-2xl", eyebrow && "mt-2")}>
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
