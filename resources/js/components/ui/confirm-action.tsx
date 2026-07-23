import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  processing = false,
  variant = "destructive",
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  processing?: boolean
  variant?: ButtonProps["variant"]
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-3">{description}</DialogDescription>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={processing}>
            Batal
          </Button>
          <Button variant={variant} onClick={() => {
            onConfirm()
            setOpen(false)
          }} disabled={processing}>
            {processing ? "Memproses..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
