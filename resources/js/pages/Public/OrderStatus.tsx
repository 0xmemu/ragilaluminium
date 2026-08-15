import { Head, Link, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { OrderProgressTracker } from "@/components/public/order-progress-tracker"
import { ShippingTrackPanel } from "@/components/shared/shipping-track-panel"
import { Alert } from "@/components/ui/alert"
import { CustomerReviewForm } from "@/components/public/customer-review-form"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { displayEtaRangeLabel } from "@/lib/order-eta-display"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder, SharedPageProps } from "@/types"

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "return_completed"])
const ORDER_STATUS_STORAGE_KEY = "ragil.order-status.v1"
const MAX_STORED_ORDER_REFS = 5

type StoredOrderRef = {
  order_number: string
  customer_phone: string
}

function readStoredOrderRefs(): StoredOrderRef[] {
  try {
    const raw = window.localStorage.getItem(ORDER_STATUS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((row): row is StoredOrderRef => (
        row
        && typeof row.order_number === "string"
        && typeof row.customer_phone === "string"
        && row.order_number.trim() !== ""
        && row.customer_phone.trim() !== ""
      ))
      .slice(0, MAX_STORED_ORDER_REFS)
  } catch {
    return []
  }
}

function writeStoredOrderRefs(refs: StoredOrderRef[]): void {
  try {
    window.localStorage.setItem(
      ORDER_STATUS_STORAGE_KEY,
      JSON.stringify(refs.slice(0, MAX_STORED_ORDER_REFS)),
    )
  } catch {
    // Browser storage may be disabled (private mode or policy); session tracking still works.
  }
}

function mergeStoredRef(ref: StoredOrderRef): void {
  const refs = readStoredOrderRefs()
  writeStoredOrderRefs([
    ref,
    ...refs.filter((row) => row.order_number !== ref.order_number),
  ])
}

function mergeOrders(...lists: PublicOrder[][]): PublicOrder[] {
  const byNumber = new Map<string, PublicOrder>()
  for (const list of lists) {
    for (const row of list) {
      if (row?.order_number) byNumber.set(row.order_number, row)
    }
  }
  return Array.from(byNumber.values())
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchStoredOrder(
  ref: StoredOrderRef,
  signal: AbortSignal,
): Promise<PublicOrder | null> {
  const url = new URL(
    routeUrl("order.status.api", { order_number: ref.order_number }),
    window.location.origin,
  )
  url.searchParams.set("customer_phone", ref.customer_phone)
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  })
  if (!response.ok) return null
  return await response.json() as PublicOrder
}

function OrderDetail({
  order,
  eyebrow = "Pesanan",
  onCancel,
  cancelBusy = false,
}: {
  order: PublicOrder
  eyebrow?: string
  onCancel?: () => void
  cancelBusy?: boolean
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="rounded-lg border border-border bg-surface p-5">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">
            Status pesanan & pengiriman
          </p>
          <OrderProgressTracker order={order} />
        </div>

        <div className="space-y-4">
          {order.eta ? (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-xs font-bold tracking-tight text-muted-foreground">
                Estimasi tiba
              </p>
              <p className="mt-2 text-base font-bold text-foreground">{displayEtaRangeLabel(order.eta)}</p>
            </div>
          ) : null}

          {order.tracking?.latest_message ? (
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className="text-xs font-bold tracking-tight text-muted-foreground">
                Kabar terbaru
              </p>
              <p className="mt-2 text-sm leading-5 text-foreground">
                {order.tracking.latest_message}
              </p>
            </div>
          ) : null}

          {onCancel && order.order_status === "pending_payment" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
              <p className="text-xs font-bold tracking-tight text-destructive">
                Batalkan Pesanan
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Hanya bisa dibatalkan selama status masih menunggu konfirmasi.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={cancelBusy}
                onClick={onCancel}
              >
                {cancelBusy ? "Membatalkan..." : "Batalkan Pesanan"}
              </Button>
            </div>
          ) : null}
        </div>
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
              <span className="min-w-0">
                <span className="font-semibold">{item.product_name ?? item.name}</span>
                {item.note ? (
                  <span className="mt-1 block max-w-full break-words rounded-md bg-accent/60 px-2 py-1 text-[11px] leading-4 text-accent-foreground">
                    <span className="font-semibold">Catatan:</span> {item.note}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums shrink-0 text-muted-foreground">{item.quantity} item</span>
            </li>
          ))}
        </ul>
      </section>

      <CustomerReviewForm
        orderNumber={order.order_number}
        customerPhone={order.customer_phone ?? ""}
        orderStatus={order.order_status}
        items={order.items}
        reviews={order.reviews}
      />

      <Alert tone="info" className="mt-8">
        Pesanan tersimpan di browser ini. Gunakan browser yang sama untuk memantau status berikutnya.
        Jika status belum berubah, buka ulang halaman beberapa menit lagi atau hubungi tim Ragil.
      </Alert>
      <Button asChild variant="secondary" className="mt-4">
        <Link href={routeUrl("contact")}>Hubungi Kami</Link>
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
  const { errors: pageErrors = {} } = usePage<SharedPageProps>().props
  const serverOrders = React.useMemo(
    () => orders.length ? orders : order ? [order] : [],
    [orders, order],
  )
  const currentOrderNumber = order?.order_number ?? ""
  const [storedOrders, setStoredOrders] = React.useState<PublicOrder[]>([])
  const [browserHydrated, setBrowserHydrated] = React.useState(false)
  const [storedLoading, setStoredLoading] = React.useState(false)
  const sessionList = React.useMemo(
    () => mergeOrders(storedOrders, serverOrders),
    [serverOrders, storedOrders],
  )
  const [activeNumber, setActiveNumber] = React.useState(
    () => currentOrderNumber,
  )

  React.useEffect(() => {
    const list = sessionList
    // Keep the selected order valid after a lookup response or local restore replaces the list.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveNumber((current) =>
      list.some((row) => row.order_number === current)
        ? current
        : currentOrderNumber,
    )
  }, [sessionList, currentOrderNumber])

  const form = useForm({
    order_number: "",
    customer_phone: "",
  })
  const cancelForm = useForm({
    order_number: "",
    customer_phone: "",
  })

  // Data pesanan terbaru hasil polling (fallback ke prop awal).
  const [liveOrder, setLiveOrder] = React.useState<PublicOrder | null>(null)

  React.useEffect(() => {
    const refs = readStoredOrderRefs()
    // Tandai storage sudah dibaca agar form tidak berkedip sebelum restore selesai.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowserHydrated(true)
    if (refs.length === 0) return

    let disposed = false
    const controller = new AbortController()
    setStoredLoading(true)

    void (async () => {
      const loaded: PublicOrder[] = []
      for (const ref of refs) {
        if (disposed) return
        if (loaded.length > 0) await sleep(350)
        try {
          const row = await fetchStoredOrder(ref, controller.signal)
          if (row) loaded.push(row)
        } catch {
          // Satu order gagal dipulihkan tidak boleh menghentikan order lain.
        }
      }

      if (!disposed) {
        setStoredOrders(loaded)
        setStoredLoading(false)
      }
    })()

    return () => {
      disposed = true
      controller.abort()
    }
  }, [])

  React.useEffect(() => {
    for (const row of serverOrders) {
      if (row.customer_phone) {
        mergeStoredRef({
          order_number: row.order_number,
          customer_phone: row.customer_phone,
        })
      }
    }
  }, [serverOrders])

  const activeOrder = React.useMemo(
    () => sessionList.find((row) => row.order_number === activeNumber) ?? null,
    [sessionList, activeNumber],
  )

  React.useEffect(() => {
    // Reset data polling saat pindah order.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveOrder(null)
    // Polling hanya untuk order yang sedang tampil dan belum mencapai status terminal.
    if (!activeOrder || TERMINAL_STATUSES.has(activeOrder.order_status)) return

    let disposed = false
    let timer: number | null = null
    let inFlight = false
    let lastAttempt = 0
    let failures = 0

    const stopPolling = () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }

    const schedule = (delay: number) => {
      if (disposed) return
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        void poll()
      }, delay)
    }

    const poll = async () => {
      if (disposed || document.hidden || cancelForm.processing || inFlight) return

      const elapsed = Date.now() - lastAttempt
      if (lastAttempt > 0 && elapsed < 10_000) {
        schedule(10_000 - elapsed)
        return
      }

      inFlight = true
      lastAttempt = Date.now()

      try {
        const url = new URL(
          routeUrl("order.status.api", { order_number: activeOrder.order_number }),
          window.location.origin,
        )
        if (activeOrder.customer_phone) {
          url.searchParams.set("customer_phone", activeOrder.customer_phone)
        }
        const response = await fetch(url, {
          cache: "no-store",
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        })
        if (!response.ok) {
          failures = response.status === 429 ? Math.max(2, failures + 1) : failures + 1
          return
        }

        const fresh = await response.json() as PublicOrder
        if (disposed) return
        failures = 0
        setLiveOrder(fresh)
        if (fresh.customer_phone) {
          mergeStoredRef({
            order_number: fresh.order_number,
            customer_phone: fresh.customer_phone,
          })
        }
        setStoredOrders((current) => current.map((row) =>
          row.order_number === fresh.order_number ? fresh : row,
        ))
        if (TERMINAL_STATUSES.has(fresh.order_status)) {
          stopPolling()
        }
      } catch {
        failures += 1
      } finally {
        inFlight = false
        if (!disposed) {
          const delay = Math.min(120_000, 30_000 * (2 ** Math.min(failures, 2)))
          schedule(delay)
        }
      }
    }

    const onVisibility = () => {
      if (!document.hidden && Date.now() - lastAttempt >= 10_000) {
        void poll()
      }
    }

    document.addEventListener("visibilitychange", onVisibility)
    // Start conservatively; visibility changes may trigger one guarded refresh.
    schedule(30_000)

    return () => {
      disposed = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [activeOrder, cancelForm.processing])

  const shownOrder = liveOrder ?? activeOrder

  function cancelOrder() {
    if (!activeOrder) return
    const confirmed = window.confirm(
      `Batalkan Pesanan ${activeOrder.order_number}?\nStok produk akan dikembalikan ke katalog.`,
    )
    if (!confirmed) return
    cancelForm.setData({
      order_number: activeOrder.order_number,
      customer_phone: activeOrder.customer_phone ?? "",
    })
    cancelForm.post(routeUrl("order.cancel", { order_number: activeOrder.order_number }), {
      preserveScroll: true,
      onSuccess: () => {
        // Muat ulang agar status & stok tampilan mengikuti pembatalan.
        router.reload()
      },
    })
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.post(routeUrl("order.status.lookup"), {
      preserveScroll: true,
    })
  }

  const hasBrowserOrders = has_session_orders || sessionList.length > 0
  const showLookupForm = browserHydrated && !storedLoading && !hasBrowserOrders

  return (
    <PublicLayout>
      <Head title="Pesanan">
        <meta
          name="description"
          content="Cek Status Pesanan dari perangkat ini, atau masukkan nomor pesanan beserta nomor HP checkout."
        />
      </Head>

      <section className="container-page flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
          aria-label="Kembali"
        >
          <Icon name="arrow-left" className="size-5" aria-hidden="true" />
        </button>
        <h1 className="text-base font-bold text-foreground">
          {hasBrowserOrders ? "Pesanan Anda" : "Cek pesanan"}
        </h1>
      </section>

      <section className="container-page min-w-0 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] lg:pb-8">
        {showLookupForm ? (
          <div className="grid min-w-0 gap-10 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-12">
            <form onSubmit={submit} className="surface-panel p-5 sm:p-6 lg:sticky lg:top-28">
              <h2 className="text-lg font-semibold">Cek pesanan</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Gunakan data yang sama dengan saat checkout.
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Pesanan yang berhasil ditemukan disimpan di browser ini. Gunakan browser yang sama
                untuk membukanya kembali.
              </p>
              <FormErrorSummary className="mt-4" errors={form.errors} />
              <div className="mt-6 space-y-4">
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
              </div>
              <Button type="submit" size="lg" className="mt-6 w-full" disabled={form.processing}>
                <Icon name="search" className="h-5 w-5" aria-hidden="true" />
                {form.processing ? "Mencocokkan..." : "Lihat Pesanan"}
              </Button>
            </form>

            <div>
              {pageErrors.cancel ? (
                <Alert tone="danger" title={pageErrors.cancel} className="mb-4" />
              ) : null}
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
                    Jika daftar kosong, isi formulir di samping dengan nomor pesanan dan nomor HP.
                  </p>
                </div>
              ) : order ? (
                <OrderDetail
                  order={order}
                  eyebrow="Pesanan ditemukan"
                  onCancel={cancelOrder}
                  cancelBusy={cancelForm.processing}
                />
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
              sessionList.length > 0 && "lg:grid-cols-[16rem_minmax(0,1fr)]",
            )}
          >
            {pageErrors.cancel ? (
              <Alert tone="danger" title={pageErrors.cancel} className="mb-4 lg:col-span-2" />
            ) : null}
            {sessionList.length > 0 ? (
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
              {storedLoading ? (
                <div className="flex min-h-[22rem] items-center justify-center border-y border-border py-10">
                  <p className="text-sm text-muted-foreground">Memuat pesanan yang tersimpan di browser ini...</p>
                </div>
              ) : shownOrder ? (
                <OrderDetail
                  order={shownOrder}
                  eyebrow={sessionList.length > 1 ? "Pesanan dipilih" : "Pesanan perangkat ini"}
                  onCancel={cancelOrder}
                  cancelBusy={cancelForm.processing}
                />
              ) : sessionList.length ? (
                <div className="flex min-h-[18rem] flex-col justify-center border-y border-border py-10">
                  <Icon name="clipboard-list" className="size-8 text-primary" aria-hidden="true" />
                  <h2 className="mt-4 text-xl font-semibold">Pesanan Anda</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Pilih pesanan dari daftar untuk melihat detail status pesanan dan pengirimannya.</p>
                </div>
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
