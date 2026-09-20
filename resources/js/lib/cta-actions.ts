import { usePage } from "@inertiajs/react"

import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

/**
 * Satu blok CTA seperti tersimpan di CtaSettings.
 *
 * PENTING: semua kolom bernilai null/daftar kosong selama admin belum
 * menyimpan blok itu. Komponen storefront karena itu WAJIB memakai teksnya
 * sendiri sebagai cadangan, supaya memasang fitur pengaturan ini tidak pernah
 * mengubah tampilan storefront.
 */
export interface CtaBlockContent {
  eyebrow: string | null
  heading: string | null
  actions: Array<{ label: string; destination: string; variant: string }>
  items: Array<{ label: string; description: string }>
}

/** Tombol CTA hasil resolusi: siap dirender. */
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
 * Dipakai bersama oleh banner penutup, kondisi kosong, dan panel kontak
 * Tentang Kami, supaya resolusi tujuan hanya ada di satu tempat: kalau aturan
 * `whatsapp` berubah, semua pemakai ikut berubah.
 */
export function resolveCtaActions(
  actions: CtaSettingsAction[] | undefined | null,
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

/** Blok tersimpan untuk satu kunci, atau undefined bila admin belum mengisinya. */
export function useCtaBlock(key: string): CtaBlockContent | undefined {
  const { ctaSettings } = usePage<SharedPageProps>().props
  return ctaSettings?.pages?.[key] as CtaBlockContent | undefined
}

/** Tombol blok, sudah siap render. Kosong berarti pakai tombol bawaan komponen. */
export function useCtaActions(key: string): ResolvedCtaAction[] {
  const { ctaSettings, consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")
  return resolveCtaActions(
    ctaSettings?.pages?.[key]?.actions as CtaSettingsAction[] | undefined,
    whatsappUrl,
  )
}

/**
 * Label tombol kecil di samping judul section (blok `section`).
 * Hrefnya tetap milik komponen karena menyatu dengan tata letak section.
 */
export function ctaActionLabel(block: CtaBlockContent | undefined, fallback: string): string {
  const label = block?.actions?.[0]?.label?.trim()
  return label ? label : fallback
}
