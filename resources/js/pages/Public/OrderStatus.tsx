import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { ShippingTrackPanel } from "@/components/shared/shipping-track-panel"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder } from "@/types"

function OrderDetail({
  order,
  eyebrow = "Pesanan",
}: {
  order: PublicOrder
  eyebrow?: string
}) {
  return (
    <div className="animate-reveal">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-tight text-success">
            {eyebrow}
          </p>
          <h2 className="tabular-nums mt-2 break-all font-mono text-xl font-semibold sm:text-2xl">
            {order.order_number}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Atas nama {order.customer_name}</p>
        </div>
        <p className="tabular-nums text-xl font-bold sm:text-2xl">
          {formatCurrency(order.total_amount)}
        </p>
      </div>

      <div className="mt-8">
        <ShippingTrackPanel
          track={
            order.tracking ?? {
              shipping_status: order.shipping_status,
              carrier_name: order.shipping?.carrier_name,
              waybill_number: order.shipping?.waybill_number,
              record_status: order.shipping?.status,
              status_raw: order.shipping?.status_raw,
              last_status_at: order.shipping?.last_status_at,
              tracking_url: order.shipping?.tracking_url,
              order_status: order.order_status,
              payment_status: order.payment_status,
              payment_method: order.payment_method,
              total_amount: order.total_amount,
            }
          }
        />
      </div>

      <section className="mt-8">
        <h3 className="text-lg font-semibold">Item pesanan</h3>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {order.items.map((item, index) => (
            <li
              key={`${item.product_name}-${index}`}
              className="flex justify-between gap-4 py-4 text-sm"
            >
              <span className="font-semibold">{item.product_name ?? item.name}</span>
              <span className="tabular-nums text-muted-foreground">{item.quantity} item</span>
            </li>
          ))}
        </ul>
      </section>

      <Alert tone="info" className="mt-8">
        Jika status belum berubah, buka ulang halaman pesanan beberapa menit lagi atau hubungi tim
        Ragil.
      </Alert>
      <Button asChild variant="secondary" className="mt-4">
        <Link href={routeUrl("contact")}>Hubungi kami</Link>
      </Button>
    </div>
  )
}

export default function OrderStatus({
  order = null,
  orders = [],
  has_session_orders = false,
  searched = false,
}: {
  order?: PublicOrder | null
  orders?: PublicOrder[]
  has_session_orders?: boolean
  searched?: boolean
}) {
  const sessionList = orders.length ? orders : order ? [order] : []
  const [activeNumber, setActiveNumber] = React.useState(
    () => sessionList[0]?.order_number ?? "",
  )

  React.useEffect(() => {
    const list = orders.length ? orders : order ? [order] : []
    setActiveNumber((current) =>
      list.some((row) => row.order_number === current)
        ? current
        : (list[0]?.order_number ?? ""),
    )
  }, [orders, order])

  const activeOrder =
    sessionList.find((row) => row.order_number === activeNumber) ?? sessionList[0] ?? null

  const [identityMode, setIdentityMode] = React.useState<"phone" | "email">("phone")
  const form = useForm({
    order_number: "",
    customer_phone: "",
    customer_email: "",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
      order_number: data.order_number,
      customer_phone: identityMode === "phone" ? data.customer_phone : "",
      customer_email: identityMode === "email" ? data.customer_email : "",
    }))
    form.post(routeUrl("order.status.lookup"), {
      preserveScroll: true,
    })
  }

  const showLookupForm = !has_session_orders

  return (
    <PublicLayout>
      <Head title="Pesanan">
        <meta
          name="description"
          content="Cek status pesanan dari perangkat ini, atau masukkan nomor pesanan beserta HP/email checkout."
        />
      </Head>

      <section className="container-page flex items-center gap-2 pb-4 pt-4 lg:pb-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex shrink-0 items-center justify-center"
          aria-label="Kembali"
        >
          <Icon name="caret-left" className="size-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {has_session_orders ? "Pesanan di perangkat ini" : "Cek pesanan"}
        </h1>
      </section>

      <section className="container-page min-w-0 pb-5 lg:pb-8">
        {showLookupForm ? (
          <div className="grid min-w-0 gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-12">
            <form onSubmit={submit} className="surface-panel p-5 sm:p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-semibold">Cek pesanan</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Gunakan data yang sama dengan saat checkout.
              </p>
              <FormErrorSummary className="mt-5" errors={form.errors} />
              <div className="mt-6 space-y-5">
                <Field
                  id="order-number"
                  label="Nomor pesanan"
                  required
                  error={form.errors.order_number}
                >
                  <Input
                    value={form.data.order_number}
                    onChange={(event) => form.setData("order_number", event.target.value)}
                    placeholder="Contoh: RA-..."
                    autoComplete="off"
                    className="font-mono"
                  />
                </Field>

                <div>
                  <p className="text-sm font-semibold">Cocokkan dengan</p>
                  <div className="mt-2 grid grid-cols-2 rounded-md border border-border bg-surface-muted p-1">
                    {[
                      ["phone", "Nomor HP"],
                      ["email", "Email"],
                    ].map(([value, label]) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setIdentityMode(value as "phone" | "email")}
                        className={cn(
                          "min-h-10 rounded-sm px-3 text-xs font-semibold transition",
                          identityMode === value
                            ? "bg-surface text-foreground shadow-sm"
                            : "text-muted-foreground",
                        )}
                        aria-pressed={identityMode === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {identityMode === "phone" ? (
                  <Field
                    id="customer-phone"
                    label="Nomor HP/WhatsApp"
                    required
                    error={form.errors.customer_phone}
                  >
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={form.data.customer_phone}
                      onChange={(event) => form.setData("customer_phone", event.target.value)}
                      autoComplete="tel"
                    />
                  </Field>
                ) : (
                  <Field
                    id="customer-email"
                    label="Email"
                    required
                    error={form.errors.customer_email}
                  >
                    <Input
                      type="email"
                      value={form.data.customer_email}
                      onChange={(event) => form.setData("customer_email", event.target.value)}
                      autoComplete="email"
                    />
                  </Field>
                )}
              </div>
              <Button type="submit" size="lg" className="mt-6 w-full" disabled={form.processing}>
                <Icon name="search" className="h-5 w-5" aria-hidden="true" />
                {form.processing ? "Mencocokkan..." : "Lihat pesanan"}
              </Button>
            </form>

            <div>
              {!searched ? (
                <div className="flex min-h-[22rem] flex-col justify-center border-y border-border py-10">
                  <span className="flex h-12 w-12 items-center justify-center rounded-md bg-surface-muted text-primary">
                    <Icon name="clipboard-list" className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="mt-6 text-xl font-semibold sm:text-2xl">
                    Cek pesanan Anda
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                    Setelah checkout di perangkat yang sama, pesanan biasanya tampil otomatis.
                    Jika daftar kosong, isi formulir di samping dengan nomor pesanan dan HP/email.
                  </p>
                </div>
              ) : order ? (
                <OrderDetail order={order} eyebrow="Pesanan ditemukan" />
              ) : (
                <EmptyState
                  icon="search"
                  title="Pesanan tidak ditemukan"
                  description="Nomor pesanan dan identitas belum cocok. Periksa format, lalu coba kembali tanpa membagikan data tersebut kepada orang lain."
                  action={
                    <Button variant="secondary" onClick={() => form.reset()}>
                      Bersihkan form
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-10 lg:items-start lg:gap-12",
              sessionList.length > 1 && "lg:grid-cols-[16rem_minmax(0,1fr)]",
            )}
          >
            {sessionList.length > 1 ? (
              <aside className="space-y-2 lg:sticky lg:top-28">
                <p className="text-xs font-bold tracking-tight text-muted-foreground">
                  Daftar pesanan
                </p>
                <ul className="divide-y divide-border border border-border bg-surface">
                  {sessionList.map((row) => (
                    <li key={row.order_number}>
                      <button
                        type="button"
                        onClick={() => setActiveNumber(row.order_number)}
                        className={cn(
                          "flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition",
                          row.order_number === activeOrder?.order_number
                            ? "bg-surface-muted"
                            : "hover:bg-surface-muted/60",
                        )}
                        aria-current={
                          row.order_number === activeOrder?.order_number ? "true" : undefined
                        }
                      >
                        <span className="break-all font-mono text-xs font-semibold">
                          {row.order_number}
                        </span>
                        <ShippingTrackPanel
                          compact
                          className="w-full"
                          track={
                            row.tracking ?? {
                              shipping_status: row.shipping_status,
                              order_status: row.order_status,
                              payment_status: row.payment_status,
                              total_amount: row.total_amount,
                            }
                          }
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}

            <div>
              {activeOrder ? (
                <OrderDetail
                  order={activeOrder}
                  eyebrow={sessionList.length > 1 ? "Pesanan dipilih" : "Pesanan perangkat ini"}
                />
              ) : (
                <EmptyState
                  icon="clipboard-list"
                  title="Belum ada pesanan di perangkat ini"
                  description="Selesaikan checkout di perangkat ini, atau gunakan formulir Cek pesanan di samping."
                />
              )}
            </div>
          </div>
        )}
      </section>
    </PublicLayout>
  )
}
