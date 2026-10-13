import { router } from "@inertiajs/react"
import * as React from "react"

/**
 * Prefetch saat hover yang hanya aktif untuk mouse dan selalu bisa dibatalkan.
 *
 * Dipakai semua navigasi (etalase publik maupun panel admin) sebagai pengganti
 * prop `prefetch` bawaan Inertia, karena dua masalah:
 *
 * 1. Prefetch bawaan memasang timer hover 75 ms yang TIDAK dibatalkan ketika
 *    link diklik. Bila pengguna mengklik sebelum timer menyala, klik sudah
 *    menavigasi lebih dulu, lalu timer menyusul memicu prefetch tambahan.
 *    Respons prefetch itu tiba belakangan dan memicu render ulang halaman
 *    (mount kedua), sehingga progress bar tampak selesai lebih dulu baru
 *    halaman berpindah.
 *
 * 2. Prefetch bawaan ikut menyala pada perangkat sentuh. Di sana tidak ada
 *    hover, jadi setiap ketukan membuang satu request penuh untuk halaman yang
 *    sedang dibuka. Karena itu hanya pointer bertipe "mouse" yang memicu.
 *
 * Pembatalan ditaruh di `onPointerDown` supaya tidak perlu menyentuh `onClick`
 * milik pemanggil, dan tetap terjadi sebelum event click diproses.
 */
export function useHoverPrefetch(url: string, delay = 75) {
  const timer = React.useRef<number | null>(null)

  const cancel = React.useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  // Bersihkan timer bila komponen dilepas sebelum timer menyala.
  React.useEffect(() => cancel, [cancel])

  const onPointerEnter = React.useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return
      cancel()
      timer.current = window.setTimeout(() => {
        timer.current = null
        router.prefetch(url)
      }, delay)
    },
    [cancel, delay, url],
  )

  const onPointerLeave = React.useCallback(() => cancel(), [cancel])

  return { onPointerEnter, onPointerLeave, onPointerDown: cancel }
}

export default useHoverPrefetch
