import { Head, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { OrderTrackingDetail } from "@/components/public/order-tracking-detail"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { EmptyState } from "@/components/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrder, SharedPageProps } from "@/types"

const TERMINAL_STATUSES = new Set(["completed", "cancelled", "return_completed"])
const ORDER_STATUS_STORAGE_KEY = "ragil.order-status.v1"
const MAX_STORED_ORDER_REFS = 5

type StoredOrderRef = {
  order_number: string
  customer_phone?: string
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
        && row.order_number.trim() !== ""
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
  customerPhone?: string,
): Promise<PublicOrder | null> {
  const url = new URL(
    routeUrl("order.status.api", { order_number: ref.order_number }),
    window.location.origin,
  )
  if (customerPhone) {
    url.searchParams.set("customer_phone", customerPhone)
  }
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
  })
  if (!response.ok) return null
  return await response.json() as PublicOrder
}

function OrderDetail({ order }: { order: PublicOrder }) {
  return (
    <OrderTrackingDetail order={order} />
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
  // Feedback polling: idle | updating | error + timestamp terakhir berhasil.
  const [pollState, setPollState] = React.useState<"idle" | "updating" | "error">("idle")
  const [lastPolledAt, setLastPolledAt] = React.useState<Date | null>(null)
  // Ref agar tombol Muat Ulang manual dapat memicu satu siklus polling tanpa reload halaman.
  const pollRef = React.useRef<null | (() => void)>(null)
  function requestRefresh(): void {
    pollRef.current?.()
  }

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
          if (!ref.customer_phone) continue
          const row = await fetchStoredOrder(ref, controller.signal, ref.customer_phone)
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
      if (row.order_number) {
        mergeStoredRef({ order_number: row.order_number, customer_phone: row.customer_phone ?? undefined })
      }
    }
  }, [serverOrders])

  const activeOrder = React.useMemo(
    () => sessionList.find((row) => row.order_number === activeNumber) ?? sessionList[0] ?? null,
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
      setPollState("updating")

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
          setPollState("error")
          return
        }

        const fresh = await response.json() as PublicOrder
        if (disposed) return
        failures = 0
        setLiveOrder(fresh)
        setLastPolledAt(new Date())
        setPollState("idle")
        setStoredOrders((current) => current.map((row) =>
          row.order_number === fresh.order_number ? fresh : row,
        ))
        if (TERMINAL_STATUSES.has(fresh.order_status)) {
          stopPolling()
        }
      } catch {
        failures += 1
        setPollState("error")
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
    pollRef.current = poll
    schedule(30_000)

    return () => {
      pollRef.current = null
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
  const hashTarget = typeof window !== "undefined" && window.location.hash === "#lacak-pengiriman"
  React.useEffect(() => {
    if (!hashTarget) return
    if (!browserHydrated || storedLoading) return
    // Scroll hanya setelah konten (order / panduan) benar-benar dirender.
    const t = window.setTimeout(() => {
      document.getElementById("lacak-pengiriman")?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)
    return () => window.clearTimeout(t)
  }, [hashTarget, browserHydrated, storedLoading, shownOrder])

  const showLookupForm = browserHydrated && !storedLoading && !hasBrowserOrders

  return (
    <PublicLayout>
      <Head title="Pesanan">
        <meta
          name="description"
          content="Cek Status Pesanan dari perangkat ini, atau masukkan nomor pesanan beserta nomor HP checkout."
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs items={[{ label: "Beranda", href: routeUrl("home") }, { label: "Cek Status Pesanan" }]} />
        </div>
        <div className="container-page flex items-center gap-2 py-2 !px-2.5 md:!px-8 lg:!px-12">
          <button
          type="button"
          onClick={() => window.history.back()}
          className="-ml-2 flex size-11 shrink-0 items-center justify-center lg:hidden"
          aria-label="Kembali"
        >
          <Icon name="arrow-left" className="size-5" aria-hidden="true" />
        </button>
        <h1 className="text-base font-bold text-foreground">Cek Status Pesanan</h1>
        </div>
      </section>

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 min-w-0 pt-4 pb-[calc(var(--mobile-bottom-nav-height)+1rem)] lg:pt-6 lg:pb-10">
        {showLookupForm ? (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-stretch lg:gap-8">
            <form onSubmit={submit} className="surface-panel p-5 sm:p-6 lg:sticky lg:top-28 lg:self-start lg:p-7">
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
                <div className="surface-panel flex flex-col p-5 sm:p-6 lg:h-full lg:p-8">
                  <div className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface-muted text-primary">
                      <Icon name="clipboard-list" className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold sm:text-2xl">Cek pesanan Anda</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Setelah checkout di perangkat yang sama, pesanan biasanya tampil otomatis.
                      </p>
                    </div>
                  </div>

                  <div className="my-auto grid gap-8 pt-8 sm:grid-cols-3 sm:gap-6 lg:gap-8">
                    {[
                      ["1", "Checkout", "Lakukan checkout seperti biasa melalui keranjang."],
                      ["2", "Siapkan data", "Catat nomor pesanan & nomor HP yang dipakai saat checkout."],
                      ["3", "Cek status", "Isi formulir di samping, lalu lihat status pesanan Anda."],
                    ].map(([step, title, text], i, arr) => (
                      <li key={step} className="relative flex flex-col gap-3 pl-14 sm:pl-0">
                        {i < arr.length - 1 ? (
                          <span
                            aria-hidden="true"
                            className="absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] border-t border-dashed border-border sm:block"
                          />
                        ) : null}
                        <span className="absolute left-0 top-0 flex size-10 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                          {step}
                        </span>
                        <div className="sm:pt-12">
                          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
                        </div>
                      </li>
                    ))}
                  </div>
                </div>
              ) : order ? (
                <OrderDetail
                  order={order}
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
              "grid gap-6 lg:items-start lg:gap-8",
              sessionList.length > 1 && "lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]",
            )}
          >
            {pageErrors.cancel ? (
              <Alert tone="danger" title={pageErrors.cancel} className="mb-4 lg:col-span-2" />
            ) : null}


            {sessionList.length > 1 ? (
              <nav aria-label="Pesanan tersimpan" className="surface-panel p-3 lg:sticky lg:top-28">
                <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">Pesanan tersimpan</p>
                <ul className="grid gap-1">
                  {sessionList.map((row) => {
                    const activeRow = shownOrder?.order_number === row.order_number
                    return (
                      <li key={row.order_number}>
                        <button
                          type="button"
                          onClick={() => setActiveNumber(row.order_number)}
                          aria-current={activeRow ? "true" : undefined}
                          className={cn(
                            "flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 text-sm transition",
                            activeRow
                              ? "bg-accent/60 font-semibold text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                        >
                          <span className="truncate font-mono text-xs">{row.order_number}</span>
                          {activeRow ? (
                            <Icon name="check" className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            ) : null}

            <div className="min-w-0">
              {storedLoading ? (
                <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-lg border border-border py-10 text-center">
                  <Icon name="dots-three" className="size-6 animate-pulse text-primary" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">Memuat pesanan yang tersimpan di browser ini...</p>
                </div>
              ) : shownOrder ? (
                <>
                  <div role="status" aria-live="polite" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {pollState === "updating" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="dots-three" className="size-3.5 animate-pulse" aria-hidden="true" />
                        Memperbarui...
                      </span>
                    ) : null}
                    {lastPolledAt ? (
                      <span>
                        Terakhir diperbarui:{" "}
                        {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(lastPolledAt)}{" "}
                        WIB
                      </span>
                    ) : null}
                    {pollState === "error" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1 font-medium text-destructive">
                        Koneksi bermasalah. Data mungkin belum terbarui.
                        <button
                          type="button"
                          className="ml-1 font-bold underline underline-offset-2"
                          onClick={requestRefresh}
                        >
                          Muat Ulang
                        </button>
                      </span>
                    ) : null}
                  </div>
                  <OrderDetail
                    order={shownOrder}
                  />
                </>
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
