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
    // content-start: sel yang diregangkan baris grid tidak mendorong kontrol turun,
    // jadi label+input antar kolom selalu lurus sebaris.
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
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

/**
 * Grid standar form admin (owner 2026-09-17): content-start menjaga label dan
 * kontrol antar kolom tetap lurus sebaris, walau salah satu sel punya hint
 * atau error yang membuat tinggi selnya berbeda.
 */
export function FieldGrid({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-4 sm:grid-cols-2 [&>*]:min-w-0", className)}>
      {children}
    </div>
  )
}

/**
 * Checkbox yang satu baris dengan field lain (owner 2026-09-17). Spacer
 * setinggi baris label dipakai pada sm+ supaya centang sejajar dengan kontrol
 * di sebelahnya. Pakai standalone untuk checkbox baris penuh tanpa spacer.
 */
export function CheckboxField({
  id,
  checked,
  onChange,
  label,
  className,
  standalone = false,
  disabled = false,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  className?: string
  standalone?: boolean
  disabled?: boolean
}) {
  const control = (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center text-sm font-medium",
        standalone ? "min-h-11 gap-3 font-semibold" : "h-9 min-h-9 gap-2",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className={cn("h-4 w-4 accent-primary", standalone ? null : "translate-y-px")}
      />
      {label}
    </label>
  )

  if (standalone) {
    return <div className={className}>{control}</div>
  }

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <span
        aria-hidden="true"
        className="hidden select-none text-[13px] font-medium sm:block"
      >
        &nbsp;
      </span>
      {control}
    </div>
  )
}

/**
 * Tombol atau aksi lain yang harus sejajar dengan kontrol field di sebelahnya.
 */
export function FieldAction({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <span
        aria-hidden="true"
        className="hidden select-none text-[13px] font-medium sm:block"
      >
        &nbsp;
      </span>
      <div className="flex min-h-9 items-center">{children}</div>
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
