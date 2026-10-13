import { usePage } from "@inertiajs/react"
import { Lightning } from "@phosphor-icons/react"

import {
  useFlashSaleCountdown,
  formatCountdown,
  splitCountdown,
} from "@/hooks/use-flash-sale-countdown"
import { cn } from "@/lib/utils"
import type { FlashSalePeriod, SharedPageProps } from "@/types"

const pad = (n: number) => String(n).padStart(2, "0")

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

/**
 * Label Flash Sale bergaya (ikon petir + teks miring warna primary).
 *
 * Satu sumber untuk headline carousel dan judul halaman /flash-sale supaya
 * keduanya tidak pernah tampil berbeda. Pembungkus heading (h1/h2) tetap
 * ditentukan pemanggil agar hierarki heading tiap halaman benar.
 */
export function FlashSaleLabel({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <Lightning weight="fill" className="size-5 shrink-0 text-primary" aria-hidden />
      {/*
        Tanpa `truncate`: kata ini pendek dan tidak boleh mengecil, sedangkan
        `overflow: hidden` dari truncate memotong tinta huruf terakhir yang
        miring keluar dari kotak teks (temuan owner 2026-09-18: "label
        terpotong"). Ruang ekstra kecil di kanan menjaga kemiringan italic
        tetap utuh pada zoom berapa pun.
      */}
      <span className="flash-sale-headline shrink-0 whitespace-nowrap pr-0.5 font-display text-lg font-extrabold italic tracking-tight text-primary">
        FLASH SALE
      </span>
    </span>
  )
}

/**
 * Hitung mundur bergaya kotak (sumber sama dengan countdown nav: harian,
 * bergulir tengah malam). Tampil hanya saat kampanye live.
 */
export function FlashSaleCountdown({
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

  const countdown = splitCountdown(remaining)

  return (
    <span
      className={cn("flex shrink-0 items-center gap-1", className)}
      aria-live="polite"
      aria-label={`Berakhir dalam ${countdown.h} jam ${countdown.m} menit ${countdown.s} detik`}
    >
      {[countdown.h, countdown.m, countdown.s].map((value, index) => (
        <span key={index} className="flex items-center gap-1">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-[4px] bg-foreground px-1 font-mono text-[12px] font-bold tabular-nums text-background">
            {pad(value)}
          </span>
          {index < 2 ? (
            <span className="text-xs font-bold text-foreground" aria-hidden>
              :
            </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}
