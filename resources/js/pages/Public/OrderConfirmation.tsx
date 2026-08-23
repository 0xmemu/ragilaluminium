import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { displayEtaRangeLabel } from "@/lib/order-eta-display"
import { routeUrl } from "@/lib/routes"
import type { OrderEta, PublicOrder } from "@/types"

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
  whatsapp_url = null,
  eta = null,
}: {
  order: PublicOrder
  whatsapp_url?: string | null
  eta?: OrderEta | null
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

  // §8: bersihkan timer saat unmount - jangan setState setelah halaman ditutup.
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
              Pesanan berhasil
            </h1>
          </div>
        </div>
      </section>

      <section className="container-page !px-2.5 pt-6 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] md:!px-8 lg:!px-12 sm:pt-10 lg:pb-8">
        <div className="mx-auto max-w-4xl">
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

          {eta ? (
            <div className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name="truck" className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">Estimasi diterima</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Pesanan diperkirakan tiba pada <span className="font-semibold text-foreground">{displayEtaRangeLabel(eta)}</span>.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <Alert tone={isTransfer ? "info" : "info"} className="mt-8">
            {noticeText}
          </Alert>

          <div className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[1fr_20rem]">
            <section>
              <h2 className="text-2xl font-semibold">Item pesanan</h2>
              <ul className="mt-4 divide-y divide-border border-y border-border">
                {order.items.map((item, index) => (
                  <li key={`${item.product_name}-${index}`} className="flex justify-between gap-4 py-4 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold">{item.product_name ?? item.name}</span>
                      <span className="tabular-nums mt-1 block text-xs text-muted-foreground">
                        {item.quantity} item
                      </span>
                      {item.note ? (
                        <span className="mt-1.5 block max-w-full break-words rounded-md bg-accent/60 px-2 py-1 text-[11px] leading-4 text-accent-foreground">
                          <span className="font-semibold">Catatan:</span> {item.note}
                        </span>
                      ) : null}
                    </span>
                    {item.line_total !== undefined ? (
                      <span className="tabular-nums shrink-0 font-semibold">
                        {formatCurrency(item.line_total)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            <aside className="rounded-lg bg-surface-muted p-5">
              <p className="text-sm text-muted-foreground">Total pesanan</p>
              <p className="tabular-nums mt-2 text-2xl font-bold">{formatCurrency(order.total_amount)}</p>
              <Alert tone="info" className="mt-4 bg-surface">
                {isTransfer
                  ? "Setelah transfer, kirim bukti pembayaran via WhatsApp agar pesanan diproses."
                  : "Status berikutnya mengikuti proses pembayaran dan pengiriman."}
              </Alert>
            </aside>
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-7">
            {whatsapp_url ? (
              <Button asChild size="lg">
                <a href={whatsapp_url} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" className="h-5 w-5" aria-hidden="true" />
                  {isTransfer ? "Kirim Bukti Via WhatsApp" : "Chat WhatsApp"}
                </a>
              </Button>
            ) : null}
            <Button asChild size="lg" variant={whatsapp_url ? "secondary" : undefined}>
              <Link href={routeUrl("order.status")}>
                Cek Pesanan
                <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={routeUrl("home")}>Kembali ke beranda</Link>
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-2.5 border-t border-border pt-6 text-sm text-muted-foreground">
            <Icon name="check-circle" className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p>
              <span className="font-bold text-foreground">Belanja Aman &amp; Terpercaya</span>
              <span> · Garansi jika produk rusak, pengiriman aman, dan pelayanan terbaik.</span>
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}