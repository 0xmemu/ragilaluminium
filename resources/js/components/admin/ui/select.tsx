import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/** Admin select — native select dengan chevron konsisten, hairline + focus teal. */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <span className={cn("relative inline-flex w-full items-center", className)}>
      <select
        ref={ref}
        className="h-9 min-h-9 w-full appearance-none rounded-md border border-input bg-surface py-2 pl-3 pr-8 text-sm text-foreground transition duration-150 ease-standard hover:border-foreground/20 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70"
        {...props}
      >
        {children}
      </select>
      <Icon
        name="caret-down"
        className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground"
        weight="bold"
        aria-hidden="true"
      />
    </span>
  ),
)
Select.displayName = "Select"

export { Select }
