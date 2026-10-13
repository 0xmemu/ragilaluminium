import { Link, usePage } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { resolveCtaActions } from "@/lib/cta-actions"
import { CTA_CONTENT } from "@/lib/cta-content"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

/**
 * ClosingCTASection, banner CTA seragam di akhir halaman publik.
 *
 * Dasar = CTA homepage (bagian penutup hijau). Dipakai ulang lintas halaman agar markup
 * CTA tidak di-copy-paste; teks dan tombol disesuaikan per konteks lewat props.
 *
 * Dua ukuran (jaga tampilan yang sudah oke):
 *   - `compact` (default)  : tombol kecil h-7, single, reproduksi persis CTA homepage.
 *   - `compact={false}`    : tombol besar h-9, bisa multi-tombol (primary + secondary),
 *                            cocok untuk pola CTA HowToOrder.
 *
 * Sumber teks berlapis: CTA_CONTENT[pageKey] (hardcode di kode), lalu props halaman,
 * lalu default di bawah. Urutan itu membuat komponen tetap reusable halaman mana pun
 * sekaligus tidak bergantung pada pengaturan admin.
 *
 * Kontrak owner (2026-09-02): MAKSIMAL 2 tombol per CTA. Sisanya dipotong otomatis.
 */
type CtaAction = {
  label: string
  /** Tautan langsung; dipakai bila props lama dipakai tanpa kunci CTA_CONTENT. */
  href?: string
  /** Kunci tujuan dari CTA_DESTINATIONS; `whatsapp` diselesaikan runtime. */
  destination?: string
  variant?: "primary" | "secondary"
  whatsappIcon?: boolean
  external?: boolean
}

export function ClosingCTASection({
  pageKey,
  eyebrow,
  heading,
  actions,
  compact = true,
  id = "closing-cta",
}: {
  /**
   * Kunci blok di CTA_CONTENT (mis. "faq"). Bila diisi, kop, judul, dan tombol
   * diambil dari sana; props eyebrow/heading/actions menjadi cadangan.
   */
  pageKey?: string
  eyebrow?: string
  heading?: string
  actions?: CtaAction[]
  compact?: boolean
  id?: string
}) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")

  // Teks dan tombol dari CTA_CONTENT menang; props halaman dipakai sebagai
  // cadangan bila bloknya belum ada di kode.
  const content = pageKey ? CTA_CONTENT[pageKey] : undefined
  const resolvedEyebrow = content?.eyebrow || eyebrow || "Butuh bantuan pilih jendela?"
  const resolvedHeading =
    content?.heading || heading || "Konsultasi gratis via WhatsApp, admin balas cepat"

  const contentActions: CtaAction[] = resolveCtaActions(content?.actions, whatsappUrl)

  const MAX_ACTIONS = 2
  const effectiveActions: CtaAction[] =
    contentActions.length > 0
      ? contentActions
      : actions && actions.length > 0
        ? actions.slice(0, MAX_ACTIONS)
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
          <p className="text-xs font-semibold tracking-tight text-primary-foreground/90">
            {resolvedEyebrow}
          </p>
          <h2 className="text-balance text-sm font-bold leading-snug tracking-tight text-primary-foreground ![text-transform:none]">
            {resolvedHeading}
          </h2>

          <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2">
            {effectiveActions.map((action) => {
              const isExternal = action.external ?? false
              const label = (
                <>
                  {action.whatsappIcon ? (
                    <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
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
                      {label}
                    </a>
                  ) : (
                    <Link href={action.href} className="flex items-center justify-center gap-2">
                      {label}
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
