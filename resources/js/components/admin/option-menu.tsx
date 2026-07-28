import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

export type OptionMenuItem = {
  value: string
  label: string
}

type OptionMenuProps = {
  id?: string
  label: string
  value: string
  options: OptionMenuItem[]
  onChange: (value: string) => void
  className?: string
  align?: "left" | "right"
}

export function OptionMenu({
  id,
  label,
  value,
  options,
  onChange,
  className,
  align = "right",
}: OptionMenuProps) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-semibold text-foreground transition hover:bg-muted"
      >
        <span className="max-w-[9rem] truncate">{selected?.label ?? label}</span>
        <Icon
          name="chevron-down"
          className={cn("size-3.5 text-muted-foreground transition", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={label}
          className={cn(
            "absolute top-full z-50 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-surface py-1 shadow-md",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-xs font-semibold transition",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
