import { useForm } from "@inertiajs/react"
import * as React from "react"

import type { WilayahOption } from "@/components/public/wilayah-search-select"
import { routeUrl } from "@/lib/routes"
import type { CheckoutDetails } from "@/types"

export interface CheckoutCodConfig {
  enabled: boolean
  allowed: boolean
  block_reason?: string | null
  fee_type: "percent" | "fixed"
  fee_value: number
  fee_amount: number
  max_order_amount?: number | null
}

export interface CheckoutVoucher {
  code: string
  name: string
  discount: number
}

export interface UseCheckoutOptions {
  details?: CheckoutDetails | null
  cod?: CheckoutCodConfig
  defaultPayment?: string | null
  voucher?: CheckoutVoucher | null
  voucherDiscount?: number
  applyVoucherUrl: string
  removeVoucherUrl: string
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
  applyVoucherUrl,
  removeVoucherUrl,
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
  const [mapPickerOpen, setMapPickerOpen] = React.useState(false)

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
