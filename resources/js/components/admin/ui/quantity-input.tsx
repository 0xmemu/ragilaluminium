import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

/**
 * Kontrol jumlah barang untuk panel admin: tombol kurang, isian angka, tombol
 * tambah, dalam satu baris.
 *
 * Satu-satunya sumber kontrol jumlah di panel admin (permintaan owner
 * 2026-09-29: fitur tambah jumlah harus memakai komponen bersama, karena
 * sebelumnya setiap halaman menyusun sendiri sehingga tampilannya berbeda-beda,
 * ada yang bertombol dan ada yang hanya isian angka tanpa tombol).
 *
 * Aturan yang dipegang:
 * - Tombol memakai `variant="outline"` dan `size="icon-sm"` dari kit admin, jadi
 *   satu baris form tetap sejajar dengan kontrol lain (ADR-022).
 * - Batas `min` dan `max` ditegakkan komponen ini, bukan pemanggil, supaya
 *   perilakunya sama di semua tempat, termasuk saat angka diketik langsung.
 * - `label` dipakai tombol untuk menyebut apa yang ditambah atau dikurangi
 *   (mis. "jumlah unit retur"), dan `ariaLabel` menyebut barisnya karena satu
 *   halaman bisa memuat beberapa kontrol jumlah sekaligus.
 */
export function QuantityInput({
  id,
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  label = "jumlah",
  ariaLabel,
  inputClassName,
  className,
}: {
  /** Dipakai label form di luar komponen ini supaya klik label fokus ke isian. */
  id?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  /** Kata benda untuk tombol, mis. "jumlah unit retur". */
  label?: string
  /** Nama aksesibel isian; sebutkan barisnya agar unik. */
  ariaLabel?: string
  inputClassName?: string
  className?: string
}) {
  const kurangNonaktif = disabled || value <= min
  const tambahNonaktif = disabled || (max !== undefined && value >= max)

  function terapkan(mentah: number) {
    if (!Number.isFinite(mentah)) return
    const batasAtas = max === undefined ? mentah : Math.min(max, mentah)
    onChange(Math.max(min, batasAtas))
  }

  return (
    <div className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={kurangNonaktif}
        onClick={() => terapkan(value - 1)}
        aria-label={`Kurangi ${label}`}
      >
        <Icon name="minus" className="size-3.5" aria-hidden="true" />
      </Button>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={String(value)}
        disabled={disabled}
        aria-label={ariaLabel ?? "Jumlah"}
        className={cn("w-14 text-center", inputClassName)}
        onChange={(event) => terapkan(Number(event.target.value))}
      />
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        disabled={tambahNonaktif}
        onClick={() => terapkan(value + 1)}
        aria-label={`Tambah ${label}`}
      >
        <Icon name="plus" className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}
