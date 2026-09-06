import type { OrderEta } from "@/types"

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
}

export function displayEtaRangeLabel(eta: OrderEta): string {
  const start = new Date(eta.start_at)
  const end = new Date(eta.end_at)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return eta.range_label
  }

  const startParts = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).formatToParts(start)
  const endParts = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).formatToParts(end)
  const startDay = startParts.find((part) => part.type === "day")?.value ?? ""
  const startMonth = startParts.find((part) => part.type === "month")?.value ?? ""
  const startYear = startParts.find((part) => part.type === "year")?.value ?? ""
  const endDay = endParts.find((part) => part.type === "day")?.value ?? ""
  const endMonth = endParts.find((part) => part.type === "month")?.value ?? ""
  const endYear = endParts.find((part) => part.type === "year")?.value ?? ""

  // Bulan dan tahun sama: "9-13 September 2026". Jika berbeda: tampilkan tanggal lengkap.
  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}-${endDay} ${endMonth} ${endYear}`
  }

  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`
}
