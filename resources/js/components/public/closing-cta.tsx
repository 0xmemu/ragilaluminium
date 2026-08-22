import { Link, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

/**
 * ClosingCTASection — banner CTA seragam di akhir halaman publik.
 *
 * Dasar = CTA homepage (bagian penutup hijau). Dipakai ulang lintas halaman agar markup
 * CTA tidak di-copy-paste; teks & tombol disesuaikan per konteks lewat props.
 *
 * Dua ukuran (jaga tampilan yang sudah oke):
 *   - `compact` (default)  : tombol kecil h-7, single — reproduksi persis CTA homepage.
 *   - `compact={false}`    : tombol besar h-9, bisa multi-tombol (primary + secondary),
 *                            cocok untuk pola CTA HowToOrder.
 */
type CtaAction = {
  label: string
  href: string
  variant?: "primary" | "secondary"
  whatsappIcon?: boolean
  external?: boolean
}

export function ClosingCTASection({
  eyebrow = "Butuh bantuan pilih jendela?",
  heading = "Konsultasi gratis via WhatsApp, admin balas cepat",
  actions,
  compact = true,
  id = "closing-cta",
}: {
  eyebrow?: string
  heading?: string
  actions?: CtaAction[]
  compact?: boolean
  id?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")

  const effectiveActions: CtaAction[] =
    actions && actions.length > 0
      ? actions
      : [
          {
            label: "Chat WhatsApp",
            href: whatsappUrl,
            variant: "primary",
            whatsappIcon: true,
            external: true,
          },
        ]

  return (
    <section id={id} className="scroll-mt-20">
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12 py-[10px]">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-primary px-5 py-5 text-center shadow-sm sm:px-8">
          <p className="text-xs font-semibold tracking-tight text-primary-foreground/90 sm:text-sm">
            {eyebrow}
          </p>
          <h2
            className={
              compact
                ? "text-balance text-[17px] font-bold leading-snug tracking-tight text-primary-foreground sm:text-xl"
                : "text-balance text-[17px] font-bold leading-snug tracking-tight text-primary-foreground sm:text-xl"
            }
          >
            {heading}
          </h2>

          <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2">
            {effectiveActions.map((action) => {
              const isExternal = action.external ?? false
              const content = (
                <>
                  {action.whatsappIcon ? (
                    <Icon name="whatsapp" className="h-4 w-4 text-whatsapp" aria-hidden="true" />
                  ) : null}
                  {action.label}
                </>
              )

              const base = compact
                ? "h-7 !min-h-7 min-w-0 whitespace-nowrap bg-background px-3.5 text-[11px] text-primary hover:bg-background/90 sm:text-xs"
                : action.variant === "secondary"
                  ? "h-9 min-w-0 whitespace-nowrap border border-white/20 bg-white/5 px-4 text-xs text-white hover:bg-white/10 sm:text-sm sm:min-w-[160px]"
                  : "h-9 min-w-0 whitespace-nowrap bg-background px-4 text-xs text-primary hover:bg-background/90 sm:text-sm sm:min-w-[160px]"

              return (
                <Button key={action.label} asChild className={base}>
                  {isExternal ? (
                    <a href={action.href} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2">
                      {content}
                    </a>
                  ) : (
                    <Link href={action.href} className="flex items-center justify-center gap-2">
                      {content}
                    </Link>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}