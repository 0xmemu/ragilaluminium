import * as React from "react"

import { Button, type ButtonProps } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { formatCurrency } from "@/lib/format"

interface StatusAction {
  label: string
  next_status: string | null
  kind?: string
  hint?: string | null
}

/**
 * Tombol aksi status pesanan yang wajib melewati popup konfirmasi dulu
 * (kontrak owner: semua tombol aksi harus ada popup konfirmasi).
 *
 * Pengecualian: kind "input_resi" tidak diberi popup ganda karena tombolnya
 * membuka form resi, bukan langsung mengeksekusi perubahan status.
 */
export function StatusConfirmButton({
  action,
  totalAmount,
  busy = false,
  disabled = false,
  titleAttr,
  size = "xs",
  variant = "primary",
  className,
  onConfirm,
}: {
  action: StatusAction | null
  totalAmount: number
  busy?: boolean
  disabled?: boolean
  titleAttr?: string
  size?: ButtonProps["size"]
  variant?: ButtonProps["variant"]
  className?: string
  onConfirm: () => void
}) {
  if (!action?.next_status) return null

  if (action.kind === "input_resi") {
    return (
      <Button
        size={size}
        variant={variant}
        className={className}
        disabled={busy || disabled}
        title={titleAttr}
        onClick={onConfirm}
      >
        {busy ? "Memproses..." : action.label}
      </Button>
    )
  }

  const description =
    action.kind === "confirm_transfer"
      ? `Pastikan pembayaran sudah dilakukan dengan nominal ${formatCurrency(totalAmount)} sebelum mengkonfirmasi pesanan.`
      : action.kind === "advance_cod"
        ? "Pesanan COD akan langsung diproses dan pelanggan mendapat notifikasi WhatsApp."
        : action.kind === "settle_cod"
          ? "Pesanan akan diselesaikan dan pembayaran COD otomatis ditandai lunas."
          : action.hint || "Tindakan ini akan mengubah status pesanan. Lanjutkan?"

  return (
    <ConfirmAction
      trigger={
        <Button
          size={size}
          variant={variant}
          className={className}
          disabled={busy || disabled}
          title={titleAttr}
        >
          {busy ? "Memproses..." : action.label}
        </Button>
      }
      title={action.kind === "confirm_transfer" ? "Konfirmasi Pesanan Transfer" : action.label}
      description={description}
      confirmLabel={action.label}
      processing={busy}
      variant="primary"
      onConfirm={onConfirm}
    />
  )
}
