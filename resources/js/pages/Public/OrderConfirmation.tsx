import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

function paymentMethodLabel(method: string | undefined): string {
  if (method === "transfer") return "Transfer Bank"
  if (method === "cod") return "COD"
  return method ? method : "-"
}

function formatOrderTime(value?: string): string {
  if (!value) return "-"
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  } catch {
    return value
  }
}

export default function OrderConfirmation({
  order,
}: {
  order: PublicOrder
}) {
  const orderTime = formatOrderTime(order.created_at)
  const [copied, setCopied] = React.useState(false)
  const copiedTimerRef = React.useRef<number | null>(null)
  const isTransfer = order.payment_method === "transfer"

  const statusLabel = isTransfer ? "Menunggu Pembayaran" : "Menunggu Konfirmasi"
  const statusColor = isTransfer ? "#2c6d9b" : "#2b734e"
  const helperCopy = isTransfer
    ? "Terima kasih sudah belanja di Ragil Aluminium. Admin kami akan segera menghubungi Anda melalui WhatsApp untuk mengirim info nomor rekening dan konfirmasi pesanan."
    : "Terima kasih sudah belanja di Ragil Aluminium. Admin kami akan menghubungi Anda melalui WhatsApp untuk konfirmasi pesanan."
  const noticeText = isTransfer
    ? `Transfer '${formatCurrency(order.total_amount)}' ke nomor rekening yang kami kirim melalui WhatsApp dan kirim bukti pembayaran. Admin akan konfirmasi pesanan setelah pembayaran diterima.`
    : "Anda memilih pembayaran COD. Siapkan pembayaran tunai saat barang tiba. Balas pesan WhatsApp kami agar pesanan segera diproses."

  // bersihkan timer saat unmount - jangan setState setelah halaman ditutup.
  React.useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
  }, [])

  async function copyOrderNumber() {
    try {
      await navigator.clipboard.writeText(order.order_number)
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
      setCopied(true)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <PublicLayout>
      <Head title={`Pesanan ${order.order_number}`} />

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs items={[{ label: "Beranda", href: routeUrl("home") }, { label: "Pesanan berhasil" }]} />
        </div>
        <div className="container-page py-2 !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              Pesanan Berhasil
            </h1>
          </div>
        </div>
      </section>

      <section className="container-page !px-2.5 pt-6 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] md:!px-8 lg:!px-12 sm:pt-10 lg:pb-8">
        <div className="mx-auto max-w-2xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-success text-success-foreground">
            <Icon name="check-circle" className="h-7 w-7" weight="fill" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-bold tracking-tight text-success">
            Pesanan anda berhasil dibuat!
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">{helperCopy}</p>

          <div className="mt-9 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold tracking-tight text-foreground">Ringkasan Pesanan</h2>
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: `${statusColor}1a`, color: statusColor }}
              >
                {statusLabel}
              </span>
            </div>
            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <dt className="text-sm text-muted-foreground">No. Pesanan</dt>
                <dd className="flex items-center gap-2">
                  <span className="tabular-nums font-semibold text-foreground">{order.order_number}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={copyOrderNumber}>
                    <Icon name={copied ? "check" : "clipboard-list"} className="h-4 w-4" aria-hidden="true" />
                    {copied ? "Tersalin" : "Salin"}
                  </Button>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <dt className="text-sm text-muted-foreground">Metode Pembayaran</dt>
                <dd className="font-semibold text-foreground">{paymentMethodLabel(order.payment_method)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <dt className="text-sm text-muted-foreground">Waktu Pemesanan</dt>
                <dd className="tabular-nums font-semibold text-foreground">{orderTime}</dd>
              </div>
            </dl>
          </div>

          <Alert tone="info" className="mt-8">
            {noticeText}
          </Alert>

          <div className="mt-8 flex items-center gap-2.5 text-sm text-muted-foreground">
            <Icon name="check-circle" className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p>
              <span className="font-bold text-foreground">Belanja Aman &amp; Terpercaya</span>
              <span> · Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.</span>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-7">
            <Button asChild size="lg">
              <Link href={routeUrl("order.status")}>
                Cek Pesanan
                <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={routeUrl("home")}>Beranda</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}