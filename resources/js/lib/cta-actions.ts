import { routeUrl } from "@/lib/routes"

/** Tombol CTA hasil resolusi: siap dirender. */
export interface ResolvedCtaAction {
  label: string
  href: string
  variant: "primary" | "secondary"
  whatsappIcon: boolean
  external: boolean
}

/** Bentuk tombol sumber: label dan kunci tujuan, bukan URL. */
export interface CtaActionSource {
  label: string
  destination: string
  variant?: string
}

/**
 * Ubah tombol dari sumber (CTA_CONTENT atau props halaman) menjadi siap render.
 *
 * Dipakai bersama oleh banner penutup, kondisi kosong, dan panel kontak
 * Tentang Kami, supaya resolusi tujuan hanya ada di satu tempat: kalau aturan
 * `whatsapp` berubah, semua pemakai ikut berubah.
 */
export function resolveCtaActions(
  actions: CtaActionSource[] | undefined | null,
  whatsappUrl: string,
): ResolvedCtaAction[] {
  return (actions ?? []).map((action) => ({
    label: action.label,
    href:
      action.destination === "whatsapp"
        ? whatsappUrl
        : routeUrl(action.destination as Parameters<typeof routeUrl>[0]),
    variant: action.variant === "secondary" ? "secondary" : "primary",
    whatsappIcon: action.destination === "whatsapp",
    external: action.destination === "whatsapp",
  }))
}
