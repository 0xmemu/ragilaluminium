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
    <main className="dark flex min-h-svh flex-col items-center justify-center gap-6 bg-[linear-gradient(160deg,hsl(var(--accent))_0%,hsl(var(--surface-muted))_45%,hsl(var(--background))_100%)] px-6 py-10 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.65)] sm:p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <BrandWordmark variant="dark" />
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
        <Link
          href={routeUrl("home")}
          className="inline-flex items-center justify-center gap-2 self-center text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <Icon name="arrow-left" className="h-4 w-4" aria-hidden="true" />
          Kembali ke beranda
        </Link>
      </div>
    </main>
  )
}

export default AuthLayout
