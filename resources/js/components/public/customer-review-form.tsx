import * as React from "react"
import { Link } from "@inertiajs/react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/shared/icon"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { PublicOrderItem, PublicOrderReview } from "@/types"

type ReviewItem = Pick<PublicOrderItem, "product_id" | "product_name" | "name" | "parent_sku">

interface CustomerReviewFormProps {
  orderNumber: string
  customerPhone: string
  orderStatus: string
  items: ReviewItem[]
  reviews?: PublicOrderReview[]
  variant?: "banner" | "button"
  fullWidth?: boolean
}

const SUGGESTION_CHIPS = [
  "Pengiriman cepat",
  "Barang berkualitas",
  "Pemasangan rapi",
  "Harga sesuai",
  "Pelayanan ramah",
]

function reviewRoute(orderNumber: string, reviewId?: number): string {
  return reviewId
    ? routeUrl(
        "order.review.update",
        { order_number: orderNumber, testimonial: reviewId },
        `/order/${encodeURIComponent(orderNumber)}/review/${reviewId}`,
      )
    : routeUrl(
        "order.review.store",
        { order_number: orderNumber },
        `/order/${encodeURIComponent(orderNumber)}/review`,
      )
}

function firstError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null
  const errors = (payload as { errors?: Record<string, string[] | string> }).errors
  if (!errors || typeof errors !== "object") return null
  const value = Object.values(errors)[0]
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

/** U3: sheet kompak — bottom sheet (mobile) / side panel kanan (desktop). */
function ReviewSheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-foreground/45 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-[70] overflow-y-auto border-border bg-surface p-5 shadow-float focus:outline-none",
            "inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-lg border-t",
            "lg:inset-y-0 lg:left-auto lg:right-0 lg:h-full lg:w-[min(90vw,27rem)] lg:max-h-none lg:rounded-none lg:border-l",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Formulir ulasan</DialogPrimitive.Title>
          {children}
          <DialogPrimitive.Close className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-accent hover:text-foreground">
            <Icon name="x" className="size-5" aria-hidden="true" />
            <span className="sr-only">Tutup</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function CustomerReviewForm({
  orderNumber,
  customerPhone,
  orderStatus,
  items,
  reviews = [],
  variant = "button",
  fullWidth = false,
}: CustomerReviewFormProps) {
  const eligible = orderStatus === "delivered" || orderStatus === "completed"
  const review = reviews[0] ?? null
  const products = React.useMemo(
    () => items.filter((item): item is ReviewItem & { product_id: number } => (
      typeof item.product_id === "number" && item.product_id > 0
    )),
    [items],
  )
  const [rating, setRating] = React.useState(0)
  const [message, setMessage] = React.useState(review?.message ?? "")
  const [productId, setProductId] = React.useState<number | "">(
    review?.product_id ?? (products.length === 1 ? products[0].product_id : ""),
  )
  const [mediaItems, setMediaItems] = React.useState<NonNullable<PublicOrderReview["media_items"]>>(
    review?.media_items ?? [],
  )
  const [currentReview, setCurrentReview] = React.useState<PublicOrderReview | null>(review)
  const [alreadyReviewed, setAlreadyReviewed] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  React.useEffect(() => {
    const next = reviews[0] ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentReview(next)
    setRating(next?.rating || 0)
    setMessage(next?.message ?? "")
    setProductId(next?.product_id ?? (products.length === 1 ? products[0].product_id : ""))
    setMediaItems(next?.media_items ?? [])
  }, [reviews, products, orderNumber])

  const hasOwnReview = Boolean(currentReview?.customer_authored === true || alreadyReviewed || (reviews.length > 0))

  // URL halaman produk terkait dan section ulasan (#penilaian-ulasan)
  const targetProduct = React.useMemo(() => {
    if (productId) {
      const found = items.find((i) => i.product_id === productId)
      if (found) return found
    }
    if (currentReview?.product_id) {
      const found = items.find((i) => i.product_id === currentReview.product_id)
      if (found) return found
    }
    return items.find((i) => Boolean(i.parent_sku)) ?? items[0] ?? null
  }, [items, productId, currentReview])

  const productReviewUrl = targetProduct?.parent_sku
    ? `${routeUrl("product.show", { parent_sku: targetProduct.parent_sku })}#penilaian-ulasan`
    : routeUrl("reviews.website")

  if (!eligible) return null

  function resetNotice(): void {
    setError(null)
    setSuccess(null)
  }

  async function uploadFiles(files: FileList | File[]): Promise<void> {
    const fileList = Array.from(files)
    const slots = 10 - mediaItems.length
    const selected = fileList.slice(0, Math.max(0, slots))
    if (selected.length === 0) {
      setError("Maksimal 10 media per ulasan.")
      return
    }

    setUploading(true)
    resetNotice()
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? ""
      const uploaded: NonNullable<PublicOrderReview["media_items"]> = []
      for (const file of selected) {
        const body = new FormData()
        body.append("customer_phone", customerPhone)
        body.append("media", file)
        const response = await fetch(`/order/${encodeURIComponent(orderNumber)}/review/media`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
            ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
          },
          body,
        })
        const payload = await response.json().catch(() => ({})) as {
          url?: string
          type?: "image" | "video"
        }
        if (!response.ok || !payload.url) {
          setError(firstError(payload) ?? "Media gagal diunggah. Coba lagi.")
          break
        }
        uploaded.push({ type: payload.type ?? (file.type.startsWith("video/") ? "video" : "image"), url: payload.url })
      }
      if (uploaded.length > 0) {
        setMediaItems((prev) => [...prev, ...uploaded].slice(0, 10))
      }
    } catch {
      setError("Koneksi gagal saat mengunggah media.")
    } finally {
      setUploading(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    resetNotice()
    if (rating < 1) {
      setError("Pilih bintang rating terlebih dahulu.")
      return
    }
    if (message.trim().length < 3) {
      setError("Tulis ulasan minimal 3 karakter.")
      return
    }
    if (products.length > 1 && productId === "" && !currentReview?.product_id) {
      setError("Pilih produk yang ingin diberi ulasan.")
      return
    }

    setBusy(true)
    try {
      const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? ""
      const response = await fetch(reviewRoute(orderNumber), {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
        },
        body: JSON.stringify({
          customer_phone: customerPhone,
          ...(productId === "" ? {} : { product_id: productId }),
          rating,
          message: message.trim(),
          media_items: mediaItems,
        }),
      })
      const payload = await response.json().catch(() => ({})) as {
        message?: string
        review?: Partial<PublicOrderReview> & { id?: number }
      }
      if (!response.ok) {
        const errMsg = firstError(payload) ?? payload.message ?? "Ulasan belum dapat disimpan. Coba lagi."
        if (errMsg.includes("sudah memiliki ulasan")) {
          setAlreadyReviewed(true)
        }
        setError(errMsg)
        return
      }

      const saved = payload.review ?? {}
      setCurrentReview({
        id: Number(saved.id ?? currentReview?.id ?? 0),
        product_id: saved.product_id ?? (productId === "" ? null : productId),
        rating,
        message: message.trim(),
        media_items: mediaItems,
        moderation_status: saved.moderation_status ?? "pending",
        published: false,
        verified_purchase: true,
        customer_authored: true,
      })
      setAlreadyReviewed(true)
      setSuccess(payload.message ?? "Ulasan berhasil disimpan.")
      setSheetOpen(false)
    } catch {
      setError("Koneksi gagal. Periksa koneksi lalu coba lagi.")
    } finally {
      setBusy(false)
    }
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  function chipSelected(chip: string): boolean {
    const esc = escapeRegExp(chip)
    return new RegExp(`(^|,\\s*)${esc}(?=\\s*,|\\s*$)`).test(message)
  }

  function removeChipFromMessage(value: string, chip: string): string {
    const esc = escapeRegExp(chip)
    return value
      .replace(new RegExp(`(^|,\\s*)${esc}(?=\\s*,|\\s*$)`, "g"), "$1")
      .replace(/^,\\s*/, "")
      .replace(/,\\s*$/, "")
      .replace(/,\\s*,/g, ",")
      .trim()
  }

  function toggleSuggestion(chip: string): void {
    resetNotice()
    setMessage((prev) => {
      const trimmed = prev.trim()
      if (chipSelected(chip)) return removeChipFromMessage(trimmed, chip)
      if (trimmed === "") return chip
      return `${trimmed.replace(/,\\s*$/, "")}, ${chip.toLowerCase()}`
    })
  }

  const trigger = variant === "banner" ? (
    <section className="rounded-[14px] border border-success/30 bg-success/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Terima kasih, pesanan Anda sudah sampai di alamat tujuan!
          </p>
          {hasOwnReview ? (
            <p className="mt-0.5 text-xs text-muted-foreground">Anda sudah berbagi pengalaman untuk pesanan ini. Terima kasih!</p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Bagikan pengalaman Anda agar bermanfaat bagi pembeli lain.</p>
          )}
        </div>
        {hasOwnReview ? (
          <Link
            href={productReviewUrl}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-success/30 bg-surface px-4 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:border-success/60 hover:bg-white"
          >
            <span className="flex items-center gap-0.5" aria-label={`Rating ${currentReview?.rating ?? 5} dari 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon
                  key={n}
                  name="star"
                  weight={n <= (currentReview?.rating ?? 5) ? "fill" : "regular"}
                  className={n <= (currentReview?.rating ?? 5) ? "size-3.5 text-[#f59e0b]" : "size-3.5 text-muted-foreground"}
                  aria-hidden="true"
                />
              ))}
            </span>
            <span className="ml-1 text-primary font-bold">Lihat Ulasan →</span>
          </Link>
        ) : (
          <Button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="w-full sm:w-auto"
          >
            <Icon name="star" className="mr-2 size-4" aria-hidden="true" />
            Beri Ulasan
          </Button>
        )}
      </div>
    </section>
  ) : (
    hasOwnReview ? (
      <Button asChild variant="secondary" className={fullWidth ? "w-full" : "w-full sm:w-auto"}>
        <Link href={productReviewUrl}>
          <Icon name="star" className="mr-2 size-4" aria-hidden="true" />
          Lihat Ulasan
        </Link>
      </Button>
    ) : (
      <Button
        type="button"
        variant="secondary"
        onClick={() => setSheetOpen(true)}
        className={fullWidth ? "w-full" : "w-full sm:w-auto"}
      >
        <Icon name="star" className="mr-2 size-4" aria-hidden="true" />
        Beri Ulasan
      </Button>
    )
  )

  return (
    <>
      {trigger}
      <ReviewSheet
        open={sheetOpen}
        onOpenChange={(next) => {
          if (!next && (busy || uploading)) return
          setSheetOpen(next)
        }}
      >
      <div className="pb-14 lg:pb-4">
        <h3 id="customer-review-heading" className="text-lg font-semibold">
          {hasOwnReview ? "Ulasan Anda" : "Bagikan Pengalaman Anda"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasOwnReview
            ? "Ulasan Anda untuk pesanan ini telah tercatat."
            : "Hanya pembelian terverifikasi yang dapat mengirim ulasan."}
        </p>

        {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
        {success ? (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
            <Icon name="check-circle" className="mr-2 inline size-4" aria-hidden="true" />
            {success}
          </div>
        ) : null}

        {hasOwnReview ? (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon
                    key={n}
                    name="star"
                    weight={n <= (rating || currentReview?.rating || 5) ? "fill" : "regular"}
                    className={n <= (rating || currentReview?.rating || 5) ? "size-5 text-[#f59e0b]" : "size-5 text-muted-foreground"}
                    aria-hidden="true"
                  />
                ))}
              </div>
              {message || currentReview?.message ? (
                <p className="text-sm text-foreground leading-relaxed">
                  {message || currentReview?.message}
                </p>
              ) : null}
              {mediaItems.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {mediaItems.map((item, index) => (
                    <div
                      key={`${item.url}-${index}`}
                      className="relative size-16 overflow-hidden rounded-md border border-border bg-surface"
                    >
                      {item.type === "video" ? (
                        <video src={item.url} className="size-full object-cover" muted playsInline />
                      ) : (
                        <img src={item.url} alt="" className="size-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <Button asChild className="w-full">
              <Link href={productReviewUrl}>
                Lihat Ulasan di Halaman Produk
                <Icon name="arrow-right" className="ml-2 size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
            {products.length > 1 ? (
              <label className="block text-sm font-medium" htmlFor={`review-product-${orderNumber}`}>
                Produk yang diulas
                <select
                  id={`review-product-${orderNumber}`}
                  value={productId}
                  onChange={(event) => setProductId(event.target.value === "" ? "" : Number(event.target.value))}
                  className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-sm"
                  disabled={busy}
                >
                  <option value="">Pilih produk</option>
                  {products.map((item) => (
                    <option key={item.product_id} value={item.product_id}>
                      {item.product_name ?? item.name ?? "Produk"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <fieldset>
              <legend className="text-sm font-medium">Rating</legend>
              <div className="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label="Rating ulasan">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    aria-label={`${value} bintang`}
                    onClick={() => setRating(value)}
                    className="inline-flex items-center justify-center rounded-full p-2 transition hover:scale-110"
                    disabled={busy}
                  >
                    <Icon
                      name="star"
                      weight={rating >= value ? "fill" : "regular"}
                      className={cn("size-6", rating >= value ? "text-[#f59e0b]" : "text-muted-foreground")}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-medium" htmlFor={`review-message-${orderNumber}`}>
              Ceritakan pengalaman Anda
              <span className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleSuggestion(chip)}
                    aria-pressed={chipSelected(chip)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      chipSelected(chip)
                        ? "border-[#2b734e] bg-[#2b734e]/10 text-[#2b734e]"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {chip}
                  </button>
                ))}
              </span>
              <Textarea
                id={`review-message-${orderNumber}`}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                maxLength={5000}
                className="mt-1.5"
                disabled={busy}
                placeholder="Bagaimana kualitas produk dan proses pesanannya?"
              />
            </label>

            <div>
              <span className="block text-sm font-medium">Media pendukung (opsional)</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {mediaItems.map((item, index) => (
                  <div
                    key={`${item.url}-${index}`}
                    className="relative size-20 overflow-hidden rounded-md border border-border bg-background"
                  >
                    {item.type === "video" ? (
                      <video src={item.url} className="size-full object-cover" muted playsInline />
                    ) : (
                      <img src={item.url} alt="" className="size-full object-cover" loading="lazy" />
                    )}
                    <button
                      type="button"
                      aria-label="Hapus media"
                      onClick={() => setMediaItems((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute right-0.5 top-0.5 inline-flex size-6 items-center justify-center rounded-full bg-foreground/70 text-white"
                    >
                      <Icon name="x" className="size-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {mediaItems.length < 10 ? (
                  <label className="inline-flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-background text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
                    <Icon name="image" className="size-5" aria-hidden="true" />
                    <span className="text-[10px]">{uploading ? "Mengunggah..." : "Unggah"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4"
                      multiple
                      className="sr-only"
                      disabled={uploading || busy}
                      onChange={(event) => {
                        if (event.target.files && event.target.files.length > 0) {
                          void uploadFiles(event.target.files)
                        }
                        event.target.value = ""
                      }}
                    />
                  </label>
                ) : null}
              </div>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                {mediaItems.length}/10 media. Foto atau video, maksimal 10 MB per file.
              </p>
            </div>

            <Button type="submit" disabled={busy || uploading} className="w-full">
              {busy ? "Menyimpan..." : "Kirim ulasan"}
            </Button>
          </form>
        )}
      </div>
      </ReviewSheet>
    </>
  )
}
