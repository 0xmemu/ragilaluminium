import * as React from "react"

import { cn } from "@/lib/utils"

/** Grid kartu non-produk (Model Produk / Hasil Pemasangan) — max 4 kolom. */
export const showcaseCardGridClassName =
  "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"

export function ShowcaseCardGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(showcaseCardGridClassName, className)}>{children}</div>
}

/** Satu standar kolom untuk ProductCard di Home / Catalog / Search / PDP. */
/* Gutter 1.25rem (20px) mengikuti grid IKEA. */
export const productCardGridClassName =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"

export function ProductCardGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn(productCardGridClassName, className)}>{children}</div>
}
