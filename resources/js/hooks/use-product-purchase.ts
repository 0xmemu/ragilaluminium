import { useForm } from "@inertiajs/react"
import * as React from "react"

import { dispatchCartFly } from "@/lib/cart-events"
import { productName } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import {
  firstAvailableSelections,
  resolveVariant,
  variantAxes,
  variantPairs,
  type VariantSelections,
} from "@/lib/variants"
import type {
  ProductAttribute,
  ProductDetailData,
  ProductMedia,
  ProductPromoMetadata,
  ProductVariant,
  Testimonial,
} from "@/types"

export interface UseProductPurchaseOptions {
  product: ProductDetailData
  attributes: ProductAttribute[]
  variants: ProductVariant[]
  media: ProductMedia[]
  reviews: Testimonial[]
  promo?: ProductPromoMetadata | null
}

/**
 * State & aksi untuk blok beli di ProductDetail: pemilihan varian, media yang
 * cocok, form cart (keranjang / beli sekarang), dan nilai turunan harga/rating.
 * Dipisah dari JSX supaya page tipis dan section hanya menerima props (§5 R).
 */
export function useProductPurchase({
  product,
  attributes: _attributes = [],
  variants = [],
  media = [],
  reviews = [],
  promo = null,
}: UseProductPurchaseOptions) {
  const title = productName(product.name, product.short_name)
  const axes = React.useMemo(
    () => variantAxes(variants),
    [variants],
  )
  const initialSelections = React.useMemo(() => {
    const fromUrl = typeof window !== "undefined"
      ? new URL(window.location.href).searchParams.get("variant")
      : null
    if (fromUrl && variants.length) {
      const match = variants.find((v) => v.variant_sku === fromUrl)
      if (match) {
        const sel: VariantSelections = {}
        for (const [axisName, option] of variantPairs(match)) {
          sel[axisName] = option
        }
        const axes = variantAxes(variants)
        if (Object.keys(sel).length === axes.length) return sel
      }
    }
    return firstAvailableSelections(variants)
  }, [variants])
  const [selections, setSelections] = React.useState<VariantSelections>(initialSelections)
  const [variantError, setVariantError] = React.useState(false)
  const variantSectionRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // Variant choices are server-derived when the product changes through Inertia.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelections(initialSelections)
  }, [initialSelections])

  const selectedVariant = React.useMemo(
    () =>
      resolveVariant(variants, selections) ??
      (axes.length === 0 ? variants[0] ?? null : null),
    [axes.length, selections, variants],
  )

  const variantMedia = React.useMemo(() => {
    // Kumpulkan seluruh variant id yang cocok dengan pilihan saat ini (parsial pun oke).
    const filledSelections = Object.entries(selections).filter(
      ([, v]) => v !== undefined && v !== "",
    )

    if (filledSelections.length === 0) return media

    const matchingVariantIds = new Set<number>()
    variants.forEach((v) => {
      const pairs = new Map(variantPairs(v))
      const match = filledSelections.every(([axisName, axisOption]) => {
        const pairOption = pairs.get(axisName)
        // Cocokkan juga dimensi
        if (axisName === "Ukuran") {
          return v.dimension_compact === axisOption || v.dimension_label === axisOption
        }
        return pairOption === axisOption
      })
      if (match) matchingVariantIds.add(v.id)
    })

    if (matchingVariantIds.size === 0) return media

    // Desain owner (09-05): galeri TETAP urut stabil (foto level produk +
    // foto opsi di posisi aslinya), TIDAK diubah-ubah saat varian diganti.
    // Varian hanya menentukan foto mana yang DITONJOLKAN (lihat
    // highlightedMediaId di bawah), bukan urutan strip.
    return media
  }, [media, selections, variants])

  // Desain owner (09-05, final): "berpindah tergantung klik". Foto berganti
  // SAAT opsi varian diklik, jika opsi itu punya foto khusus - agnostik axis
  // (Warna, Kaca, atau axis baru). Target fotonya adalah foto milik varian
  // yang paling mewakili pilihan saat ini:
  // 1. Kombinasi pilihan sudah lengkap dan varian itu ada fotonya -> foto
  //    varian tersebut (Serat Kayu + klik Kaca Bening -> foto Serat Kayu,
  //    BUKAN foto Putih yang kebetulan juga Bening).
  // 2. Belum lengkap -> foto varian pertama yang memuat opsi yang baru
  //    diklik (klik Warna saat Kaca belum dipilih, atau klik Kaca saat Warna
  //    belum dipilih).
  // 3. Osi yang diklik tidak punya foto khusus sama sekali -> null, galeri
  //    tetap di posisi sekarang (tidak melompat).
  const [lastPickedOption, setLastPickedOption] = React.useState<{
    axis: string
    option: string
  } | null>(null)

  const highlightedMediaId = React.useMemo(() => {
    if (!lastPickedOption) return null
    const mediaOf = (variantId: number) =>
      media.find((item) => Number(item.product_variant_id) === variantId)
    // 1. Kombinasi lengkap: foto varian hasil kombinasi pilihan saat ini.
    //    Kecuali opsi yang BARU diklik punya foto sendiri (kontrak "tergantung
    //    klik": klik Kaca Bening saat Serat Kayu aktif tetap menonjolkan foto
    //    Serat Kayu jika kombinasi Serat+Bening tidak punya foto spesifik -
    //    tapi jika kombinasi lengkap punya foto miliknya, kombinasi menang).
    const exact = resolveVariant(variants, selections)
    if (exact) {
      const m = mediaOf(exact.id)
      if (m) return m.id
      // Kombinasi lengkap tapi tanpa foto: turun ke foto opsi yang diklik.
      const hit = media.find((item) => {
        const vid = Number(item.product_variant_id)
        if (!vid) return false
        const owner = variants.find((v) => v.id === vid)
        if (!owner) return false
        const pairs = new Map(variantPairs(owner))
        return pairs.get(lastPickedOption.axis) === lastPickedOption.option
      })
      return hit ? hit.id : null
    }
    // 2. Parsial: foto varian pertama yang memuat opsi yang baru diklik.
    const hit = media.find((item) => {
      const vid = Number(item.product_variant_id)
      if (!vid) return false
      const owner = variants.find((v) => v.id === vid)
      if (!owner) return false
      const pairs = new Map(variantPairs(owner))
      return pairs.get(lastPickedOption.axis) === lastPickedOption.option
    })
    return hit ? hit.id : null
  }, [lastPickedOption, selections, media, variants])

  const form = useForm({
    parent_sku: product.parent_sku,
    intent: "cart",
    variant_sku: selectedVariant?.variant_sku ?? "",
    quantity: 1,
  })
  const [submitIntent, setSubmitIntent] = React.useState<"cart" | "checkout" | null>(null)

  React.useEffect(() => {
    form.setData("variant_sku", selectedVariant?.variant_sku ?? "")
    form.setData("quantity", 1)
    form.clearErrors()
    // `useForm` returns a new facade on every render; variant SKU is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant?.variant_sku])

  function chooseAxis(axisName: string, option: string) {
    setVariantError(false)
    setLastPickedOption({ axis: axisName, option })
    const nextSelections = { ...selections, [axisName]: option }
    const nextVariant = resolveVariant(variants, nextSelections)

    setSelections(nextSelections)
    form.setData("variant_sku", nextVariant?.variant_sku ?? "")
    form.setData("quantity", 1)
    form.clearErrors()
    // URL diselaraskan di ProductDetail (satu sumber), bukan di sini.
  }

  function requestVariant() {
    setVariantError(true)
    variantSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function addToCart(event: React.FormEvent, activeMedia: ProductMedia | null) {
    event.preventDefault()
    if (!selectedVariant) {
      requestVariant()
      return
    }
    if (selectedVariant.stock < 1) return

    const button =
      (event.currentTarget as HTMLElement).querySelector<HTMLElement>('button[type="submit"]')

    setSubmitIntent("cart")
    form.post(routeUrl("cart.add"), {
      preserveScroll: true,
      onSuccess: () => {
        form.setData("quantity", 1)
        // Produk "terbang" ke ikon keranjang sebagai konfirmasi visual.
        if (activeMedia?.url && button) {
          const rect = button.getBoundingClientRect()
          dispatchCartFly({
            image: activeMedia.url,
            x: rect.left,
            y: rect.top,
            w: rect.width,
            h: rect.height,
          })
        }
      },
      onFinish: () => setSubmitIntent(null),
    })
  }

  function buyNow() {
    if (!selectedVariant) {
      requestVariant()
      return
    }
    if (selectedVariant.stock < 1) return

    setSubmitIntent("checkout")
    form.setData("intent", "checkout")
    form.post(routeUrl("cart.add"), {
      onFinish: () => {
        setSubmitIntent(null)
        form.setData("intent", "cart")
      },
    })
  }

  function changeQuantity(quantity: number) {
    if (!selectedVariant) {
      requestVariant()
      return
    }
    form.setData("quantity", quantity)
  }

  const ratedReviews = reviews.filter((review) => (review.rating ?? 0) > 0)
  const averageRating = ratedReviews.length
    ? ratedReviews.reduce((total, review) => total + (review.rating ?? 0), 0) / ratedReviews.length
    : null
  const ratingLabel = averageRating !== null
    ? (Math.round(averageRating * 10) / 10).toLocaleString("id-ID")
    : null

  const currentPrice = selectedVariant?.sale_price ?? selectedVariant?.price ?? promo?.min_price ?? null
  const comparePrice = selectedVariant?.compare_price ?? promo?.compare_price ?? null
  const discountPercent = selectedVariant?.compare_price != null && selectedVariant?.sale_price != null
    ? Math.round(((selectedVariant.compare_price - selectedVariant.sale_price) / selectedVariant.compare_price) * 100)
    : (promo?.discount_percent ?? null)

  const benefits = [
    { icon: "shield-check", label: promo?.warranty_label || "Garansi 100%" },
    ...(promo?.cod_eligible === false ? [] : [{ icon: "hand-coins", label: "Bayar di tempat (COD)" }]),
    { icon: "truck", label: "Kirim ke seluruh Indonesia" },
  ].slice(0, 3)

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    sku: product.parent_sku,
    description: product.description ?? product.subtitle,
    image: media.map((item) => item.url).filter(Boolean),
    offers: selectedVariant
      ? {
          "@type": "Offer",
          priceCurrency: "IDR",
          price: selectedVariant.sale_price ?? selectedVariant.price,
          availability:
            selectedVariant.stock > 0
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
        }
      : undefined,
  }

  return {
    title,
    promo,
    variants,
    axes,
    selections,
    variantError,
    variantSectionRef,
    selectedVariant,
    variantMedia,
    highlightedMediaId,
    form,
    submitIntent,
    chooseAxis,
    requestVariant,
    addToCart,
    buyNow,
    changeQuantity,
    ratedReviews,
    averageRating,
    ratingLabel,
    currentPrice,
    comparePrice,
    discountPercent,
    benefits,
    productSchema,
  }
}

export type ProductPurchase = ReturnType<typeof useProductPurchase>
