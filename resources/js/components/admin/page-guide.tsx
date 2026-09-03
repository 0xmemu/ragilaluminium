import * as React from "react"

import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { adminPageGuides, type AdminPageGuide } from "@/config/admin-page-guides"

/**
 * PageGuide - tombol "< Panduan" satu baris dengan breadcrumb (rata kanan).
 * Membuka dropdown berisi panduan/keterangan cara bekerja di halaman ini.
 *
 * Konten panduan didefinisikan terpusat di `admin-page-guides.ts` berdasarkan
 * route admin; halaman tanpa panduan terdaftar tidak menampilkan tombol.
 */
export function PageGuide({ routeName, className }: { routeName?: string; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          aria-label="Buka panduan halaman"
        >
          <Icon name="circle-help" className="size-3.5" aria-hidden="true" />
          Panduan
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <PageGuideContent routeName={routeName} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PageGuideContent({ routeName }: { routeName?: string }) {
  const guide = React.useMemo(() => lookupGuide(routeName), [routeName])

  if (!guide) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Panduan untuk halaman ini belum tersedia.
      </div>
    )
  }

  return (
    <div className="p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        Panduan {guide.title}
      </p>
      <p className="mt-2 text-sm leading-6 text-foreground">{guide.summary}</p>
      {guide.steps.length ? (
        <ol className="mt-3 space-y-2">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex gap-2 text-[13px] leading-5 text-muted-foreground">
              <span className="tabular-nums shrink-0 font-bold text-primary/70">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {guide.notes?.length ? (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {guide.notes.map((note) => (
            <p key={note} className="text-xs leading-5 text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// Diisi dari registry terpusat; fallback aman bila route tidak terdaftar.
function lookupGuide(routeName?: string): AdminPageGuide | null {
  if (!routeName) return null
  return adminPageGuides[routeName] ?? null
}
