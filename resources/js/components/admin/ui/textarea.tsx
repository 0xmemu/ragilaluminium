import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 4, ...props }, ref) => (
  <textarea
    rows={rows}
    className={cn(
      "flex min-h-24 w-full resize-y rounded-md border border-input bg-surface px-3 py-2.5 text-sm leading-6 text-foreground transition duration-150 ease-standard placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive/15",
      className,
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
