import * as React from "react"

import { Button, type ButtonProps } from "@/components/admin/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/admin/ui/dialog"
import { Field } from "@/components/admin/ui/field"
import { Textarea } from "@/components/admin/ui/textarea"

export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  processing = false,
  variant = "destructive",
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = false,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  confirmLabel: string
  onConfirm: (reason?: string) => void
  processing?: boolean
  variant?: ButtonProps["variant"]
  /** When set, shows an optional/required reason textarea. */
  reasonLabel?: string
  reasonPlaceholder?: string
  reasonRequired?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [reason, setReason] = React.useState("")
  const showReason = Boolean(reasonLabel)
  const reasonMissing = reasonRequired && showReason && reason.trim() === ""

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setReason("")
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-2">{description}</DialogDescription>
        </div>
        {showReason ? (
          <Field id="confirm-reason" label={reasonLabel!} className="mt-1">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={reasonPlaceholder}
              rows={3}
              maxLength={500}
            />
          </Field>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={processing}>
            Batal
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              if (reasonMissing) return
              onConfirm(showReason ? reason.trim() || undefined : undefined)
              setOpen(false)
              setReason("")
            }}
            disabled={processing || reasonMissing}
          >
            {processing ? "Memproses..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
