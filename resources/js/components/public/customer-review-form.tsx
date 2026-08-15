import * as React from "react"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { routeUrl } from "@/lib/routes"
import type { PublicOrderItem, PublicOrderReview } from "@/types"

type ReviewItem = Pick<PublicOrderItem, "product_id" | "product_name" | "name">

interface CustomerReviewFormProps {
  orderNumber: string
  customerPhone: string
  orderStatus: string
  items: ReviewItem[]
  reviews?: PublicOrderReview[]
}

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

function mediaToUrls(media: PublicOrderReview["media_items"]): string[] {
  return (media ?? [])
    .map((item) => item.url)
    .filter((url): url is string => Boolean(url))
}

export function CustomerReviewForm({
  orderNumber,
  customerPhone,
  orderStatus,
  items,
  reviews = [],
}: CustomerReviewFormProps) {
  const eligible = orderStatus === "delivered" || orderStatus === "completed"
  const review = reviews[0] ?? null
  const products = React.useMemo(
    () => items.filter((item): item is ReviewItem & { product_id: number } => (
      typeof item.product_id === "number" && item.product_id > 0
    )),
    [items],
  )
  const [rating, setRating] = React.useState(review?.rating || 5)
  const [message, setMessage] = React.useState(review?.message ?? "")
  const [productId, setProductId] = React.useState<number | "">(
    review?.product_id ?? (products.length === 1 ? products[0].product_id : ""),
  )
  const [mediaText, setMediaText] = React.useState(mediaToUrls(review?.media_items).join("\n"))
  const [currentReview, setCurrentReview] = React.useState<PublicOrderReview | null>(review)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [success, setSuccess] = React.useState<string | null>(null)

  React.useEffect(() => {
    const next = reviews[0] ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentReview(next)
    setRating(next?.rating || 5)
    setMessage(next?.message ?? "")
    setProductId(next?.product_id ?? (products.length === 1 ? products[0].product_id : ""))
    setMediaText(mediaToUrls(next?.media_items).join("\n"))
  }, [reviews, products])

  if (!eligible) return null

  const isOwnReview = currentReview?.customer_authored === true
  const canEdit = Boolean(currentReview && isOwnReview)
  const mediaItems: PublicOrderReview["media_items"] = mediaText
    .split("\n")
    .map((url) => url.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((url) => ({ type: "image", url }))

  function resetNotice(): void {
    setError(null)
    setSuccess(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    resetNotice()
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
      const response = await fetch(reviewRoute(orderNumber, canEdit ? currentReview?.id : undefined), {
        method: canEdit ? "PUT" : "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
        },
        body: JSON.stringify({
          customer_phone: customerPhone,
          ...(canEdit ? {} : productId === "" ? {} : { product_id: productId }),
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
        setError(firstError(payload) ?? payload.message ?? "Ulasan belum dapat disimpan. Coba lagi.")
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
      setSuccess(payload.message ?? "Ulasan berhasil disimpan dan menunggu moderasi.")
    } catch {
      setError("Koneksi gagal. Periksa koneksi lalu coba lagi.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6" aria-labelledby="customer-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="customer-review-heading" className="text-lg font-semibold">
            {currentReview ? "Ulasan Anda" : "Bagikan pengalaman Anda"}
          </h3>
          <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">
            Hanya pembelian terverifikasi yang dapat mengirim ulasan.
          </p>
        </div>
        {currentReview?.verified_purchase ? (
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            Pembelian terverifikasi
          </span>
        ) : null}
      </div>

      {currentReview && !isOwnReview ? (
        <Alert tone="info" className="mt-4">
          Ulasan ini dicatat oleh tim toko dan tidak dapat diedit dari sisi pelanggan.
        </Alert>
      ) : (
        <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {success ? <Alert tone="success">{success}</Alert> : null}

          {products.length > 1 && !canEdit ? (
            <label className="block text-sm font-medium">
              Produk yang diulas
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value ? Number(event.target.value) : "")}
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
            <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating ulasan">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} bintang`}
                  onClick={() => setRating(value)}
                  className={`size-10 rounded-md border text-lg ${rating >= value ? "border-warning bg-warning/10 text-warning" : "border-border text-muted-foreground"}`}
                  disabled={busy}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium" htmlFor={`review-message-${orderNumber}`}>
            Ceritakan pengalaman Anda
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

          <label className="block text-sm font-medium" htmlFor={`review-media-${orderNumber}`}>
            Media pendukung (opsional)
            <Textarea
              id={`review-media-${orderNumber}`}
              value={mediaText}
              onChange={(event) => setMediaText(event.target.value)}
              rows={2}
              className="mt-1.5"
              disabled={busy}
              placeholder="Tautan foto/video, satu tautan per baris"
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Tempel satu tautan per baris, maksimal 10 tautan.
            </span>
          </label>

          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan..." : canEdit ? "Simpan perubahan" : "Kirim ulasan"}
          </Button>
        </form>
      )}
    </section>
  )
}
