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
 *
 * Kontrak owner (2026-09-02): MAKSIMAL 2 tombol per CTA. Sisanya dipotong otomatis.
 */
type CtaAction = {
  label: string
  /** Tautan langsung; dipakai bila props lama dipakai tanpa pengaturan. */
  href?: string
  /** Kunci tujuan dari CtaSettings::DESTINATIONS; `whatsapp` diselesaikan
   *  runtime ke nomor toko. */
  destination?: string
  variant?: "primary" | "secondary"
  whatsappIcon?: boolean
  external?: boolean
}

/** Tipe tombol dari pengaturan admin (CtaSettings). */
type CtaSettingsAction = { label: string; destination: string; variant: string }

export function ClosingCTASection({
  pageKey,
  eyebrow,
  heading,
  actions,
  compact = true,
  id = "closing-cta",
}: {
  /**
   * Kunci halaman di CtaSettings (mis. "faq"). Bila diisi, kop & judul diambil
   * dari pengaturan admin; props eyebrow/heading jadi cadangan saat settings
   * belum tersedia.
   */
  pageKey?: string
  eyebrow?: string
  heading?: string
  actions?: CtaAction[]
  compact?: boolean
  id?: string
}) {
  const { consultationWhatsApp, ctaSettings } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")

  // Warna banner dari pengaturan; token CSS diteruskan apa adanya (harus hex
  // 6 digit, diverifikasi server).
  const bannerColor = ctaSettings?.color || "#C00000"

  // Nilai destination -> href. `whatsapp` memakai nomor toko yang
  // terverifikasi; kunci lain dipetakan ke rute internal.
  const destinationHref = (destination: string): string =>
    destination === "whatsapp" ? whatsappUrl : routeUrl(destination as Parameters<typeof routeUrl>[0])

  // Teks & tombol dari pengaturan admin menang; props halaman dipakai sebagai
  // cadangan bila pengaturan belum tersedia.
  const configured = pageKey ? ctaSettings?.pages?.[pageKey] : undefined
  const resolvedEyebrow = configured?.eyebrow || eyebrow || "Butuh bantuan pilih jendela?"
  const resolvedHeading =
    configured?.heading || heading || "Konsultasi gratis via WhatsApp, admin balas cepat"

  // Tombol dari pengaturan (dengan href hasil resolve destination); bila tidak
  // ada, jatuh ke props halaman, lalu ke tombol default.
  const settingsActions: CtaAction[] = (configured?.actions ?? []).map((a) => ({
    label: a.label,
    href: destinationHref(a.destination),
    variant: a.variant === "secondary" ? "secondary" : "primary",
    whatsappIcon: a.destination === "whatsapp",
    external: a.destination === "whatsapp",
  }))

  // Admin bisa mematikan seluruh CTA penutup dari pengaturan.
  if (ctaSettings && ctaSettings.enabled === false) {
    return null
  }

  const MAX_ACTIONS = 2
  const effectiveActions: CtaAction[] =
    settingsActions.length > 0
      ? settingsActions
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
        <div
          className="flex flex-col items-center gap-1 rounded-xl px-5 py-5 text-center shadow-sm sm:px-8"
          style={{ backgroundColor: bannerColor }}
        >
          <p className="text-xs font-semibold tracking-tight text-primary-foreground/90">
            {resolvedEyebrow}
          </p>
          <h2 className="text-balance text-sm font-bold leading-snug tracking-tight text-primary-foreground ![text-transform:none]">
            {resolvedHeading}
          </h2>

          <div className="mt-3 flex w-full flex-wrap items-center justify-center gap-2">
            {effectiveActions.map((action) => {
              const isExternal = action.external ?? false
              const content = (
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