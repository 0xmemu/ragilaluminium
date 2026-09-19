import { routeUrl } from "@/lib/routes"

/**
 * Tombol CTA hasil resolusi: siap dirender.
 *
 * `destination` dari pengaturan CTA Storefront diterjemahkan menjadi href.
 * Kunci `whatsapp` memakai nomor toko yang terverifikasi (nomor bisa berganti
 * tanpa mengedit tiap blok), kunci lain dipetakan ke rute internal.
 */
export interface ResolvedCtaAction {
  label: string
  href: string
  variant: "primary" | "secondary"
  whatsappIcon: boolean
  external: boolean
}

/** Bentuk tombol seperti tersimpan di CtaSettings. */
export interface CtaSettingsAction {
  label: string
  destination: string
  variant?: string
}

/**
 * Ubah tombol dari pengaturan menjadi siap render.
 *
 * Dipakai bersama oleh banner penutup, empty state katalog, dan panel kontak
 * Tentang Kami, supaya resolusi tujuan hanya ada di satu tempat: kalau aturan
 * `whatsapp` berubah, semua pemakai ikut berubah.
 */
export function resolveCtaActions(
  actions: CtaSettingsAction[] | undefined | null,
  whatsappUrl: string,
): ResolvedCtaAction[] {
  return (actions ?? []).map((action) => ({
    label: action.label,
    href: action.destination === "whatsapp" ? whatsappUrl : routeUrl(action.destination as Parameters<typeof routeUrl>[0]),
    variant: action.variant === "secondary" ? "secondary" : "primary",
    whatsappIcon: action.destination === "whatsapp",
    external: action.destination === "whatsapp",
  }))
}
