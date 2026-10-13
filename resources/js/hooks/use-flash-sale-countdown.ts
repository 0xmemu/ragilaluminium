import * as React from "react"

import type { FlashSalePeriod } from "@/types"

const DAY_MS = 86_400_000

/**
 * Countdown Flash Sale HARIAN - satu sumber untuk SEMUA tempat yang
 * menampilkan hitung mundur (nav header & carousel).
 *
 * Kontrak: hitung mundur menuju tengah malam (daily_ends_at) dan bergulir ke
 * hari berikutnya selama kampanye masih berjalan; berhenti di akhir kampanye
 * (ends_at) walau tengah malam belum lewat.
 *
 * Sebelumnya carousel memakai `seconds_remaining` (akhir kampanye) sehingga
 * menampilkan jam menumpuk seperti "704:14:15" sementara nav menampilkan
 * hitungan harian "09:32:19" - dua angka berbeda di halaman yang sama.
 *
 * @returns sisa detik, atau null bila kampanye tidak live / sudah berakhir.
 */
export function useFlashSaleCountdown(
  period: FlashSalePeriod | null | undefined,
): number | null {
  const [remaining, setRemaining] = React.useState<number | null>(null)
  const dailyEndsAt = period?.daily_ends_at ?? null
  const campaignEndsAt = period?.ends_at ?? null

  React.useEffect(() => {
    if (period?.live !== true || !dailyEndsAt) {
      // Server mematikan kampanye -> matikan timer juga.
      setRemaining(null)
      return
    }

    const tick = () => {
      const now = Date.now()
      const campaignEndMs = campaignEndsAt ? new Date(campaignEndsAt).getTime() : null

      if (campaignEndMs !== null && now >= campaignEndMs) {
        setRemaining(null)
        return
      }

      let deadlineMs = new Date(dailyEndsAt).getTime()

      // Bergulir ke tengah malam berikutnya sampai melewati waktu sekarang,
      // berhenti bila sudah melewati akhir kampanye.
      while (deadlineMs <= now) {
        if (campaignEndMs !== null && deadlineMs >= campaignEndMs) {
          setRemaining(null)
          return
        }
        deadlineMs += DAY_MS
      }

      const effectiveEndMs =
        campaignEndMs !== null ? Math.min(deadlineMs, campaignEndMs) : deadlineMs

      setRemaining(Math.max(0, Math.floor((effectiveEndMs - now) / 1000)))
    }

    tick()
    const id = window.setInterval(tick, 1000)

    return () => window.clearInterval(id)
  }, [dailyEndsAt, campaignEndsAt, period?.live])

  return remaining
}

/** Pecah sisa detik menjadi jam/menit/detik untuk tampilan countdown. */
export function splitCountdown(totalSeconds: number): { h: number; m: number; s: number } {
  return {
    h: Math.floor(totalSeconds / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: Math.floor(totalSeconds % 60),
  }
}

/** Format hh:mm:ss (jam bisa lebih dari 2 digit bila perlu). */
export function formatCountdown(totalSeconds: number): string {
  const { h, m, s } = splitCountdown(totalSeconds)

  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":")
}
