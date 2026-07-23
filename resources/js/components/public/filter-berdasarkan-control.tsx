import * as React from "react"

import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface FilterBerdasarkanOption {
  value: string
  label: string
}

export const CATALOG_SORT_OPTIONS: FilterBerdasarkanOption[] = [
  { value: "newest", label: "Terbaru" },
  { value: "popular", label: "Populer" },
  { value: "price_asc", label: "Harga Terendah" },
  { value: "price_desc", label: "Harga Tertinggi" },
  { value: "name_asc", label: "Abjad" },
]

function SortArrowsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15.54 15.3252L17.689 13.1422C17.7329 13.0972 17.7853 13.0615 17.8433 13.0373C17.9012 13.013 17.9634 13.0007 18.0262 13.0009C18.089 13.0012 18.1511 13.0141 18.2088 13.0389C18.2665 13.0637 18.3186 13.0998 18.362 13.1452C18.4511 13.2385 18.5005 13.3628 18.5 13.4918C18.4994 13.6208 18.4489 13.7446 18.359 13.8372L15.385 16.8582C15.2991 16.9469 15.1815 16.998 15.058 17.0003C14.9345 17.0025 14.8151 16.9557 14.726 16.8702L11.653 13.9452C11.56 13.8556 11.5053 13.7335 11.5005 13.6044C11.4956 13.4754 11.541 13.3495 11.627 13.2532C11.6689 13.2063 11.7198 13.1683 11.7767 13.1415C11.8335 13.1148 11.8952 13.0997 11.958 13.0973C12.0208 13.0949 12.0835 13.1051 12.1422 13.1274C12.201 13.1497 12.2547 13.1837 12.3 13.2272L14.54 15.3582V7.4102C14.54 7.1842 14.764 7.0012 15.04 7.0012C15.316 7.0012 15.54 7.1842 15.54 7.4112V15.3262V15.3252ZM9.46 8.6422L11.7 10.7732C11.7454 10.8167 11.7991 10.8506 11.8578 10.8729C11.9166 10.8952 11.9792 10.9055 12.0421 10.9031C12.1049 10.9006 12.1665 10.8856 12.2234 10.8588C12.2803 10.832 12.3312 10.7941 12.373 10.7472C12.4591 10.6509 12.5045 10.525 12.4996 10.3959C12.4947 10.2669 12.44 10.1447 12.3469 10.0552L9.2739 7.1302C9.1849 7.0442 9.0654 6.997 8.9417 6.9991C8.8179 7.0012 8.7 7.0523 8.6139 7.1412L5.6409 10.1632C5.5511 10.2558 5.5006 10.3795 5.5 10.5086C5.4994 10.6376 5.5489 10.7618 5.6379 10.8552C5.6814 10.9005 5.7335 10.9367 5.7912 10.9614C5.8489 10.9862 5.911 10.9991 5.9738 10.9994C6.0366 10.9997 6.0988 10.9873 6.1567 10.9631C6.2146 10.9388 6.2671 10.9031 6.3109 10.8582L8.4599 8.6752V16.5912C8.4599 16.8172 8.6839 17.0002 8.9599 17.0002C9.2359 17.0002 9.4599 16.8172 9.4599 16.5902V8.6422Z"
        fill="currentColor"
      />
    </svg>
  )
}

export function SortOptionRows({
  value,
  options,
  onChange,
  className,
}: {
  value: string
  options: FilterBerdasarkanOption[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <ul
      className={cn(
        "overflow-hidden rounded-xl border border-[#DEDEDE] bg-surface divide-y divide-[#ECECEC]",
        className,
      )}
      role="listbox"
      aria-label="Urutkan"
    >
      {options.map((option) => {
        const selected = option.value === value

        return (
          <li key={option.value || "__default"} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-sm transition",
                selected
                  ? "bg-accent/60 font-semibold text-foreground"
                  : "text-foreground hover:bg-muted/50",
              )}
            >
              <span>{option.label}</span>
              {selected ? (
                <Icon name="check" className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <span className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function FilterBerdasarkanControl({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  id: string
  value: string
  options: FilterBerdasarkanOption[]
  onChange: (value: string) => void
  ariaLabel: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "inline-flex h-8 max-w-full items-stretch rounded-lg border border-[#DEDEDE] bg-surface transition hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            open && "border-foreground/25 shadow-soft",
            className,
          )}
        >
          <span className="flex min-w-0 items-center truncate pl-3 pr-0.5 text-sm text-[#262626]">
            {selected?.label}
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#262626]">
            <SortArrowsIcon className="h-6 w-6" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-[13.75rem] rounded-xl border border-[#DEDEDE] bg-surface p-2 shadow-[0_8px_28px_rgba(10,0,0,0.12)]"
      >
        <p className="px-2 pb-1.5 pt-0.5 text-xs font-bold tracking-tight text-muted-foreground">
          Urutkan
        </p>
        {options.map((option) => {
          const isSelected = option.value === value

          return (
            <DropdownMenuItem
              key={option.value || "__default"}
              onSelect={(event) => {
                event.preventDefault()
                onChange(option.value)
                setOpen(false)
              }}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm",
                isSelected && "bg-accent/70 font-semibold text-foreground",
              )}
            >
              <span className="flex-1">{option.label}</span>
              {isSelected ? (
                <Icon name="check" className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
