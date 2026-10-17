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
  variantSlotAxisName,
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
  /** Gambar per nilai opsi variasi (sumber tunggal gambar saat opsi dipilih). */
  optionMedia?: ProductOptionMedia[]
  /** Nomor slot sumbu yang boleh bergambar (1..5). Null = produk lama. */
  imageAxisSlot?: number | null
}

/** Satu gambar milik satu NILAI opsi, bukan kombinasi. */
export interface ProductOptionMedia {
  id: number
  variation_slot: number
  variation_name: string
  option_value: string
  url?: string | null
  thumb?: string | null
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
  optionMedia = [],
  imageAxisSlot = null,
}: UseProductPurchaseOptions) {
  const title = productName(product.name, product.short_name)
  const axes = React.useMemo(
    () => variantAxes(variants),
    [variants],
  )
  // URL dibaca sekali saat mount (lazy initializer) supaya useMemo di bawah
  // murni terhadap props dan memoization-nya tidak dibuang compiler.
  const [urlVariantSku] = React.useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URL(window.location.href).searchParams.get("variant"),
  )
  const initialSelections = React.useMemo(() => {
    if (urlVariantSku && variants.length) {
      const match = variants.find((v) => v.variant_sku === urlVariantSku)
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
  }, [variants, urlVariantSku])
  const [selections, setSelections] = React.useState<VariantSelections>(initialSelections)
  const [variantError, setVariantError] = React.useState(false)
  const variantSectionRef = React.useRef<HTMLDivElement>(null)

  // Pilihan varian berasal dari server saat produk berganti lewat Inertia.
  // Disesuaikan saat render (pola resmi React), bukan lewat effect.
  const [syncedInitialSelections, setSyncedInitialSelections] = React.useState(initialSelections)
  if (syncedInitialSelections !== initialSelections) {
    setSyncedInitialSelections(initialSelections)
    setSelections(initialSelections)
  }

  const selectedVariant = React.useMemo(
    () =>
      resolveVariant(variants, selections) ??
      (axes.length === 0 ? variants[0] ?? null : null),
    [axes.length, selections, variants],
  )

  // Nama sumbu yang boleh bergambar (mis. "Warna"). Gambar ditentukan HANYA
  // oleh opsi pada sumbu ini, sehingga memilih sumbu lain (mis. Kaca) tidak
  // pernah menimpa gambar.
  const imageAxisName = React.useMemo(
    () => variantSlotAxisName(variants, imageAxisSlot),
    [variants, imageAxisSlot],
  )

  // Gambar opsi ikut masuk galeri supaya pembeli bisa melihat semua warna
  // tanpa mengklik. Urutan stabil: foto katalog dulu, lalu gambar opsi.
  const optionMediaItems = React.useMemo<ProductMedia[]>(
    () =>
      optionMedia
        .filter((item) => Boolean(item.url))
        .map((item) => ({
          // id negatif: tidak mungkin bentrok dengan id media katalog, dan
          // tetap bertipe angka sehingga penanda aktif galeri bekerja apa adanya.
          id: -Math.abs(item.id),
          url: item.url ?? null,
          thumb: item.thumb ?? item.url ?? null,
          is_main_image: false,
          is_video: false,
          product_variant_id: null,
        })),
    [optionMedia],
  )

  const variantMedia = React.useMemo(
    () => (optionMediaItems.length ? [...media, ...optionMediaItems] : media),
    [media, optionMediaItems],
  )

  // Gambar yang DITONJOLKAN: gambar opsi pada sumbu bergambar yang sedang
  // dipilih. Belum memilih = null, galeri tetap di gambar utama.
  const highlightedMediaId = React.useMemo(() => {
    if (!imageAxisName) return null
    const selected = selections[imageAxisName]
    if (!selected) return null

    const match = optionMedia.find(
      (item) =>
        Number(item.variation_slot) === Number(imageAxisSlot) &&
        item.option_value.trim().toLowerCase() === selected.trim().toLowerCase(),
    )
    return match ? -Math.abs(match.id) : null
  }, [imageAxisName, imageAxisSlot, optionMedia, selections])

  // Produk lama (belum punya gambar opsi): pertahankan perilaku sebelumnya
  // supaya gambar varian lama tetap berganti sampai datanya dimigrasikan.
  const legacyHighlightedMediaId = React.useMemo(() => {
    if (optionMedia.length > 0) return null
    const exact = resolveVariant(variants, selections)
    if (!exact) return null
    const hit = media.find((item) => Number(item.product_variant_id) === exact.id)
    return hit ? hit.id : null
  }, [media, optionMedia.length, selections, variants])

  const activeMediaId = highlightedMediaId ?? legacyHighlightedMediaId

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
    /** Nama sumbu yang boleh bergambar; null bila produk tanpa gambar opsi. */
    imageAxisName,
    /** Peta nilai opsi -> thumbnail, hanya untuk sumbu bergambar. */
    optionThumbs: React.useMemo(() => {
      const map = new Map<string, string>()
      for (const item of optionMedia) {
        if (Number(item.variation_slot) !== Number(imageAxisSlot)) continue
        const thumb = item.thumb ?? item.url
        if (thumb) map.set(item.option_value.trim().toLowerCase(), thumb)
      }
      return map
    }, [optionMedia, imageAxisSlot]),
    selections,
    variantError,
    variantSectionRef,
    selectedVariant,
    variantMedia,
    highlightedMediaId: activeMediaId,
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
