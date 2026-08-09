import { Head, Link, usePage } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface CmsPageData {
  title: string
  heading?: string
  body: string
  slug: string
  updated_at_label?: string | null
}

export default function CmsPage({ page }: { page: CmsPageData }) {
  const { brand, consultationWhatsApp } = usePage<SharedPageProps>().props
  const cleanBody = React.useMemo(
    () =>
      DOMPurify.sanitize(page.body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "h1", "h2", "h3", "h4", "h5", "h6"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [page.body],
  )
  const isContact = page.slug === "kontak"
  const isPrivacy = page.slug === "kebijakan-privasi"
  const isLegal = page.slug === "ketentuan-layanan" || isPrivacy
  const heading = page.heading?.trim() || page.title
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const phoneHref = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null
  const whatsappLabel = brand.phone
    ? `WhatsApp: ${brand.phone}`
    : (consultationWhatsApp?.directLabel ?? "Chat WhatsApp")

  return (
    <PublicLayout>
      <Head title={page.title}>
        <meta name="description" content={`${page.title} Ragil Aluminium.`} />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className={cn("container-page py-4", isContact && "hidden sm:block")}>
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: page.title, href: null },
            ]}
          />
        </div>
        <div className={cn("container-page", isContact ? "pb-4 pt-4" : isLegal ? "max-w-3xl pb-8 pt-4" : "pb-6 pt-4 lg:pb-8 lg:pt-6")}>
          {isContact ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
                aria-label="Kembali"
              >
                <Icon name="caret-left" className="size-5" aria-hidden="true" />
              </button>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Hubungi Kami
              </h1>
            </div>
          ) : (
            <p className={cn("max-w-3xl font-bold leading-snug tracking-tight text-foreground", isLegal ? "text-lg" : "text-lg")}>
              {heading}
            </p>
          )}
          {isLegal && page.updated_at_label ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Terakhir diperbarui: {page.updated_at_label}
            </p>
          ) : null}
        </div>
      </section>

      <section className={cn("container-page", isContact ? "py-4" : "py-6 lg:py-8")}>
        {isLegal ? (
          <div className="mx-auto max-w-3xl border-t border-border pt-8">
            <article className="cms-content" dangerouslySetInnerHTML={{ __html: cleanBody }} />
            {isPrivacy && whatsappUrl ? (
              <div className="mt-6">
                <Button asChild variant="secondary" size="sm">
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" className="size-4 text-[#25D366]" aria-hidden="true" />
                    {whatsappLabel}
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
        ) : isContact ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,44rem)_18rem] lg:justify-between">
            <div className="min-w-0 space-y-4 order-2 lg:order-1">
              <article className={cn("cms-content", "text-xs leading-5")} dangerouslySetInnerHTML={{ __html: cleanBody }} />
            </div>

            <aside className="order-1 lg:order-2 lg:sticky lg:top-28 lg:self-start">
              <div className="surface-panel p-5">
                <p className="text-lg font-semibold">Kontak Ragil Aluminium</p>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">{brand.address}</p>
                <div className="mt-4 grid gap-2">
                  {whatsappUrl ? (
                    <Button asChild>
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                        {consultationWhatsApp?.directLabel ?? "Chat WhatsApp"}
                      </a>
                    </Button>
                  ) : null}
                  {phoneHref ? (
                    <Button asChild variant={whatsappUrl ? "secondary" : undefined}>
                      <a href={phoneHref}>
                        <Icon name="headset" className="h-4 w-4" aria-hidden="true" />
                        Telepon
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant="secondary">
                    <a href={`mailto:${brand.email}`}>Kirim email</a>
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,44rem)_18rem] lg:justify-between">
            <div className="min-w-0 space-y-8">
              <article className="cms-content" dangerouslySetInnerHTML={{ __html: cleanBody }} />
            </div>

            <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-lg border border-border bg-surface p-5">
                <p className="text-lg font-semibold">Butuh bantuan?</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Lihat pertanyaan umum atau hubungi tim Ragil untuk informasi produk.
                </p>
                <div className="mt-3 grid">
                  <Link
                    href={routeUrl("faq")}
                    className="flex min-h-11 items-center justify-between border-b border-border text-sm font-semibold hover:text-primary"
                  >
                    Sering ditanyakan
                    <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={routeUrl("contact")}
                    className="flex min-h-11 items-center justify-between text-sm font-semibold hover:text-primary"
                  >
                    Hubungi kami
                    <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <nav className="rounded-lg bg-surface-muted p-5" aria-label="Informasi terkait">
                <p className="text-xs font-bold tracking-tight text-muted-foreground">Informasi lain</p>
                <ul className="mt-3 space-y-1">
                  {[
                    ["Cara Pemesanan", "cara-pemesanan"],
                    ["Kebijakan Privasi", "privacy"],
                    ["Ketentuan Layanan", "terms"],
                  ].map(([label, routeName]) => (
                    <li key={routeName}>
                      <Link
                        href={routeUrl(routeName)}
                        className="flex min-h-10 items-center text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </aside>
          </div>
        )}
      </section>
    </PublicLayout>
  )
}
