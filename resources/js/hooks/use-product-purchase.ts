import { router, useForm } from "@inertiajs/react"
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
    () => variantAxes(variants).filter((axis) => axis.name !== "Ukuran"),
    [variants],
  )
  const initialSelections = React.useMemo(
    () => firstAvailableSelections(variants),
    [variants],
  )
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
          return (v.dimension_label ?? v.dimension_compact) === axisOption
        }
        return pairOption === axisOption
      })
      if (match) matchingVariantIds.add(v.id)
    })

    if (matchingVariantIds.size === 0) return media

    const dedicated = media.filter((item) => {
      const vid = Number(item.product_variant_id)
      return vid && matchingVariantIds.has(vid)
    })
    if (dedicated.length) return dedicated

    const productLevel = media.filter((item) => item.product_variant_id == null)
    return productLevel
  }, [media, selections, variants])

  const form = useForm({
    parent_sku: product.parent_sku,
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
    const nextSelections = { ...selections, [axisName]: option }
    const nextVariant = resolveVariant(variants, nextSelections)

    setSelections(nextSelections)
    form.setData("variant_sku", nextVariant?.variant_sku ?? "")
    form.setData("quantity", 1)
    form.clearErrors()

    if (nextVariant && typeof window !== "undefined") {
      const url = new URL(window.location.href)
      url.searchParams.set("variant", nextVariant.variant_sku)
      window.history.replaceState(
        window.history.state,
        "",
        url.pathname + url.search + url.hash,
      )
    }
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
    form.post(routeUrl("cart.add"), {
      onSuccess: () => router.visit(routeUrl("checkout.index")),
      onFinish: () => setSubmitIntent(null),
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
