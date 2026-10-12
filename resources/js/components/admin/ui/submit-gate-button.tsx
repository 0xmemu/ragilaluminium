import * as React from "react"

import { Button, type ButtonProps } from "@/components/admin/ui/button"
import { HintTip } from "@/components/admin/ui/hint-tip"
import { hitungGerbang, type GerbangForm } from "@/lib/submit-gate"

/**
 * Tombol submit yang mati saat gerbangnya terkunci.
 *
 * Gerbangnya dihitung di sini dari `form` dan daftar kolom wajib, bukan diserahkan
 * sebagai objek dari halaman. Alasannya praktis: komponen ini dipakai di form
 * utama sekaligus form kedua di halaman yang sama (mis. form meta halaman), dan
 * menghitung di tempat membuat tidak ada urutan deklarasi yang harus dijaga.
 *
 * Pasangannya, penjaga untuk atribut `onSubmit`, ada di `lib/submit-gate.ts`
 * (`jagaSubmit`) dan memakai fungsi perhitungan yang sama:
 *
 * ```tsx
 * const fields = { name: "Nama Kategori" }
 *
 * <form onSubmit={jagaSubmit(form, fields, submit)}>
 *   <SubmitGateButton form={form} fields={fields} formId="category-form" processing={form.processing}>
 *     Tambah
 *   </SubmitGateButton>
 * ```
 */
export function SubmitGateButton({
  form,
  fields,
  reason,
  requireChange,
  extraDisabled = false,
  extraDisabledReason,
  formId,
  label,
  children,
  processing = false,
  processingLabel = "Menyimpan...",
  variant = "primary",
  size = "md",
  className,
}: {
  /** `useForm` dari halaman. */
  form: GerbangForm
  /** Kolom wajib: daftar nama, atau peta nama ke label yang dibaca manusia. */
  fields: string[] | Record<string, string>
  /** Kalimat dasar alasan; rincian kolom kosong ditambahkan di belakangnya. */
  reason?: string
  /** Form edit: terkunci selama belum ada perubahan sama sekali. */
  requireChange?: boolean
  /**
   * Syarat tambahan dari halaman yang tidak berhubungan dengan isi form, mis.
   * form yang juga harus menunggu mode urut selesai. Saat aktif, tombolnya mati
   * dan `extraDisabledReason` yang dipakai sebagai alasan.
   */
  extraDisabled?: boolean
  extraDisabledReason?: string
  /** Id form yang disubmit tombol ini, untuk tombol yang berada di luar form. */
  formId?: string
  /** Label tombol; `children` menang bila keduanya diisi. */
  label?: React.ReactNode
  children?: React.ReactNode
  processing?: boolean
  processingLabel?: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
}) {
  const hasil = hitungGerbang({ form, fields, reason, requireChange })
  const terkunci = hasil.terkunci || extraDisabled
  const alasan = extraDisabled ? (extraDisabledReason ?? hasil.alasan) : hasil.alasan

  const tombol = (
    <Button
      type="submit"
      {...(formId ? { form: formId } : {})}
      variant={variant}
      size={size}
      className={className}
      disabled={processing || terkunci}
    >
      {processing ? processingLabel : (children ?? label)}
    </Button>
  )

  if (!terkunci || processing) return tombol

  // Tombol mati WAJIB punya alasan. Tombol `disabled` tidak bisa difokuskan
  // keyboard, jadi yang menerima fokus adalah pembungkus hint dari HintTip, dan
  // teks alasannya juga selalu ada di DOM sebagai bacaan pembaca layar.
  return (
    <HintTip label={tombol} hint={alasan} side="bottom" align="right" className="no-underline" />
  )
}
