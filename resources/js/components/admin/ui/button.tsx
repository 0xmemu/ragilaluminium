import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Admin button — bahasa desain "Paper": rounded-lg, hairline, teal accent.
 * API drop-in dengan components/ui/button (variant & size names sama).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium tracking-tight transition duration-150 ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover",
        secondary:
          "border border-border bg-surface text-foreground shadow-soft hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        subtle: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        destructive:
          "border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10",
        "destructive-solid":
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90",
        link: "h-auto min-h-0 rounded-none px-0 text-primary underline-offset-4 hover:underline",
        sale: "bg-sale text-primary-foreground shadow-soft hover:bg-sale/90",
      },
      size: {
        xs: "h-7 min-h-7 gap-1 px-2.5 text-xs",
        sm: "h-8 min-h-8 px-3 text-xs",
        md: "h-9 min-h-9 px-4",
        lg: "h-10 min-h-10 px-5",
        icon: "h-9 w-9 min-h-9 px-0",
        "icon-sm": "h-8 w-8 min-h-8 px-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Component = asChild ? Slot : "button"

    return (
      <Component
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...(!asChild ? { type } : {})}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
