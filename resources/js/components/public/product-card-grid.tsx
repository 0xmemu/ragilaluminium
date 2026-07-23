import * as React from "react"

import { cn } from "@/lib/utils"

/** Satu standar kolom untuk ProductCard di Home / Catalog / Search / PDP. */
/* Gutter 1.25rem (20px) mengikuti grid IKEA. */
export const productCardGridClassName =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5"

export function ProductCardGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(productCardGridClassName, className)}>{children}</div>
}
