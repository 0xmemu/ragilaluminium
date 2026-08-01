import * as LabelPrimitive from "@radix-ui/react-label"
import * as React from "react"

import { cn } from "@/lib/utils"

interface FieldProps {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const descriptionId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className={cn("grid gap-1.5", className)}>
      <LabelPrimitive.Root htmlFor={id} className="text-[13px] font-medium text-foreground">
        {label}
        {required ? <span className="ml-1 text-primary" aria-hidden="true">*</span> : null}
      </LabelPrimitive.Root>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id,
            "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": Boolean(error),
          })
        : children}
      {hint ? (
        <p id={descriptionId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function FormErrorSummary({
  title = "Periksa kembali data berikut",
  errors,
  className,
}: {
  title?: string
  errors: Record<string, string>
  className?: string
}) {
  const messages = Object.values(errors).filter(Boolean)
  if (!messages.length) return null

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive",
        className,
      )}
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {messages.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ul>
    </div>
  )
}
