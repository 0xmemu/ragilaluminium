import { Link, usePage } from "@inertiajs/react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { StorefrontPlatforms } from "@/components/public/storefront-platforms"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { FooterColumn, FooterLink, SharedPageProps, SocialLink } from "@/types"

function footerHref(link: FooterLink): string {
  if (link.href) return link.href
  if (link.route) return routeUrl(link.route, link.params)
  return "/"
}

function FooterLinks({ column }: { column?: FooterColumn }) {
  if (!column?.links?.length) return null

  return (
    <nav aria-label={column.title ?? "Tautan footer"}>
      {column.title ? (
        <h2 className="text-sm font-bold tracking-tight text-background">
          {column.title}
        </h2>
      ) : null}
      <ul className={cn(column.title && "mt-4", "space-y-2.5")}>
        {column.links.map((link) => (
          <li key={link.label}>
            <Link
              href={footerHref(link)}
              className="inline-flex min-h-8 items-center text-sm text-background/75 transition hover:text-background"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function SocialIcon({ social }: { social: SocialLink }) {
  const className =
    "inline-flex size-8 items-center justify-center text-[10px] font-semibold tracking-tight text-background/75 transition hover:text-background"

  if (social.icon) {
    return (
      <a
        href={social.href}
        target="_blank"
        rel="noreferrer"
        className={className}
        aria-label={social.label}
      >
        <img src={social.icon} alt="" className="size-5 object-contain" width={20} height={20} />
      </a>
    )
  }

  return (
    <a href={social.href} target="_blank" rel="noreferrer" className={className} aria-label={social.label}>
      {social.label.slice(0, 2)}
    </a>
  )
}

export function PublicFooter({ className }: { className?: string }) {
  const { footer, brand, platforms = [] } = usePage<SharedPageProps>().props
  const socials = footer?.social?.filter((social) => social.href && social.href !== "#") ?? []
  const phoneHref = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null
  const emailHref = brand.email ? `mailto:${brand.email}` : null
  const showPlatformStrip = platforms.length > 0
  const showLegacySocial = !showPlatformStrip && socials.length > 0

  return (
    <footer className={cn("border-t border-white/10 bg-foreground text-background pt-12 lg:pt-14", className)}>
      <div className="container-page !px-5 md:!px-8 lg:!px-12">
        <div className="grid gap-10 border-b border-white/10 pb-10 sm:grid-cols-2 lg:grid-cols-12 lg:items-start lg:gap-8 lg:pb-12">
          <div className="sm:col-span-2 lg:col-span-3">
            <BrandWordmark compact variant="dark" />
            <p className="mt-4 max-w-sm text-sm leading-6 text-background/75">{brand.tagline}</p>
            <address className="mt-5 max-w-sm space-y-3 not-italic text-sm leading-6 text-background/75">
              {brand.address ? (
                <p className="flex gap-2.5">
                  <Icon name="map-pin" className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{brand.address}</span>
                </p>
              ) : null}
              {phoneHref ? (
                <p className="flex gap-2.5">
                  <Icon name="phone" className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <a href={phoneHref} className="transition hover:text-background">
                    {brand.phone}
                  </a>
                </p>
              ) : null}
              {emailHref ? (
                <p className="flex gap-2.5">
                  <Icon name="envelope" className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <a href={emailHref} className="break-all normal-case transition hover:text-background">
                    {brand.email}
                  </a>
                </p>
              ) : null}
            </address>
          </div>

          <div className="lg:col-span-2">
            <FooterLinks column={footer?.products} />
          </div>
          <div className="lg:col-span-2">
            <FooterLinks column={footer?.help} />
          </div>
          <div className="lg:col-span-2">
            <FooterLinks column={footer?.company} />
          </div>
          {showPlatformStrip ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <StorefrontPlatforms
                platforms={platforms}
                title="Ikuti Kami"
                variant="dark"
                compact
                iconsOnly
              />
            </div>
          ) : null}
          {showLegacySocial ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-sm font-bold tracking-tight text-background">Ikuti Kami</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {socials.map((social) => (
                  <SocialIcon key={social.key} social={social} />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 py-6 text-xs text-background/75 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {brand.short_name}. Hak cipta dilindungi.</p>
          {footer?.legal?.length ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {footer.legal.map((link) => (
                <li key={link.label}>
                  <Link
                    href={footerHref(link)}
                    className="inline-flex min-h-8 items-center transition hover:text-background"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  )
}
