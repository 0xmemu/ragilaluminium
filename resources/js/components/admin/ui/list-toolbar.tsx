import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"
import { Input } from "./input"

interface ListToolbarSearch {
  value: string
  onChange: (value: string) => void
  onSubmit?: (event: React.FormEvent) => void
  placeholder?: string
}

interface ListToolbarProps {
  /** Kontrol utama pencarian — elemen terbesar, di sisi kiri zona control. */
  search?: ListToolbarSearch
  /** Kontrol pengurutan — berdekatan dengan search dalam zona kiri. */
  sort?: React.ReactNode
  /** Grup filter / view toggle — satu blok rapi dalam zona kiri. */
  children?: React.ReactNode
  /** Info ringkas (jumlah / nilai) — dekat dengan action group di kanan. */
  summary?: React.ReactNode
  /** Action buttons — satu group konsisten di sisi paling kanan. */
  actions?: React.ReactNode
  className?: string
}

/**
 * Baris kontrol seragam untuk halaman daftar dashboard.
 *
 * Satu sistem grid dua zona dengan hierarki visual yang tegas:
 *   Zona kiri  (tumbuh / flex-1): [search (terbesar)] [sort] [filter · view toggle]
 *   Zona kanan (auto):            [summary] [actions]
 *
 * Search selalu menjadi kontrol utama (elemen terluas). Filter dikelompokkan
 * menjadi satu blok sejajar dengan search. Info ringkas ditempatkan dekat
 * dengan action group. Zona kanan didorong ke tepi kanan oleh pertumbuhan
 * zona kiri — tanpa margin manual. Pada viewport sempit seluruh zona pindah
 * utuh ke baris berikutnya (grid menumpuk), bukan elemen terpecah acak.
 */
export function ListToolbar({
  search,
  sort,
  children,
  summary,
  actions,
  className,
}: ListToolbarProps) {
  return (
    <div className={cn("mt-4", className)}>
      <div className="grid items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {search ? (
            <form
              className="relative min-w-0 flex-1 basis-72"
              onSubmit={(event) => {
                event.preventDefault()
                search.onSubmit?.(event)
              }}
            >
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? "Cari…"}
                className="pl-9"
                data-admin-search
              />
            </form>
          ) : null}

          {sort ? <div className="shrink-0">{sort}</div> : null}

          {children ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
          ) : null}
        </div>

        {summary || actions ? (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {summary ? (
              <div className="whitespace-nowrap text-xs text-muted-foreground">{summary}</div>
            ) : null}
            {actions ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}