import * as React from "react"

import { Button, type ButtonProps } from "@/components/admin/ui/button"
import { HintTip } from "@/components/admin/ui/hint-tip"
import type { GerbangHasil } from "@/lib/submit-gate"

/**
 * Tombol submit yang mati saat gerbangnya terkunci.
 *
 * Aturan, alasan, dan fungsi `buatGerbang` yang dipasangkan dengannya ada di
 * `lib/submit-gate.ts`. Halaman memakai keduanya seperti ini:
 *
 * ```tsx
 * const gerbang = buatGerbang({ form, fields: { name: "Nama Kategori" }, requireChange: isEdit })
 *
 * <form onSubmit={gerbang.guard(submit)}>
 *   <SubmitGateButton gate={gerbang} formId="category-form" label="Tambah" />
 * ```
 */
export function SubmitGateButton({
  gate,
  formId,
  label,
  processing = false,
  processingLabel = "Menyimpan...",
  variant = "primary",
  size = "md",
  className,
}: {
  gate: GerbangHasil
  /** Id form yang disubmit tombol ini, lewat atribut `form`. */
  formId: string
  label: string
  processing?: boolean
  processingLabel?: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  className?: string
}) {
  const tombol = (
    <Button
      type="submit"
      form={formId}
      variant={variant}
      size={size}
      className={className}
      disabled={processing || gate.terkunci}
    >
      {processing ? processingLabel : label}
    </Button>
  )

  if (!gate.terkunci || processing) return tombol

  // Tombol mati WAJIB punya alasan. Tombol `disabled` tidak bisa difokuskan
  // keyboard, jadi yang menerima fokus adalah pembungkus hint dari HintTip, dan
  // teks alasannya juga selalu ada di DOM sebagai bacaan pembaca layar.
  return (
    <HintTip label={tombol} hint={gate.alasan} side="bottom" align="right" className="no-underline" />
  )
}
