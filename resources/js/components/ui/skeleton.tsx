import { productCardGridClassName } from "@/components/public/product-card-grid"
import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("skeleton-shimmer rounded-md bg-muted", className)}
    />
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={productCardGridClassName} aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="product-card">
          <div className="product-card__media">
            <Skeleton className="size-full rounded-none" />
          </div>
          <div className="product-card__content">
            <Skeleton className="h-8 w-full rounded-sm" />
            <div className="product-card__pricing">
              <Skeleton className="h-5 w-3/4 rounded-sm" />
              <Skeleton className="mt-0.5 h-4 w-1/2 rounded-sm" />
            </div>
            <div className="product-card__extras">
              <Skeleton className="h-4 w-1/3 rounded-sm" />
            </div>
            <div className="product-card__meta">
              <Skeleton className="h-3 w-1/2 rounded-sm" />
              <Skeleton className="h-3 w-1/3 rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
