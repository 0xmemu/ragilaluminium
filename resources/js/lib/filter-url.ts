/**
 * Pembangun URL filter untuk halaman daftar admin.
 *
 * Sebelumnya setiap halaman menulis ulang blok yang sama: gabungkan keadaan
 * filter saat ini dengan parameter baru, buang nilai kosong, buang penanda
 * "all", pangkas kata kunci kosong, lalu navigasi. Aturan itu tersebar di
 * dua belas halaman sehingga satu perbaikan harus diulang dua belas kali.
 *
 * Sekarang seluruh halaman memanggil dua fungsi di berkas ini.
 */
import { router } from "@inertiajs/react"

import { routeUrl } from "@/lib/routes"

/** Nilai yang selalu dibuang dari URL karena bukan keadaan bermakna. */
const NILAI_KOSONG: Record<string, true> = { "": true, all: true }

export interface FilterNavigationOptions {
  /**
   * Nilai default server per kunci. Kunci dengan nilai default tidak ditulis ke
   * URL supaya alamat tetap bersih dan tombol filter tidak tampak aktif palsu.
   */
  defaults?: Record<string, string>
  /**
   * Aturan tambahan untuk membuang kunci. Dipakai halaman yang punya aturan
   * lintas kunci, misalnya rentang tanggal hanya sahih saat preset rentang
   * sedang aktif.
   */
  shouldDrop?: (
    key: string,
    value: string,
    merged: Record<string, string | undefined | null>,
  ) => boolean
  /** Ganti posisi riwayat alih-alih menambah entri baru. Default true. */
  replace?: boolean
  /**
   * Pertahankan keadaan komponen saat navigasi. Hanya disetel false oleh tombol
   * "reset filter", yang memang ingin membangun ulang keadaan dari awal.
   */
  preserveState?: boolean
}

/**
 * Susun objek query filter: buang nilai kosong, penanda "all", kata kunci
 * kosong, dan nilai yang sama dengan default server.
 */
export function buildFilterQuery(
  current: Record<string, string | undefined | null>,
  params: Record<string, string | undefined>,
  options: FilterNavigationOptions = {},
): Record<string, string> {
  const defaults = options.defaults ?? {}
  const merged: Record<string, string | undefined | null> = { ...current, ...params }
  const next: Record<string, string> = {}

  Object.entries(merged).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (NILAI_KOSONG[value] === true) return
    if (key === "q" && !value.trim()) return
    if (defaults[key] !== undefined && defaults[key] === value) return
    if (options.shouldDrop?.(key, value, merged)) return
    next[key] = value
  })

  return next
}

/**
 * Navigasi ke halaman daftar dengan query filter yang sudah dibersihkan.
 * Menjaga keadaan komponen dan tidak menumpuk entri riwayat browser.
 */
export function navigateFilter(
  routeName: string,
  current: Record<string, string | undefined | null>,
  params: Record<string, string | undefined>,
  options: FilterNavigationOptions = {},
): void {
  router.get(routeUrl(routeName), buildFilterQuery(current, params, options), {
    preserveState: options.preserveState ?? true,
    preserveScroll: true,
    replace: options.replace ?? true,
  })
}
