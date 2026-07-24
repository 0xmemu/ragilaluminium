import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold tracking-tight transition duration-200 ease-standard active:scale-[0.98] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border border-foreground bg-surface text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        subtle: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link:
          "h-auto min-h-0 rounded-full px-0 text-primary underline-offset-4 hover:underline",
        sale:
          "bg-sale text-primary-foreground hover:bg-primary-hover",
      },
      size: {
        xs: "h-8 min-h-8 gap-1 px-2 text-xs",
        sm: "h-9 min-h-9 px-3 text-[11px]",
        md: "min-h-11 px-5",
        lg: "min-h-12 px-8 text-sm",
        icon: "h-11 w-11 min-h-11 rounded-full px-0",
        "icon-sm": "h-8 w-8 min-h-8 rounded-full px-0",
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
