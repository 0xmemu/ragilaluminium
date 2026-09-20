import type { SocialLink } from "@/types"

/**
 * Logika daftar platform storefront (media sosial & marketplace).
 *
 * Fungsi murni supaya bisa diuji Vitest tanpa merender React, DAN supaya hanya
 * ada SATU definisi di seluruh repo: sebelumnya `channelOf` dan `isLiveHref`
 * disalin di dua berkas (storefront-platforms.tsx dan pages/Public/About.tsx),
 * sehingga perubahan aturan harus dikerjakan dua kali dan rawan berbeda.
 */

/** Marketplace jual-beli; selain ini dianggap media sosial. */
const MARKETPLACE_KEYS = ["shopee", "tokopedia", "lazada", "tiktok_shop"]

/**
 * Klasifikasi satu kanal platform.
 *
 * `channel` dari data admin diutamakan bila diisi; kalau tidak, disimpulkan
 * dari `key` (data lama belum punya field channel).
 */
export function channelOf(item: SocialLink): "marketplace" | "social" {
  if (item.channel === "marketplace" || item.channel === "social") {
    return item.channel
  }

  return MARKETPLACE_KEYS.includes(item.key) ? "marketplace" : "social"
}

/**
 * Tautan dianggap hidup bila terisi dan bukan placeholder "#".
 * Platform tanpa tautan hidup ditampilkan sebagai chip "Segera hadir".
 */
export function isLiveHref(href?: string | null): boolean {
  return Boolean(href && href !== "#")
}
