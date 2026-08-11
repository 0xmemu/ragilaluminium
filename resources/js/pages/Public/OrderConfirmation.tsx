import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { OrderEta, PublicOrder, SharedPageProps } from "@/types"

interface PaymentInstructions {
  bank_name: string
  account_name: string
  account_number: string
  notes: string
}

function paymentMethodLabel(method: string | undefined): string {
  if (method === "transfer") return "Transfer bank"
  if (method === "cod") return "COD (bayar di tempat)"
  return method ? method : "-"
}

export default function OrderConfirmation({
  order,
  payment_instructions = null,
  whatsapp_url = null,
  eta = null,
}: {
  order: PublicOrder
  payment_instructions?: PaymentInstructions | null
  whatsapp_url?: string | null
  eta?: OrderEta | null
}) {
  const { brand } = usePage<SharedPageProps>().props
  const [copied, setCopied] = React.useState(false)
  const [copiedAccount, setCopiedAccount] = React.useState(false)
  const copiedTimerRef = React.useRef<number | null>(null)
  const accountTimerRef = React.useRef<number | null>(null)
  const isTransfer = order.payment_method === "transfer"

  // §8: bersihkan timer saat unmount — jangan setState setelah halaman ditutup.
  React.useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
    if (accountTimerRef.current !== null) window.clearTimeout(accountTimerRef.current)
  }, [])

  async function copyText(value: string, kind: "order" | "account") {
    try {
      await navigator.clipboard.writeText(value)
      const timerRef = kind === "order" ? copiedTimerRef : accountTimerRef
      const setCopiedState = kind === "order" ? setCopied : setCopiedAccount
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      setCopiedState(true)
      timerRef.current = window.setTimeout(() => setCopiedState(false), 1800)
    } catch {
      // ignore clipboard failures
    }
  }

  return (
    <PublicLayout>
      <Head title={`Pesanan ${order.order_number}`} />

      <section className="border-b border-border bg-surface">
        <div className="container-page py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
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

      <section className="container-page py-4 lg:py-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-success text-success-foreground">
            <Icon name="check-circle" className="h-7 w-7" weight="fill" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-bold tracking-tight text-success">
            Terima kasih, {order.customer_name}.
          </p>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            Simpan nomor pesanan berikut. Nomor ini dipakai bersama nomor HP atau email untuk
            melihat status pesanan.
          </p>

          <div className="precision-frame mt-9">
            <div className="rounded-lg bg-foreground p-6 text-background sm:p-8">
              <p className="text-xs font-semibold tracking-tight text-background/60">
                Nomor pesanan
              </p>
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="tabular-nums break-all font-mono text-lg font-semibold">
                  {order.order_number}
                </p>
                <Button variant="secondary" onClick={() => copyText(order.order_number, "order")}>
                  <Icon name={copied ? "check" : "clipboard-list"} className="h-4 w-4" aria-hidden="true" />
                  {copied ? "Tersalin" : "Salin nomor"}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {[
              ["Metode bayar", null, paymentMethodLabel(order.payment_method)],
              ["Pesanan", order.order_status, null],
              ["Pembayaran", order.payment_status, null],
              ["Pengiriman", order.shipping_status, null],
            ].map(([label, status, text]) => (
              <div key={String(label)} className="bg-surface p-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="mt-3">
                  {status ? <StatusBadge status={String(status)} /> : (
                    <p className="text-sm font-semibold">{text}</p>
                  )}
                </div>
              </div>
            ))}
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
                    Pesanan diperkirakan tiba pada{" "}
                    <span className="font-semibold text-foreground">{eta.range_label}</span>
                    {" "}— {eta.production_days} hari produksi + {eta.min_days}–{eta.max_days} hari
                    pengiriman sejak pesanan dibuat.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isTransfer && payment_instructions ? (
            <section className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-7">
              <h2 className="text-xl font-semibold">Instruksi transfer</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Transfer tepat <span className="font-semibold text-foreground">{formatCurrency(order.total_amount)}</span> ke rekening berikut.
              </p>
              <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Bank</dt>
                  <dd className="mt-1 font-semibold">{payment_instructions.bank_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Atas nama</dt>
                  <dd className="mt-1 font-semibold">{payment_instructions.account_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Nomor rekening</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {payment_instructions.account_number}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 px-2 text-xs"
                      onClick={() => copyText(payment_instructions.account_number, "account")}
                    >
                      {copiedAccount ? "Tersalin" : "Salin"}
                    </Button>
                  </dd>
                </div>
              </dl>
              <Alert tone="info" className="mt-4">
                {payment_instructions.notes}
              </Alert>
            </section>
          ) : null}

          {order.payment_method === "cod" ? (
            <Alert tone="info" className="mt-8">
              Anda memilih COD. Siapkan pembayaran tunai sebesar {formatCurrency(order.total_amount)} saat barang tiba.
              Tim {brand.short_name} akan menghubungi Anda via WhatsApp untuk konfirmasi.
            </Alert>
          ) : null}

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
                  {isTransfer ? "Kirim bukti via WhatsApp" : "Chat WhatsApp"}
                </a>
              </Button>
            ) : null}
            <Button asChild size="lg" variant={whatsapp_url ? "secondary" : undefined}>
              <Link href={routeUrl("order.status")}>
                Cek status pesanan
                <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href={routeUrl("home")}>Kembali ke beranda</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
