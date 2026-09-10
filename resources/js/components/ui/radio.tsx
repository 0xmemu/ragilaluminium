import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className"> {
  className?: string
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <label
        className={cn(
          "relative inline-flex cursor-pointer items-center gap-3",
          props.disabled && "cursor-not-allowed opacity-55",
          className,
        )}
      >
        <input
          ref={ref}
          type="radio"
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-full border border-input bg-surface transition peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:border-primary peer-checked:bg-primary peer-checked:[&_svg]:opacity-100 peer-disabled:opacity-50"
        >
          <Icon name="circle" weight="fill" className="size-[62%] text-primary-foreground opacity-0 transition" />
        </span>
        {children ? <span className="min-w-0 flex-1">{children}</span> : null}
      </label>
    )
  },
)
Radio.displayName = "Radio"
