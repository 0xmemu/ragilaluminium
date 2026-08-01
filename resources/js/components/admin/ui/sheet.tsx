import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "left" | "right" | "bottom"
  }
>(({ className, children, side = "right", ...props }, ref) => {
  const sides = {
    left: "inset-y-0 left-0 h-full w-[min(90vw,22rem)] border-r",
    right: "inset-y-0 right-0 h-full w-[min(90vw,26rem)] border-l",
    bottom: "inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-xl border-t",
  }

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-foreground/40 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-[70] overflow-y-auto border-border bg-surface p-5 shadow-float focus:outline-none",
          sides[side],
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">Panel samping</DialogPrimitive.Title>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">
          <Icon name="x" className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Tutup</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
})
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetTitle = DialogPrimitive.Title
const SheetDescription = DialogPrimitive.Description

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger }
