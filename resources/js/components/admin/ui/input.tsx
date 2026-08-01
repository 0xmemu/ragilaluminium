import * as React from "react"

import { cn } from "@/lib/utils"

/** Admin input — rounded-md, hairline border, focus ring teal lembut. */
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 min-h-9 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground transition duration-150 ease-standard placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:border-destructive aria-[invalid=true]:focus:ring-destructive/15",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = "Input"

export { Input }
