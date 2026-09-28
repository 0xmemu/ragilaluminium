import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { ReturnCreateForm, type ReturnCreateFormItem } from "@/components/admin/order-return-create-form"

/** Baris pesanan dari daftar yang cukup untuk membuka form retur di popup. */
export interface ReturnCreateDialogOrder {
  id: number
  order_number?: string
  items: ReturnCreateFormItem[]
}

/**
 * Popup pengisian detail retur dari daftar pesanan (owner 2026-09-28: klik
 * Retur di kolom Aksi harus membuka popup, bukan pindah ke halaman detail).
 *
 * Isinya form retur yang sama dengan halaman detail (satu komponen bersama),
 * jadi kontrak kiriman tidak bisa saling beda. Dialog hanya dipakai untuk
 * pesanan berstatus Sampai; penolakan server tetap divalidasi backend dan
 * ditampilkan di dalam popup ini.
 */
export function ReturnCreateDialog({
  order,
  onClose,
}: {
  order: ReturnCreateDialogOrder | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(order)} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-2xl bg-card text-card-foreground">
        <DialogTitle>Catat retur pesanan {order?.order_number ?? ""}</DialogTitle>
        <DialogDescription>
          Pesanan berpindah ke status Retur Diproses setelah retur dicatat.
        </DialogDescription>
        {order ? (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ReturnCreateForm key={order.id} orderId={order.id} items={order.items} onSubmitted={onClose} />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
