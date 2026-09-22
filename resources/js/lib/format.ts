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

/** Build a tel: link only from a complete, unmasked dialable value. */
export function telephoneHref(value: string | null | undefined): string | null {
  const phone = value?.trim() ?? ""
  if (!phone || !/^[+]?[0-9 ().-]+$/.test(phone)) return null

  const digits = phone.replace(/[^0-9]/g, "")
  if (digits.length < 7) return null

  return `tel:${phone.startsWith("+") ? "+" : ""}${digits}`
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

/** Jenis format kontraktual yang dikirim payload KPI. */
export type FormatKontrak = "currency" | "number" | "percent" | "hours" | "days"

/** Persen untuk tampilan: angka payload + tanda persen, tanpa hitungan. */
export function formatPercent(value: number | null | undefined): string {
  return formatNumber(value) + "%"
}

/** Durasi dalam jam tampil sebagai jam dan menit, tergantung sisanya. */
export function formatDurationVis(value: number, isDays = false): string {
  if (!Number.isFinite(value) || value <= 0) return "0 menit"
  const base = isDays ? value * 24 : value
  const totalMinutes = Math.round(base * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const jam = hours.toString() + " jam"
  const menit = minutes.toString() + " menit"
  if (isDays) {
    return minutes === 0 ? jam : jam + " " + menit
  }
  if (hours === 0) return menit
  return minutes === 0 ? jam : jam + " " + menit
}

/**
 * Satu pintu format nilai kontraktual: menerima angka dan jenis format dari
 * payload, mengembalikan teks tampilan. Dilarang menghitung nilai bisnis.
 */
export function formatKontrak(value: number | null | undefined, format: FormatKontrak): string {
  if (value === null || value === undefined) return "Belum tersedia"
  if (format === "currency") return formatCurrency(value)
  if (format === "percent") return formatPercent(value)
  if (format === "hours") return formatDurationVis(value)
  if (format === "days") return formatDurationVis(value, true)
  return formatNumber(value)
}

/** Format total dan pembanding grafik menurut jenis formatnya. */
export function formatKontrakChart(value: number | undefined, totalFormat: string): string {
  const angka = value ?? 0
  if (totalFormat === "currency") return formatCurrency(angka)
  if (totalFormat === "percent") return formatPercent(angka)
  return formatNumber(angka)
}

/** Cap waktu payload tampil sebagai tanggal dan jam WIB. */
export function formatWaktuIso(iso: string): string {
  const waktu = new Date(iso)
  if (Number.isNaN(waktu.getTime())) return iso
  const tanggal = waktu.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const jam = waktu.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return tanggal + ", " + jam + " WIB"
}

/** Jam saja untuk indikator kesegaran data pada banner periode. */
export function formatJamIso(iso: string): string {
  const waktu = new Date(iso)
  if (Number.isNaN(waktu.getTime())) return iso
  return waktu.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }) + " WIB"
}
