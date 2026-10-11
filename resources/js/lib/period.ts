/**
 * Helper periode untuk form admin (tanggal saja atau tanggal + jam).
 *
 * Disatukan di sini karena sebelumnya fungsi yang sama disalin di beberapa
 * form (Promo Toko dan Voucher punya nowLocalInput/addHoursLocalInput yang
 * identik, Bar Promo punya versi tanggal-saja). Semua nilai keluaran mengikuti
 * format input bawaan peramban: `YYYY-MM-DD` untuk type="date" dan
 * `YYYY-MM-DDTHH:mm` untuk type="datetime-local", memakai zona waktu peramban.
 */

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Tanggal hari ini sebagai `YYYY-MM-DD`. */
export function todayDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Waktu sekarang sebagai `YYYY-MM-DDTHH:mm`. */
export function nowLocalInput(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Ubah ISO dari server menjadi `YYYY-MM-DDTHH:mm` untuk input datetime-local. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Geser tanggal sejumlah hari; hasil `YYYY-MM-DD`. */
export function addDaysDateString(base: string | null | undefined, days: number): string {
  const date = base ? new Date(base) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const target = new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
}

/** Geser waktu sejumlah jam; hasil `YYYY-MM-DDTHH:mm`. */
export function addHoursLocalInput(base: string | null | undefined, hours: number): string {
  const date = base ? new Date(base) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const target = new Date(date.getTime() + hours * 60 * 60 * 1000)
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`
}

/**
 * Geser nilai periode sesuai satuan: `days` menghasilkan `YYYY-MM-DD`, `hours`
 * menghasilkan `YYYY-MM-DDTHH:mm`. Dipakai tombol preset yang sama untuk form
 * ber-tanggal maupun ber-tanggal+jam.
 */
export function addPeriode(
  base: string | null | undefined,
  jarak: { days?: number; hours?: number },
): string {
  if (typeof jarak.hours === "number") return addHoursLocalInput(base, jarak.hours)
  if (typeof jarak.days === "number") return addDaysDateString(base, jarak.days)
  return ""
}
