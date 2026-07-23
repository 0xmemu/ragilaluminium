import { Link } from "@inertiajs/react"

import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

export function Price({
  value,
  prefix,
  className,
  size = "md",
}: {
  value: number | string | null | undefined
  prefix?: string
  className?: string
  size?: "sm" | "md" | "lg"
}) {
  const sizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl font-bold",
  }

  return (
    <span className={cn("tabular-nums font-semibold text-foreground", sizes[size], className)}>
      {prefix ? <span className="mr-1 font-medium text-muted-foreground">{prefix}</span> : null}
      {formatCurrency(value)}
    </span>
  )
}

export function PriceLink({
  href,
  value,
  className,
}: {
  href: string
  value: number | string | null | undefined
  className?: string
}) {
  return (
    <Link href={href} className={cn("hover:text-primary", className)}>
      <Price value={value} />
    </Link>
  )
}
