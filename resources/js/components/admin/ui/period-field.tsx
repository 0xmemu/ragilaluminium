import * as React from "react"

import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { addPeriode, nowLocalInput, todayDateString } from "@/lib/period"
import { cn } from "@/lib/utils"

/**
 * Pemilih periode yang bisa dipakai ulang oleh form admin.
 *
 * Latar: sebelum ini setiap form menulis sendiri pemilih jadwalnya, sehingga
 * ada tiga gaya berbeda (Promo Toko punya segmented tiga mode + penanda hijau,
 * Voucher punya tombol "Mulai Sekarang" + preset durasi, Bar Promo awalnya
 * menampilkan tanggal langsung tanpa aksi cepat). Komponen ini menyatukan
 * polanya:
 *
 * - mode periode dipilih lebih dulu (jadwal baru muncul saat dijadwalkan);
 * - tombol "Mulai saat ini" mengisi tanggal/jam mulai dari waktu sekarang;
 * - preset durasi mengisi tanggal/jam berakhir dari titik mulai;
 * - kotak tanggal memakai primitif Field supaya label, petunjuk, dan galat
 *   sejajar dengan field lain (ADR-022).
 *
 * Tidak menambah pustaka kalender baru: tetap memakai input bawaan peramban
 * (type="date" / "datetime-local") seperti seluruh panel admin.
 */

/** Pilihan mode periode yang tampil di segmented control. */
export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** Segmented control kecil (pola sama dengan Waktu berlaku di Promo Toko). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<SegmentedOption<T>>
  label?: string
  className?: string
}) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      {label ? <span className="text-[13px] font-medium text-foreground">{label}</span> : null}
      <div className="flex w-fit flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded px-2.5 py-1 transition-colors",
              value === option.value
                ? "bg-card font-semibold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Preset durasi berakhir: hitung dari titik mulai memakai hari atau jam. */
export interface PeriodePreset {
  label: string
  days?: number
  hours?: number
}

/**
 * Deret aksi cepat periode: "Mulai saat ini", preset durasi, dan pengosong.
 * Dipakai di bawah kotak tanggal.
 */
export function PeriodeQuickActions({
  startsAt,
  endsAt,
  onStartsAtChange,
  onEndsAtChange,
  withTime = false,
  presets = [],
  className,
}: {
  startsAt: string
  endsAt: string
  onStartsAtChange: (value: string) => void
  onEndsAtChange: (value: string) => void
  /** true = nilai berformat tanggal+jam, false = tanggal saja. */
  withTime?: boolean
  presets?: PeriodePreset[]
  className?: string
}) {
  const kosong = withTime ? nowLocalInput() : todayDateString()
  const titikMulai = () => startsAt || kosong

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-[11px]", className)}>
      <button
        type="button"
        onClick={() => onStartsAtChange(kosong)}
        className="rounded border border-border bg-surface px-2 py-0.5 font-semibold text-foreground transition-colors hover:bg-muted"
      >
        Mulai saat ini
      </button>
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onEndsAtChange(addPeriode(titikMulai(), preset))}
          className="rounded border border-border bg-surface px-2 py-0.5 text-foreground transition-colors hover:bg-muted"
        >
          {preset.label}
        </button>
      ))}
      {endsAt ? (
        <button
          type="button"
          onClick={() => onEndsAtChange("")}
          className="rounded border border-border bg-surface px-2 py-0.5 text-muted-foreground transition-colors hover:bg-muted"
        >
          Kosongkan berakhir
        </button>
      ) : null}
    </div>
  )
}

export type PeriodeMode = "always" | "scheduled"

/**
 * Editor periode lengkap: segmented mode + (bila dijadwalkan) kotak mulai,
 * kotak berakhir, dan aksi cepat.
 */
export function PeriodeField({
  mode,
  onModeChange,
  modeOptions,
  startsAt,
  endsAt,
  onStartsAtChange,
  onEndsAtChange,
  withTime = false,
  presets = [],
  startLabel = "Mulai",
  endLabel = "Berakhir",
  errors,
  alwaysNote,
  className,
}: {
  mode: PeriodeMode
  onModeChange: (mode: PeriodeMode) => void
  modeOptions: Array<SegmentedOption<PeriodeMode>>
  startsAt: string
  endsAt: string
  onStartsAtChange: (value: string) => void
  onEndsAtChange: (value: string) => void
  withTime?: boolean
  presets?: PeriodePreset[]
  startLabel?: string
  endLabel?: string
  errors?: { starts_at?: string; ends_at?: string }
  /** Keterangan saat mode "selalu tampil" (opsional). */
  alwaysNote?: string
  className?: string
}) {
  const tipe = withTime ? "datetime-local" : "date"

  return (
    <>
      <SegmentedControl
        value={mode}
        onChange={onModeChange}
        options={modeOptions}
        label="Periode tampil"
        className={className}
      />

      {mode === "scheduled" ? (
        <>
          <Field id="starts_at" label={startLabel} error={errors?.starts_at}>
            <Input
              type={tipe}
              value={startsAt}
              onChange={(event) => onStartsAtChange(event.target.value)}
            />
          </Field>
          <Field id="ends_at" label={endLabel} error={errors?.ends_at}>
            <Input
              type={tipe}
              value={endsAt}
              onChange={(event) => onEndsAtChange(event.target.value)}
            />
          </Field>
          <PeriodeQuickActions
            startsAt={startsAt}
            endsAt={endsAt}
            onStartsAtChange={onStartsAtChange}
            onEndsAtChange={onEndsAtChange}
            withTime={withTime}
            presets={presets}
          />
        </>
      ) : alwaysNote ? (
        <p className="rounded-md border border-dashed border-border bg-surface/50 px-3 py-2 text-xs text-muted-foreground">
          {alwaysNote}
        </p>
      ) : null}
    </>
  )
}
