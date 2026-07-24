export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function formatNumber(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat("id-ID").format(Number.isFinite(amount) ? amount : 0)
}

export function formatDate(
  value: string | number | Date | null | undefined,
  includeTime = false,
): string {
  if (!value) return "Belum tersedia"

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date)
}

/** Alias: tanggal + jam, tanpa em dash. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  return formatDate(value, true)
}

export function humanize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Belum tersedia"
  if (typeof value === "boolean") return value ? "Ya" : "Tidak"

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

/** Prefer full catalog `name` (Shopee import title); short_name is secondary. */
export function productName(name: string, shortName?: string | null): string {
  return name?.trim() || shortName?.trim() || ""
}

/** Build wa.me link from configured brand phone (no hardcoded number). */
export function whatsappUrl(phone: string, message?: string): string | null {
  const digits = phone.replace(/\D/g, "")
  if (!digits) return null

  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits
  const url = new URL(`https://wa.me/${normalized}`)
  if (message) {
    url.searchParams.set("text", message)
  }

  return url.toString()
}
