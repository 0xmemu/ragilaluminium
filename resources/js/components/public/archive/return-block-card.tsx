/**
 * ARSIP (U2 - task review-form-ui-perbaikan 2026-08-25).
 *
 * Komponen "Retur & Penyelesaian" pelanggan TIDAK lagi dirender di UI
 * pelanggan. Backend & payload (order.return_block, return_whatsapp_url)
 * TIDAK diubah; hanya tampilan yang diarsipkan. File ini dipertahankan
 * supaya mudah dipulihkan bila owner memutuskan menampilkan kembali.
 *
 * Jangan dipanggil dari komponen aktif.
 */
import { Button } from "@/components/ui/button"
import type { PublicOrder } from "@/types"

export function ReturnBlockCard({ order }: { order: PublicOrder }) {
  if (order.order_status !== "delivered") return null
  const block = order.return_block
  if (!block) return null

  const deadlineText = block.deadline
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(block.deadline))
    : null
  const deliveredText = order.delivered_at
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.delivered_at))
    : null

  return (
    <section className="order-tracking__return rounded-[14px] border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-xs font-bold tracking-tight text-muted-foreground">Retur &amp; Penyelesaian</h3>
      {deliveredText ? (
        <p className="mt-2 text-xs text-muted-foreground">Paket sampai: {deliveredText} WIB</p>
      ) : null}
      {block.eligible ? (
        <div className="mt-2">
          <p className="text-sm font-semibold text-foreground">Anda dapat mengajukan retur</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {block.deadline && deadlineText
              ? `Ajukan sebelum ${deadlineText} WIB sesuai kebijakan 48 jam setelah barang sampai.`
              : "Ajukan sesuai kebijakan 48 jam setelah barang sampai."}
          </p>
          {order.return_whatsapp_url ? (
            <Button asChild size="sm" className="mt-3">
              <a href={order.return_whatsapp_url} target="_blank" rel="noreferrer">
                Ajukan Retur via WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm font-medium text-foreground">{block.reason ?? "Retur tidak dapat diajukan."}</p>
          {order.return_whatsapp_url ? (
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <a href={order.return_whatsapp_url} target="_blank" rel="noreferrer">
                Tindak Lanjut via WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      )}
    </section>
  )
}