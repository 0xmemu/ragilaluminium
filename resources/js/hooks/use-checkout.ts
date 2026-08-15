import { useForm } from "@inertiajs/react"
import * as React from "react"

import type { WilayahOption } from "@/components/public/wilayah-search-select"
import { routeUrl } from "@/lib/routes"
import type { CheckoutDetails } from "@/types"

export interface CheckoutCodConfig {
  enabled: boolean
  allowed: boolean
  block_reason?: string | null
  fee_type: "percent"
  fee_value: number
  fee_amount: number
  max_order_amount?: number | null
}

export interface CheckoutVoucher {
  code: string
  name: string
  discount: number
  stackable?: boolean
  vouchers?: Array<{ code: string; name: string; discount: number; stackable?: boolean }>
}

export interface CheckoutShippingQuote {
  gross: number
  subsidy: number
  net: number
  applied: boolean
  status: string
  provisional: boolean
  message?: string | null
}

export interface UseCheckoutOptions {
  details?: CheckoutDetails | null
  cod?: CheckoutCodConfig
  defaultPayment?: string | null
  voucher?: CheckoutVoucher | null
  voucherDiscount?: number
  applyVoucherUrl?: string | null
  removeVoucherUrl?: string | null
  shippingQuoteUrl?: string | null
  shippingWeightKg?: number
}

const emptyDetails: CheckoutDetails = {
  name: "",
  phone: "",
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
}

export async function fetchWilayah(path: string, signal?: AbortSignal): Promise<WilayahOption[]> {
  const response = await fetch(`/api/wilayah/${path}`, {
    headers: { Accept: "application/json" },
    signal,
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

/**
 * Seluruh state & aksi halaman checkout: form detail pengiriman, metode bayar,
 * voucher, daftar wilayah (provinsi→kecamatan, fetch + abort), map picker, dan
 * submit (validasi detail → buat pesanan). Section hanya menerima hasil hook (§5 R).
 */
export function useCheckout({
  details = null,
  cod = {
    enabled: true,
    allowed: true,
    block_reason: null,
    fee_type: "percent",
    fee_value: 0,
    fee_amount: 0,
    max_order_amount: null,
  },
  defaultPayment = null,
  voucher = null,
  voucherDiscount = 0,
  applyVoucherUrl = routeUrl("checkout.voucher.apply"),
  removeVoucherUrl = routeUrl("checkout.voucher.remove"),
  shippingQuoteUrl = null,
  shippingWeightKg = 1,
}: UseCheckoutOptions) {
  const [editingDetails, setEditingDetails] = React.useState(!details)
  const detailForm = useForm<CheckoutDetails>({ ...emptyDetails, ...(details ?? {}) })
  const paymentDefault =
    defaultPayment ?? (cod.enabled && cod.allowed ? "cod" : "transfer")
  const paymentForm = useForm({ payment_method: paymentDefault })
  const hasVoucher = Boolean(voucher?.code) && voucherDiscount > 0
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
    voucherForm.post(applyVoucherUrl || routeUrl("checkout.voucher.apply"), { preserveScroll: true })
  }

  function removeVoucher(code?: string) {
    voucherForm.setData("code", code ?? "")
    voucherForm.post(removeVoucherUrl || routeUrl("checkout.voucher.remove"), { preserveScroll: true })
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
  const [mapPickerOpen, setMapPickerOpen] = React.useState(false)
  const [shippingQuote, setShippingQuote] = React.useState<CheckoutShippingQuote | null>(null)
  const [shippingQuoteLoading, setShippingQuoteLoading] = React.useState(false)
  const [shippingQuoteAttempted, setShippingQuoteAttempted] = React.useState(false)
  const shippingQuoteAbortRef = React.useRef<AbortController | null>(null)

  function applyPickedLocation(picked: {
    display_name: string
    postcode?: string
    province?: string
    city?: string
    district?: string
    village?: string
    province_id?: string
    city_id?: string
    district_id?: string
    village_id?: string
  }) {
    detailForm.setData((current) => ({
      ...current,
      province: picked.province ?? current.province,
      city: picked.city ?? current.city,
      district: picked.district ?? current.district,
      village: picked.village ?? current.village,
      province_id: picked.province_id ?? "",
      city_id: picked.city_id ?? "",
      district_id: picked.district_id ?? "",
      village_id: picked.village_id ?? "",
      postal_code: picked.postcode ?? current.postal_code,
    }))
  }

  React.useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    // Loading flags describe the external wilayah request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingProvinces(true)
    setWilayahError(null)
    fetchWilayah("provinces", controller.signal)
      .then((data) => {
        if (!cancelled) setProvinces(data)
      })
      .catch((error) => {
        if (cancelled || (error as Error)?.name === "AbortError") return
        setProvinces([])
        setWilayahError("Daftar wilayah gagal dimuat. Periksa koneksi lalu coba lagi.")
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false)
      })
    return () => {
      cancelled = true
      controller.abort()
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
    const controller = new AbortController()
    setLoadingRegencies(true)
    fetchWilayah(`regencies/${provinceId}`, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setRegencies(data)
          setWilayahError(null)
        }
      })
      .catch((error) => {
        if (cancelled || (error as Error)?.name === "AbortError") return
        setRegencies([])
        setWilayahError("Kota/kabupaten gagal dimuat. Coba pilih provinsi lagi atau muat ulang.")
      })
      .finally(() => {
        if (!cancelled) setLoadingRegencies(false)
      })
    return () => {
      cancelled = true
      controller.abort()
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
    const controller = new AbortController()
    setLoadingDistricts(true)
    fetchWilayah(`districts/${cityId}`, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setDistricts(data)
          setWilayahError(null)
        }
      })
      .catch((error) => {
        if (cancelled || (error as Error)?.name === "AbortError") return
        setDistricts([])
        setWilayahError("Kecamatan gagal dimuat. Coba pilih kota lagi atau muat ulang.")
      })
      .finally(() => {
        if (!cancelled) setLoadingDistricts(false)
      })
    return () => {
      cancelled = true
      controller.abort()
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
    const controller = new AbortController()
    setLoadingVillages(true)
    fetchWilayah(`villages/${districtId}`, controller.signal)
      .then((data) => {
        if (!cancelled) {
          setVillages(data)
          setWilayahError(null)
        }
      })
      .catch((error) => {
        if (cancelled || (error as Error)?.name === "AbortError") return
        setVillages([])
        setWilayahError("Desa/kelurahan gagal dimuat. Coba pilih kecamatan lagi atau muat ulang.")
      })
      .finally(() => {
        if (!cancelled) setLoadingVillages(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [detailForm.data.district_id])

  React.useEffect(() => {
    const data = detailForm.data
    const complete = Boolean(
      data.province_id &&
        data.city_id &&
        data.district_id &&
        data.village_id &&
        data.postal_code &&
        data.address_line1?.trim(),
    )
    let timer: ReturnType<typeof setTimeout> | null = null
    shippingQuoteAbortRef.current?.abort()

    if (!complete) {
      // Quote state follows address completeness; this reset is intentional.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShippingQuote(null)
      setShippingQuoteLoading(false)
      setShippingQuoteAttempted(false)
      return () => {
        if (timer) clearTimeout(timer)
      }
    }

    const controller = new AbortController()
    shippingQuoteAbortRef.current = controller
    setShippingQuoteAttempted(true)
    setShippingQuoteLoading(true)
    timer = setTimeout(async () => {
      try {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? ""
        const response = await fetch(
          shippingQuoteUrl || routeUrl("shipping.quote", undefined, "/api/shipping/quote"),
          {
            method: "POST",
            credentials: "same-origin",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
              ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
            },
            body: JSON.stringify({
              weight_kg: shippingWeightKg,
              destination_city: data.city,
              destination_province: data.province,
              destination_area: data.district,
              village_id: data.village_id,
              village_name: data.village,
              district_id: data.district_id,
              district_name: data.district,
              province_id: data.province_id,
              province: data.province,
              city_id: data.city_id,
              city: data.city,
              district: data.district,
              village: data.village,
              postal_code: data.postal_code,
              address_line1: data.address_line1,
            }),
          },
        )
        if (!response.ok) {
          setShippingQuote(null)
          return
        }
        const payload = (await response.json()) as Record<string, unknown>
        const source = (payload.data ?? payload.quote ?? payload.shipping_quote ?? payload.shipping ?? payload) as Record<string, unknown>
        const status = String(source.status ?? source.state ?? "confirmed")
        const provisional = Boolean(
          source.provisional ??
            source.is_provisional ??
            source.manual_review ??
            ["provisional", "manual_review", "estimate", "fallback"].includes(status.toLowerCase()),
        )
        const number = (value: unknown) => {
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : null
        }
        if (provisional) {
          setShippingQuote({
            gross: 9999,
            subsidy: 0,
            net: 9999,
            applied: false,
            status,
            provisional: true,
            message: typeof source.message === "string" ? source.message : null,
          })
          return
        }
        const net = number(source.net ?? source.shipping_amount ?? source.amount ?? source.cost ?? source.total)
        if (net === null) {
          setShippingQuote(null)
          return
        }
        const gross = number(source.gross ?? source.original ?? source.base) ?? net
        const subsidy = number(source.subsidy ?? source.discount) ?? Math.max(0, gross - net)
        setShippingQuote({
          gross,
          subsidy,
          net,
          applied: Boolean(source.applied),
          status,
          provisional: false,
          message: typeof source.message === "string" ? source.message : null,
        })
      } catch (error) {
        if ((error as Error)?.name !== "AbortError") setShippingQuote(null)
      } finally {
        if (!controller.signal.aborted) setShippingQuoteLoading(false)
      }
    }, 350)

    return () => {
      if (timer) clearTimeout(timer)
      controller.abort()
      if (shippingQuoteAbortRef.current === controller) shippingQuoteAbortRef.current = null
    }
  }, [
    detailForm.data.address_line1,
    detailForm.data.city,
    detailForm.data.city_id,
    detailForm.data.district,
    detailForm.data.district_id,
    detailForm.data.postal_code,
    detailForm.data.province,
    detailForm.data.province_id,
    detailForm.data.village,
    detailForm.data.village_id,
    detailForm.data,
    shippingQuoteUrl,
    shippingWeightKg,
  ])

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
      postal_code: "",
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
      postal_code: "",
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
      postal_code: "",
    })
    setVillages([])
  }

  function selectVillage(option: WilayahOption | null) {
    detailForm.setData({
      ...detailForm.data,
      village_id: option?.id ?? "",
      village: option?.name ?? "",
      postal_code: option?.postal_code ?? option?.postcode ?? "",
    })
  }

  function submitDetails(event: React.FormEvent) {
    event.preventDefault()
    // Bawa metode pembayaran yang sedang dipilih agar tersimpan saat redirect balik.
    detailForm.transform((data) => ({
      ...data,
      payment_method: paymentForm.data.payment_method,
    }))
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

  return {
    editingDetails,
    setEditingDetails,
    detailForm,
    paymentForm,
    hasVoucher,
    showCodFee,
    voucherCode,
    setVoucherCode,
    voucherOpen,
    setVoucherOpen,
    voucherForm,
    applyVoucher,
    removeVoucher,
    provinces,
    regencies,
    districts,
    villages,
    loadingProvinces,
    loadingRegencies,
    loadingDistricts,
    loadingVillages,
    wilayahError,
    setWilayahRetry,
    mapPickerOpen,
    setMapPickerOpen,
    shippingQuote,
    shippingQuoteLoading,
    shippingQuoteAttempted,
    applyPickedLocation,
    selectProvince,
    selectCity,
    selectDistrict,
    selectVillage,
    submitDetails,
    placeOrder,
    addressSummary,
  }
}

export type CheckoutController = ReturnType<typeof useCheckout>
