import { usePage } from "@inertiajs/react"
import * as React from "react"

import { cn } from "@/lib/utils"
import type { FlashSalePeriod, SharedPageProps } from "@/types"

function useFlashSalePeriod(override?: FlashSalePeriod | null): FlashSalePeriod | null {
  const shared = usePage<SharedPageProps>().props.flashSalePeriod
  return override ?? shared ?? null
}

const DAY_MS = 86_400_000

/** Daily Flash Sale deadline; rolls to next midnight while campaign is still live. */
function useDailyFlashSaleCountdown(period: FlashSalePeriod | null | undefined): number | null {
  const [remaining, setRemaining] = React.useState<number | null>(null)
  const dailyEndsAt = period?.daily_ends_at ?? null

  React.useEffect(() => {
    if (period?.live !== true || !dailyEndsAt) {
      // Reset the timer when the server turns the campaign off.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRemaining(null)
      return
    }

    const tick = () => {
      const now = Date.now()
      const campaignEndMs = period.ends_at ? new Date(period.ends_at).getTime() : null

      if (campaignEndMs !== null && now >= campaignEndMs) {
        setRemaining(null)
        return
      }

      let deadlineMs = new Date(dailyEndsAt).getTime()

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
  }, [dailyEndsAt, period?.ends_at, period?.live])

  return remaining
}

function formatHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":")
}

/** Timer nav Flash Sale - hh:mm:ss, kuning 50%, italic; hidden bila tidak live. */
export function FlashSaleNavCountdown({
  period,
  className,
}: {
  period?: FlashSalePeriod | null
  className?: string
}) {
  const resolved = useFlashSalePeriod(period)
  const remaining = useDailyFlashSaleCountdown(resolved)

  if (resolved?.live !== true || remaining === null || remaining <= 0) {
    return null
  }

  const display = formatHms(remaining)
  const [hours, minutes, seconds] = display.split(":")

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-baseline gap-1.5 font-semibold italic tabular-nums tracking-tight text-warning/50",
        className,
      )}
      aria-live="polite"
      aria-label={`Berakhir dalam ${hours} jam ${minutes} menit ${seconds} detik`}
    >
      <span>{hours}</span>
      <span className="opacity-70" aria-hidden>
        :
      </span>
      <span>{minutes}</span>
      <span className="opacity-70" aria-hidden>
        :
      </span>
      <span>{seconds}</span>
    </span>
  )
}
