import { cn } from "@/lib/utils"

/**
 * Penghitung huruf untuk kolom yang punya batas panjang (owner 2026-10-13).
 *
 * Menampilkan berapa huruf yang sudah dipakai dari batas kolom, dan menegaskan
 * angkanya begitu batas tercapai. Batas itu sendiri ditegakkan `maxLength` pada
 * isian dan `max` di validasi server, jadi angka ini tidak pernah melewatinya;
 * gunanya memberi tahu, bukan menolak.
 *
 * Dihitung per titik kode (bukan satuan kode UTF-16), supaya cocok dengan
 * hitungan server yang memakai mb_strlen untuk huruf di luar ASCII.
 */
export function CharCount({
  value,
  max,
  className,
}: {
  value: string
  max: number
  className?: string
}) {
  const dipakai = Array.from(value).length
  const penuh = dipakai >= max

  return (
    <span className={cn("tabular-nums", penuh && "font-semibold text-foreground", className)}>
      {dipakai}/{max}
    </span>
  )
}
