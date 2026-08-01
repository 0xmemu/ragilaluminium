import { Link } from "@inertiajs/react"
import type { ReactNode } from "react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { routeUrl } from "@/lib/routes"

export function AuthLayout({
  children,
  description,
}: {
  children: ReactNode
  description: string
}) {
  return (
    <main className="dark flex min-h-svh items-center justify-center bg-background px-4 py-8 text-foreground sm:px-6">
      <section className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-[0_10px_30px_hsl(0_0%_0%/0.24)]">
        <div className="h-0.5 w-full bg-primary" aria-hidden="true" />
        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <BrandWordmark variant="dark" />
            <span className="rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              Admin
            </span>
          </div>

          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-400">
              Akses ruang kerja
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-[1.75rem]">
              Masuk ke panel admin
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <div className="mt-7">{children}</div>

          <Link
            href={routeUrl("home")}
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke beranda
          </Link>
        </div>
      </section>
    </main>
  )
}

export default AuthLayout