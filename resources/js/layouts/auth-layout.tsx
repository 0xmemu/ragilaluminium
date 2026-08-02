import { Link } from "@inertiajs/react"
import type { ReactNode } from "react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { routeUrl } from "@/lib/routes"

export function AuthLayout({
  children,
  heading,
}: {
  children: ReactNode
  heading?: string
}) {
  return (
    <main className="dark flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center gap-4 text-center">
          <Link href={routeUrl("home")} aria-label="Beranda">
            <BrandWordmark variant="dark" />
          </Link>
          <CardTitle>{heading ?? "masuk ke panel admin"}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>

      <Link
        href={routeUrl("home")}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <Icon name="arrow-left" className="size-3.5" aria-hidden="true" />
        kembali ke beranda
      </Link>
    </main>
  )
}

export default AuthLayout