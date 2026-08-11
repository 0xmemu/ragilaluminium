import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export function FileDropzone({
  id,
  accept,
  file,
  onFileChange,
  error,
  title = "Pilih atau jatuhkan file",
  hint,
  className,
}: {
  id: string
  accept?: string
  file: File | null
  onFileChange: (file: File | null) => void
  error?: string
  title?: string
  hint?: string
  className?: string
}) {
  const [dragging, setDragging] = React.useState(false)

  function handleFiles(files: FileList | null) {
    onFileChange(files?.[0] ?? null)
  }

  return (
    <div className={className}>
      <label
        htmlFor={id}
        onDragEnter={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          "flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-surface-muted/55 p-8 text-center transition",
          dragging ? "border-primary bg-accent" : "border-border hover:border-primary/45 hover:bg-accent",
          error && "border-destructive",
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
          <Icon name="upload" className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="mt-4 text-base font-semibold">
          {file ? file.name : title}
        </span>
        {hint ? (
          <span className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</span>
        ) : null}
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => handleFiles(event.target.files)}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
