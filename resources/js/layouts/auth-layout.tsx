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
  const capabilities = [
    { icon: "clipboard-list", label: "Pesanan & pengiriman" },
    { icon: "package", label: "Produk & persediaan" },
    { icon: "chart-line", label: "Performa toko" },
    { icon: "message-circle", label: "Otomasi WhatsApp" },
  ]

  return (
    <main className="dark min-h-svh bg-background px-4 py-4 text-foreground sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] w-full max-w-[88rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_24px_hsl(0_0%_0%/0.28)] sm:min-h-[calc(100svh-3rem)] lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1.08fr)_minmax(25rem,0.92fr)]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-[#101211] p-10 lg:flex xl:p-14">
          <div className="absolute inset-x-0 top-0 h-px bg-primary" aria-hidden="true" />
          <BrandWordmark variant="dark" />
          <div className="max-w-xl">
            <p className="mb-4 font-mono text-xs font-semibold text-primary">
              ADMIN WORKSPACE / RAGIL ALUMINIUM
            </p>
            <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight xl:text-5xl">
              Satu ruang kerja untuk mengendalikan operasional toko.
            </h1>
            <p className="mt-5 max-w-[58ch] text-pretty text-base leading-7 text-muted-foreground">
              Pantau pesanan, katalog, promosi, pengiriman, dan komunikasi pelanggan dari panel yang sama.
            </p>
            <div className="mt-9 grid grid-cols-2 gap-3">
              {capabilities.map((item) => (
                <div key={item.label} className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-surface/70 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon name={item.icon} className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold leading-5">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Akses terbatas untuk administrator Ragil Aluminium.
          </p>
        </section>

        <section className="flex min-h-full items-center justify-center bg-surface p-5 sm:p-8 lg:p-12 xl:p-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center justify-between lg:hidden">
              <BrandWordmark variant="dark" />
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold text-muted-foreground">Admin</span>
            </div>
            <div className="mb-8">
              <p className="font-mono text-xs font-semibold text-primary">SECURE SIGN IN</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight">Masuk ke panel admin</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-5 sm:p-6">
              {children}
            </div>
            <Link href={routeUrl("home")} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
              <Icon name="arrow-left" className="h-4 w-4" aria-hidden="true" />
              Kembali ke beranda
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}

export default AuthLayout
