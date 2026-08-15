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

  return start.toLocaleDateString("id-ID", DATE_OPTIONS) + " - " + end.toLocaleDateString("id-ID", DATE_OPTIONS)
}
