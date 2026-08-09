import { Head, Link, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TrustAssuranceCard } from "@/components/public/trust-assurance-card"
import { MobileStickyCta } from "@/components/public/mobile-sticky-cta"
import {
  WilayahSearchSelect,
  type WilayahOption,
} from "@/components/public/wilayah-search-select"
import PublicLayout from "@/layouts/public-layout"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { CheckoutDetails, SharedPageProps } from "@/types"

interface CheckoutItem {
  line_id: string
  name: string
  quantity: number
  line_total: number
  unit_price?: number
  compare_price?: number | null
  discount_percent?: number | null
  line_compare_total?: number | null
  line_discount?: number
  flash_sale?: boolean
}

const emptyDetails: CheckoutDetails = {
  name: "",
  phone: "",
  email: "",
  province: "",
  city: "",
  district: "",
  village: "",
  province_id: "",
  city_id: "",
  district_id: "",
  village_id: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  notes: "",
}

async function fetchWilayah(path: string): Promise<WilayahOption[]> {
  const response = await fetch(`/api/wilayah/${path}`, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`Wilayah ${path} gagal dimuat (${response.status})`)
  }
  const payload = (await response.json()) as { data?: WilayahOption[] }
  if (!Array.isArray(payload.data)) {
    throw new Error("Respons wilayah tidak valid")
  }
  return payload.data
}

export default function Checkout({
  items = [],
  subtotal = 0,
  compare_subtotal: _compareSubtotal = 0,
  discount_total = 0,
  voucher = null,
  voucher_discount = 0,
  cod = {
    enabled: true,
    allowed: true,
    block_reason: null,
    fee_type: "percent",
    fee_value: 0,
    fee_amount: 0,
    max_order_amount: null,
  },
  shipping = null,
  details,
  applyVoucherUrl,
  removeVoucherUrl,
}: {
  items: CheckoutItem[]
  subtotal: number
  compare_subtotal?: number
  discount_total?: number
  voucher?: { code: string; name: string; discount: number } | null
  voucher_discount?: number
  cod?: {
    enabled: boolean
    allowed: boolean
    block_reason?: string | null
    fee_type: "percent" | "fixed"
    fee_value: number
    fee_amount: number
    max_order_amount?: number | null
  }
  shipping?: {
    gross: number
    subsidy: number
    net: number
    applied: boolean
  } | null
  details?: CheckoutDetails | null
  applyVoucherUrl: string
  removeVoucherUrl: string
}) {
  const { errors: pageErrors = {} } = usePage<SharedPageProps>().props
  const [editingDetails, setEditingDetails] = React.useState(!details)
  const detailForm = useForm<CheckoutDetails>({ ...emptyDetails, ...(details ?? {}) })
  const defaultPayment = cod.enabled && cod.allowed ? "cod" : "transfer"
  const paymentForm = useForm({ payment_method: defaultPayment })
  const hasDiscount = discount_total > 0
  const hasVoucher = Boolean(voucher?.code) && voucher_discount > 0
  const showCodFee =
    paymentForm.data.payment_method === "cod" && cod.enabled && cod.allowed && cod.fee_amount > 0
  const [voucherCode, setVoucherCode] = React.useState(voucher?.code ?? "")
  const [voucherOpen, setVoucherOpen] = React.useState(hasVoucher)
  const voucherForm = useForm({ code: voucher?.code ?? "" })

  function applyVoucher(event: React.FormEvent) {
    event.preventDefault()
    const code = voucherCode.trim()
    if (!code) {
      voucherForm.setError("code", "Masukkan kode voucher terlebih dahulu.")
      return
    }
    voucherForm.setData("code", code)
    voucherForm.post(applyVoucherUrl, { preserveScroll: true })
  }

  function removeVoucher() {
    voucherForm.post(removeVoucherUrl, { preserveScroll: true })
  }

  const [provinces, setProvinces] = React.useState<WilayahOption[]>([])
  const [regencies, setRegencies] = React.useState<WilayahOption[]>([])
  const [districts, setDistricts] = React.useState<WilayahOption[]>([])
  const [villages, setVillages] = React.useState<WilayahOption[]>([])
  const [loadingProvinces, setLoadingProvinces] = React.useState(false)
  const [loadingRegencies, setLoadingRegencies] = React.useState(false)
  const [loadingDistricts, setLoadingDistricts] = React.useState(false)
  const [loadingVillages, setLoadingVillages] = React.useState(false)
  const [wilayahError, setWilayahError] = React.useState<string | null>(null)
  const [wilayahRetry, setWilayahRetry] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    // Loading flags describe the external wilayah request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingProvinces(true)
    setWilayahError(null)
    fetchWilayah("provinces")
      .then((data) => {
        if (!cancelled) setProvinces(data)
      })
      .catch(() => {
        if (!cancelled) {
          setProvinces([])
          setWilayahError("Daftar wilayah gagal dimuat. Periksa koneksi lalu coba lagi.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false)
      })
    return () => {
      cancelled = true
    }
  }, [wilayahRetry])

  React.useEffect(() => {
    const provinceId = detailForm.data.province_id
    if (!provinceId) {
      // Clear dependent choices when their parent is cleared.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRegencies([])
      return
    }
    let cancelled = false
    setLoadingRegencies(true)
    fetchWilayah(`regencies/${provinceId}`)
      .then((data) => {
        if (!cancelled) {
          setRegencies(data)
          setWilayahError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRegencies([])
          setWilayahError("Kota/kabupaten gagal dimuat. Coba pilih provinsi lagi atau muat ulang.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRegencies(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailForm.data.province_id])

  React.useEffect(() => {
    const cityId = detailForm.data.city_id
    if (!cityId) {
      // Clear dependent choices when their parent is cleared.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistricts([])
      return
    }
    let cancelled = false
    setLoadingDistricts(true)
    fetchWilayah(`districts/${cityId}`)
      .then((data) => {
        if (!cancelled) {
          setDistricts(data)
          setWilayahError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDistricts([])
          setWilayahError("Kecamatan gagal dimuat. Coba pilih kota lagi atau muat ulang.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDistricts(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailForm.data.city_id])

  React.useEffect(() => {
    const districtId = detailForm.data.district_id
    if (!districtId) {
      // Clear dependent choices when their parent is cleared.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVillages([])
      return
    }
    let cancelled = false
    setLoadingVillages(true)
    fetchWilayah(`villages/${districtId}`)
      .then((data) => {
        if (!cancelled) {
          setVillages(data)
          setWilayahError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVillages([])
          setWilayahError("Desa/kelurahan gagal dimuat. Coba pilih kecamatan lagi atau muat ulang.")
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingVillages(false)
      })
    return () => {
      cancelled = true
    }
  }, [detailForm.data.district_id])

  function selectProvince(option: WilayahOption | null) {
    detailForm.setData({
      ...detailForm.data,
      province_id: option?.id ?? "",
      province: option?.name ?? "",
      city_id: "",
      city: "",
      district_id: "",
      district: "",
      village_id: "",
      village: "",
    })
    setRegencies([])
    setDistricts([])
    setVillages([])
  }

  function selectCity(option: WilayahOption | null) {
    detailForm.setData({
      ...detailForm.data,
      city_id: option?.id ?? "",
      city: option?.name ?? "",
      district_id: "",
      district: "",
      village_id: "",
      village: "",
    })
    setDistricts([])
    setVillages([])
  }

  function selectDistrict(option: WilayahOption | null) {
    detailForm.setData({
      ...detailForm.data,
      district_id: option?.id ?? "",
      district: option?.name ?? "",
      village_id: "",
      village: "",
    })
    setVillages([])
  }

  function selectVillage(option: WilayahOption | null) {
    detailForm.setData({
      ...detailForm.data,
      village_id: option?.id ?? "",
      village: option?.name ?? "",
    })
  }

  function submitDetails(event: React.FormEvent) {
    event.preventDefault()
    detailForm.post(routeUrl("checkout.validate"), {
      preserveScroll: true,
      onSuccess: () => setEditingDetails(false),
    })
  }

  function placeOrder(event: React.FormEvent) {
    event.preventDefault()
    if (!details || paymentForm.processing) return
    paymentForm.post(routeUrl("checkout.place-order"))
  }

  const addressSummary = details
    ? [
        details.address_line1,
        details.address_line2,
        details.village,
        details.district,
        details.city,
        details.province,
        details.postal_code,
      ]
        .filter(Boolean)
        .join(", ")
    : ""

  if (!items.length) {
    return (
      <PublicLayout>
        <Head title="Checkout" />
        <section className="container-page py-4">
          <EmptyState
            icon="shopping-cart"
            title="Keranjang kosong"
            description="Tambahkan produk dan varian terlebih dahulu sebelum membuka checkout."
            action={
              <Button asChild>
                <Link href={routeUrl("catalog.index")}>Pilih model produk</Link>
              </Button>
            }
          />
        </section>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout>
      <Head title="Checkout" />

      <section className="border-b border-border bg-surface">
        <div className="container-page pb-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="caret-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Proses pesanan
            </h1>
          </div>
          <ol className="mt-4 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border">
            <li className="bg-surface p-4">
              <p className="font-mono text-[11px] text-primary">01</p>
              <p className="mt-1 text-sm font-semibold">Detail pengiriman</p>
            </li>
            <li className={cn("p-4", details ? "bg-surface" : "bg-surface-muted")}>
              <p className="font-mono text-[11px] text-primary">02</p>
              <p className="mt-1 text-sm font-semibold">Pembayaran dan konfirmasi</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="container-page py-4">
        {pageErrors.checkout ? (
          <Alert tone="danger" title={pageErrors.checkout} className="mb-4" />
        ) : null}
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <section className="surface-panel min-w-0 p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4 min-w-0">
                <div>
                  <p className="font-mono text-xs font-semibold text-primary">01</p>
                  <h2 className="mt-2 text-lg font-semibold">Detail pengiriman</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Data ini dipakai untuk pesanan, pengiriman, dan pengecekan status.
                  </p>
                </div>
                {details && !editingDetails ? (
                  <Button variant="ghost" size="sm" onClick={() => setEditingDetails(true)}>
                    Ubah
                  </Button>
                ) : null}
              </div>

              {details && !editingDetails ? (
                <dl className="mt-4 grid gap-4 rounded-md bg-surface-muted p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Pemesan</dt>
                    <dd className="mt-1 font-semibold break-words [overflow-wrap:anywhere]">{details.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Nomor HP/WhatsApp</dt>
                    <dd className="mt-1 font-semibold break-words [overflow-wrap:anywhere]">{details.phone}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Alamat</dt>
                    <dd className="mt-1 font-semibold leading-6 break-words [overflow-wrap:anywhere]">{addressSummary}</dd>
                  </div>
                </dl>
              ) : (
                <form onSubmit={submitDetails} className="mt-7 space-y-5">
                  <FormErrorSummary errors={detailForm.errors} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field id="checkout-name" label="Nama lengkap" required error={detailForm.errors.name}>
                      <Input
                        value={detailForm.data.name}
                        onChange={(event) => detailForm.setData("name", event.target.value)}
                        autoComplete="name"
                      />
                    </Field>
                    <Field
                      id="checkout-phone"
                      label="Nomor HP/WhatsApp"
                      required
                      error={detailForm.errors.phone}
                    >
                      <Input
                        type="tel"
                        value={detailForm.data.phone}
                        onChange={(event) => detailForm.setData("phone", event.target.value)}
                        autoComplete="tel"
                        inputMode="tel"
                      />
                    </Field>
                  </div>
                  <Field
                    id="checkout-email"
                    label="Email"
                    hint="Opsional. Dapat dipakai untuk mengecek status pesanan."
                    error={detailForm.errors.email}
                  >
                    <Input
                      type="email"
                      value={detailForm.data.email ?? ""}
                      onChange={(event) => detailForm.setData("email", event.target.value)}
                      autoComplete="email"
                    />
                  </Field>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {wilayahError ? (
                      <div className="sm:col-span-2">
                        <Alert tone="danger" title="Wilayah tidak tersedia">
                          <p>{wilayahError}</p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            className="mt-3"
                            onClick={() => setWilayahRetry((value) => value + 1)}
                          >
                            Muat ulang daftar wilayah
                          </Button>
                        </Alert>
                      </div>
                    ) : null}
                    <WilayahSearchSelect
                      id="checkout-province"
                      label="Provinsi"
                      options={provinces}
                      valueId={detailForm.data.province_id}
                      valueName={detailForm.data.province}
                      loading={loadingProvinces}
                      error={detailForm.errors.province ?? detailForm.errors.province_id}
                      placeholder="Pilih provinsi"
                      searchPlaceholder="Cari provinsi"
                      onSelect={selectProvince}
                    />
                    <WilayahSearchSelect
                      id="checkout-city"
                      label="Kota/Kabupaten"
                      options={regencies}
                      valueId={detailForm.data.city_id}
                      valueName={detailForm.data.city}
                      disabled={!detailForm.data.province_id}
                      loading={loadingRegencies}
                      error={detailForm.errors.city ?? detailForm.errors.city_id}
                      placeholder="Pilih Kota/Kabupaten..."
                      searchPlaceholder="Cari Kota/Kabupaten..."
                      onSelect={selectCity}
                    />
                    <WilayahSearchSelect
                      id="checkout-district"
                      label="Kecamatan"
                      options={districts}
                      valueId={detailForm.data.district_id}
                      valueName={detailForm.data.district}
                      disabled={!detailForm.data.city_id}
                      loading={loadingDistricts}
                      error={detailForm.errors.district ?? detailForm.errors.district_id}
                      placeholder="Pilih Kecamatan..."
                      searchPlaceholder="Cari Kecamatan..."
                      onSelect={selectDistrict}
                    />
                    <WilayahSearchSelect
                      id="checkout-village"
                      label="Desa/Kelurahan"
                      options={villages}
                      valueId={detailForm.data.village_id}
                      valueName={detailForm.data.village}
                      disabled={!detailForm.data.district_id}
                      loading={loadingVillages}
                      error={detailForm.errors.village ?? detailForm.errors.village_id}
                      placeholder="Pilih Desa/Kelurahan..."
                      searchPlaceholder="Cari Desa/Kelurahan..."
                      onSelect={selectVillage}
                    />
                  </div>

                  <Field
                    id="checkout-address-1"
                    label="Alamat lengkap"
                    required
                    hint="Nama jalan, nomor rumah, RT/RW."
                    error={detailForm.errors.address_line1}
                  >
                    <Textarea
                      rows={3}
                      value={detailForm.data.address_line1}
                      onChange={(event) => detailForm.setData("address_line1", event.target.value)}
                      autoComplete="street-address"
                    />
                  </Field>
                  <Field
                    id="checkout-address-2"
                    label="Patokan atau detail tambahan"
                    error={detailForm.errors.address_line2}
                  >
                    <Input
                      value={detailForm.data.address_line2 ?? ""}
                      onChange={(event) => detailForm.setData("address_line2", event.target.value)}
                    />
                  </Field>
                  <Field
                    id="checkout-postal-code"
                    label="Kode pos"
                    required
                    error={detailForm.errors.postal_code}
                  >
                    <Input
                      value={detailForm.data.postal_code}
                      onChange={(event) => detailForm.setData("postal_code", event.target.value)}
                      autoComplete="postal-code"
                      inputMode="numeric"
                      className="max-w-48 rounded-md"
                    />
                  </Field>
                  <Field id="checkout-notes" label="Catatan pesanan" error={detailForm.errors.notes}>
                    <Textarea
                      value={detailForm.data.notes ?? ""}
                      onChange={(event) => detailForm.setData("notes", event.target.value)}
                      placeholder="Contoh: waktu penerimaan atau catatan akses lokasi"
                    />
                  </Field>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
                    {details ? (
                      <Button variant="ghost" onClick={() => setEditingDetails(false)}>
                        Batal
                      </Button>
                    ) : null}
                    <Button type="submit" disabled={detailForm.processing}>
                      {detailForm.processing ? "Memvalidasi..." : "Lanjut ke pembayaran"}
                    </Button>
                  </div>
                </form>
              )}
            </section>

            <section
              className={cn(
                "surface-panel min-w-0 p-5 sm:p-7",
                !details && "pointer-events-none opacity-55",
              )}
              aria-disabled={!details}
            >
              <p className="font-mono text-xs font-semibold text-primary">02</p>
              <h2 className="mt-2 text-lg font-semibold">Metode pembayaran</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Pilih metode yang akan dicatat pada pesanan.
              </p>
              <form onSubmit={placeOrder} className="mt-4">
                <fieldset disabled={!details || paymentForm.processing}>
                  <legend className="sr-only">Metode pembayaran</legend>
                  <div className="grid gap-3">
                    {(
                      [
                        [
                          "cod",
                          "Bayar di tempat (COD)",
                          cod.enabled && cod.allowed
                            ? cod.fee_amount > 0
                              ? `Termasuk biaya penanganan ${formatCurrency(cod.fee_amount)}.`
                              : "Pembayaran dicatat menunggu saat pesanan dibuat."
                            : cod.block_reason || "Layanan COD sedang tidak tersedia.",
                          cod.enabled && cod.allowed,
                        ],
                        [
                          "transfer",
                          "Transfer bank",
                          "Instruksi lanjutan mengikuti konfirmasi pesanan.",
                          true,
                        ],
                      ] as const
                    ).map(([value, label, description, allowed]) => (
                      <label
                        key={value}
                        className={cn(
                          "flex gap-4 rounded-lg border p-4 transition",
                          allowed ? "cursor-pointer" : "cursor-not-allowed opacity-55",
                          paymentForm.data.payment_method === value
                            ? "border-primary bg-primary/5"
                            : "border-border bg-surface hover:bg-accent",
                        )}
                      >
                        <input
                          type="radio"
                          name="payment_method"
                          value={value}
                          checked={paymentForm.data.payment_method === value}
                          disabled={!allowed}
                          onChange={() => paymentForm.setData("payment_method", value)}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{label}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted-foreground break-words">
                            {description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {pageErrors.payment_method ? (
                    <p className="mt-3 text-xs font-medium text-destructive">{pageErrors.payment_method}</p>
                  ) : null}
                </fieldset>
                {paymentForm.errors.payment_method ? (
                  <p className="mt-3 text-xs font-medium text-destructive">
                    {paymentForm.errors.payment_method}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  size="lg"
                  className="mt-4 hidden h-12 w-full lg:inline-flex"
                  disabled={!details || editingDetails || paymentForm.processing}
                >
                  {paymentForm.processing ? "Membuat pesanan..." : "Buat pesanan"}
                  <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
                </Button>

                <MobileStickyCta aria-label="Buat pesanan" spacerClassName="h-[4.5rem]">
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 min-h-11 w-full"
                    disabled={!details || editingDetails || paymentForm.processing}
                  >
                    {paymentForm.processing ? "Membuat pesanan..." : "Buat pesanan"}
                    <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </MobileStickyCta>
              </form>
            </section>
          </div>

          <aside className="surface-panel min-w-0 p-5 lg:sticky lg:top-28">
            <h2 className="text-lg font-semibold">Ringkasan pesanan</h2>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {items.map((item) => {
                const lineTotal = Number(item.line_total ?? 0)
                const lineDiscount = Number(item.line_discount ?? 0)
                const comparePrice =
                  item.compare_price == null ? null : Number(item.compare_price)
                const hasLineDiscount =
                  lineDiscount > 0 ||
                  (comparePrice !== null && comparePrice > Number(item.unit_price ?? 0))
                const lineCompare =
                  item.line_compare_total != null
                    ? Number(item.line_compare_total)
                    : hasLineDiscount && comparePrice != null
                      ? comparePrice * item.quantity
                      : null
                const discountPercent = item.discount_percent

                return (
                  <li key={item.line_id} className="flex justify-between gap-4 py-3 text-xs">
                    <span className="min-w-0">
                      <span className="font-semibold leading-5 break-words [overflow-wrap:anywhere]">{item.name}</span>
                      <span className="tabular-nums mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{item.quantity} item</span>
                        {item.flash_sale ? (
                          <span className="font-extrabold italic tracking-tight text-sale">
                            FLASH SALE
                          </span>
                        ) : null}
                        {discountPercent ? (
                          <span className="rounded bg-accent px-1.5 text-xs font-semibold leading-5 text-accent-foreground">
                            −{discountPercent}%
                          </span>
                        ) : null}
                      </span>
                      {hasLineDiscount ? (
                        <span className="mt-1 block text-xs font-semibold text-sale">
                          Hemat {formatCurrency(lineDiscount)}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      {hasLineDiscount && lineCompare != null ? (
                        <span className="tabular-nums block text-xs text-muted-foreground line-through">
                          {formatCurrency(lineCompare)}
                        </span>
                      ) : null}
                      <span
                        className={
                          hasLineDiscount
                            ? "tabular-nums block font-bold text-sale"
                            : "tabular-nums block font-semibold"
                        }
                      >
                        {formatCurrency(lineTotal)}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 border-t border-border pt-4">
              {hasVoucher ? (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-2 text-sm font-semibold">
                        <Icon name="ticket" className="size-4 shrink-0 text-primary" weight="bold" aria-hidden="true" />
                        Voucher {voucher?.code}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{voucher?.name}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-destructive hover:underline"
                      onClick={removeVoucher}
                      disabled={voucherForm.processing}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ) : !voucherOpen ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary/80"
                  onClick={() => setVoucherOpen(true)}
                >
                  <Icon name="ticket" className="size-4 shrink-0" weight="bold" aria-hidden="true" />
                  Masukkan voucher
                </button>
              ) : (
                <form onSubmit={applyVoucher} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="checkout-voucher"
                      className="inline-flex items-center gap-2 text-sm font-medium text-foreground"
                    >
                      <Icon name="ticket" className="size-4 shrink-0 text-primary" weight="bold" aria-hidden="true" />
                      Masukkan voucher
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setVoucherOpen(false)
                        setVoucherCode("")
                        voucherForm.clearErrors()
                      }}
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="checkout-voucher"
                      value={voucherCode}
                      onChange={(event) => {
                        setVoucherCode(event.target.value.toUpperCase())
                        voucherForm.clearErrors("code")
                      }}
                      placeholder="Kode voucher"
                      autoComplete="off"
                      autoFocus
                      className="min-w-0 flex-1 font-mono uppercase"
                    />
                    <Button type="submit" className="shrink-0" disabled={voucherForm.processing}>
                      {voucherForm.processing ? "..." : "Pakai"}
                    </Button>
                  </div>
                  {voucherForm.errors.code || pageErrors.voucher ? (
                    <p className="text-xs font-medium text-destructive">
                      {voucherForm.errors.code || pageErrors.voucher}
                    </p>
                  ) : null}
                </form>
              )}
            </div>

            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground min-w-0 break-words">Subtotal</dt>
                <dd className="tabular-nums font-semibold">{formatCurrency(subtotal)}</dd>
              </div>
              {hasDiscount ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Potongan harga</dt>
                  <dd className="tabular-nums font-semibold text-sale">
                    −{formatCurrency(discount_total)}
                  </dd>
                </div>
              ) : null}
              {hasVoucher ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Voucher ({voucher?.code})</dt>
                  <dd className="tabular-nums font-semibold text-sale">
                    −{formatCurrency(voucher_discount)}
                  </dd>
                </div>
              ) : null}
              {showCodFee ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Biaya COD</dt>
                  <dd className="tabular-nums font-semibold">{formatCurrency(cod.fee_amount)}</dd>
                </div>
              ) : null}
              {shipping ? (
                <>
                  {shipping.applied && shipping.subsidy > 0 ? (
                    <>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground min-w-0 break-words">Ongkir (tarif kurir)</dt>
                        <dd className="tabular-nums font-semibold">{formatCurrency(shipping.gross)}</dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground min-w-0 break-words">Subsidi ongkir</dt>
                        <dd className="tabular-nums font-semibold text-sale">
                          −{formatCurrency(shipping.subsidy)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground min-w-0 break-words">Ongkir dibayar</dt>
                        <dd className="tabular-nums font-semibold">{formatCurrency(shipping.net)}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground min-w-0 break-words">Pengiriman</dt>
                      <dd className="tabular-nums font-semibold">{formatCurrency(shipping.net)}</dd>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground min-w-0 break-words">Pengiriman</dt>
                  <dd className="text-right font-semibold shrink-0">Dihitung dari alamat</dd>
                </div>
              )}
            </dl>

            <TrustAssuranceCard className="mt-4" />
            <Alert tone="info" className="mt-4">
              Total akhir dan nomor pesanan ditampilkan setelah konfirmasi berhasil.
            </Alert>
          </aside>
        </div>
      </section>
    </PublicLayout>
  )
}
