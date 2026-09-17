import { usePage } from "@inertiajs/react"

import { useFlashSaleCountdown, formatCountdown } from "@/hooks/use-flash-sale-countdown"
import { cn } from "@/lib/utils"
import type { FlashSalePeriod, SharedPageProps } from "@/types"

function useFlashSalePeriod(override?: FlashSalePeriod | null): FlashSalePeriod | null {
  const shared = usePage<SharedPageProps>().props.flashSalePeriod
  return override ?? shared ?? null
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
  const remaining = useFlashSaleCountdown(resolved)

  if (resolved?.live !== true || remaining === null || remaining <= 0) {
    return null
  }

  const display = formatCountdown(remaining)
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
