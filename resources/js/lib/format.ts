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

/** Singkatan yang harus tetap kapital penuh (bukan Title Case). */
const HUMANIZE_ACRONYMS: Record<string, string> = {
  cod: "COD",
  jnt: "J&T",
  sku: "SKU",
  wa: "WA",
  id: "ID",
}

export function humanize(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Belum tersedia"
  if (typeof value === "boolean") return value ? "Ya" : "Tidak"

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b[\w&]+\b/g, (word) => {
      const acronym = HUMANIZE_ACRONYMS[word.toLowerCase()]
      if (acronym) return acronym
      return word.replace(/^\w/, (character) => character.toUpperCase())
    })
}

export function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

/** Prefer full catalog `name` (Shopee import title); short_name is secondary. */
export function productName(name: string, shortName?: string | null): string {
  const raw = (name?.trim() || shortName?.trim() || "").replace(/\s+/g, " ")
  if (!raw) return ""

  // Padatkan angka+satuan agar tidak orphan di baris baru ("80\nCm").
  return raw
    .replace(/(\d)\s*([cC][mM]|[mM][mM])\b/g, "$1$2")
    .replace(/\s*[x×X]\s*/g, " × ")
    .trim()
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
