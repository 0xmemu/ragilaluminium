import { Link, usePage } from "@inertiajs/react"
import * as React from "react"

import {
  InstallationCarousel,
  ModelCardCarousel,
  ProductCardCarousel,
  TestimonialCarousel,
} from "@/components/public/home-carousels"
import { Icon } from "@/components/shared/icon"
import { SectionHeading } from "@/components/shared/section-heading"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type {
  InstallationItem,
  ModelCardData,
  ProductCardData,
  SharedPageProps,
  Testimonial,
} from "@/types"

export interface HowToOrderData {
  title: string
  subtitle?: string
  steps: Array<{ step: string; title: string; description: string }>
}

function SectionTitle({
  title,
  actionHref,
  actionLabel = "Lihat Semua →",
  tone = "default",
}: {
  title: string
  actionHref?: string
  actionLabel?: string
  tone?: "default" | "on-primary"
}) {
  const onPrimary = tone === "on-primary"

  return (
    <SectionHeading
      align="left"
      size="default"
      tone={tone}
      fitHeading={false}
      headingClassName="!text-[18px]"
      className="gap-1"
      title={title}
      action={
        actionHref ? (
          <Link
            href={actionHref}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-1 self-end px-1 text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              onPrimary
                ? "text-white/90 hover:text-white"
                : "text-[#474747] hover:text-[#333333]",
            )}
          >
            {actionLabel}
          </Link>
        ) : undefined
      }
    />
  )
}

export function PilihModelProdukSection({ models }: { models: ModelCardData[] }) {
  const seeMoreHref = routeUrl("catalog.index")

  return (
    <section id="pilih-model-produk" className="scroll-mt-20 bg-surface">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <SectionTitle
          title="Pilih Model Produk"
          actionHref={seeMoreHref}
        />
        {models.length ? (
          <ModelCardCarousel models={models} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            title="Model belum tersedia"
            description="Katalog model sedang disiapkan. Chat WhatsApp jika Anda ingin dibantu memilih."
            action={
              <Button asChild>
                <Link href={seeMoreHref}>Buka Katalog</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}

export function PalingBanyakDipesanSection({ products }: { products: ProductCardData[] }) {
  const seeMoreHref = `${routeUrl("catalog.all")}?sort=popular`

  return (
    <section id="paling-banyak-dipesan" className="scroll-mt-20">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <SectionTitle
          title="Paling banyak dipesan"
          actionHref={seeMoreHref}
        />
        {products.length ? (
          <ProductCardCarousel products={products} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            title="Belum ada produk populer"
            description="Mulai dari katalog jendela, pintu, atau bouven untuk menemukan ukuran yang Anda butuhkan."
            action={
              <Button asChild>
                <Link href={routeUrl("catalog.category", { category: "windows" })}>Jelajahi Produk</Link>
              </Button>
            }
          />
        )}
      </div>
    </section>
  )
}

const DEFAULT_ORDER_STEPS = [
  { step: "01", title: "Pilih model", icon: "package" as const },
  { step: "02", title: "Pilih ukuran & varian", icon: "ruler" as const },
  { step: "03", title: "Proses pesanan & konfirmasi WhatsApp", icon: "whatsapp" as const },
]

const ORDER_STEP_ICONS = ["package", "ruler", "whatsapp"] as const

/** Shared step index chip — filled hitam (Kami bantu); dipakai juga di Cara pesan. */
function orderStepIcon(title: string, index: number): string {
  const t = title.toLowerCase()
  if (t.includes("model")) return "package"
  if (t.includes("ukuran") || t.includes("varian")) return "ruler"
  if (t.includes("whatsapp") || t.includes("konfirmasi") || t.includes("proses")) return "whatsapp"
  if (t.includes("checkout") || t.includes("bayar")) return "credit-card"
  if (t.includes("lacak") || t.includes("pesanan")) return "clipboard-list"
  return ORDER_STEP_ICONS[index % ORDER_STEP_ICONS.length] ?? "package"
}

export function CaraPesanSection({
  data,
}: {
  data?: HowToOrderData
}) {
  const title = data?.title || "cara pesan jendela impian anda"
  const steps = (data?.steps?.length ? data.steps : DEFAULT_ORDER_STEPS).slice(0, 3)
  const stepDescriptions: Record<string, string> = {
    "Pilih model": "telusuri katalog di website dan pilih model jendela favoritmu",
    "Pilih ukuran & varian": "tentukan ukuran & varian yang kamu butuhkan, lalu masukkan ke keranjang",
    "Proses pesanan & konfirmasi WhatsApp": "selesaikan checkout, lalu konfirmasi pesananmu lewat WhatsApp",
  }
  const [active, setActive] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const [isDesktop, setIsDesktop] = React.useState(false)
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  const total = steps.length
  const surfaceRef = React.useRef<HTMLDivElement>(null)
  const dragRef = React.useRef<{
    pointerId: number | null
    startX: number
    dragged: boolean
  }>({ pointerId: null, startX: 0, dragged: false })

  React.useEffect(() => {
    if (total < 2 || paused || isDesktop) return
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (media.matches) return
    const id = window.setInterval(() => {
      setActive((current) => (current + 1) % total)
    }, 4000)
    return () => window.clearInterval(id)
  }, [total, paused, isDesktop])

  // Swipe kiri/kanan untuk ganti langkah.
  React.useEffect(() => {
    const el = surfaceRef.current
    if (!el || total < 2) return

    const state = dragRef.current
    let startX = 0
    let activeDrag = false
    let dragged = false
    const usePointer = typeof window.PointerEvent === "function"

    const begin = (clientX: number, pointerId: number | null = null) => {
      activeDrag = true
      dragged = false
      startX = clientX
      state.pointerId = pointerId
      state.dragged = false
    }

    const markDrag = (clientX: number, event?: Event) => {
      if (!activeDrag) return
      if (Math.abs(clientX - startX) < 28) return
      if (!dragged) {
        dragged = true
        state.dragged = true
        if (state.pointerId !== null && event instanceof PointerEvent) {
          try {
            el.setPointerCapture(state.pointerId)
          } catch {
            // ignore
          }
        }
      }
      event?.preventDefault()
    }

    const finish = (clientX: number) => {
      if (!activeDrag) return
      const dx = clientX - startX
      const wasDragged = dragged
      activeDrag = false
      dragged = false
      state.pointerId = null
      state.dragged = false
      if (!wasDragged || Math.abs(dx) < 40) return
      setActive((current) => ((current + (dx < 0 ? 1 : -1)) % total + total) % total)
    }

    if (usePointer) {
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === "mouse" && event.button !== 0) return
        begin(event.clientX, event.pointerId)
      }
      const onPointerMove = (event: PointerEvent) => {
        if (state.pointerId !== null && state.pointerId !== event.pointerId) return
        markDrag(event.clientX, event)
      }
      const onPointerUp = (event: PointerEvent) => {
        if (state.pointerId !== null && state.pointerId !== event.pointerId) return
        finish(event.clientX)
      }
      el.addEventListener("pointerdown", onPointerDown)
      el.addEventListener("pointermove", onPointerMove, { passive: false })
      el.addEventListener("pointerup", onPointerUp)
      el.addEventListener("pointercancel", onPointerUp)
      return () => {
        el.removeEventListener("pointerdown", onPointerDown)
        el.removeEventListener("pointermove", onPointerMove)
        el.removeEventListener("pointerup", onPointerUp)
        el.removeEventListener("pointercancel", onPointerUp)
      }
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      begin(event.touches[0].clientX)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!activeDrag || event.touches.length !== 1) return
      markDrag(event.touches[0].clientX, event)
    }
    const onTouchEnd = (event: TouchEvent) => {
      finish(event.changedTouches[0]?.clientX ?? startX)
    }
    el.addEventListener("touchstart", onTouchStart, { passive: true })
    el.addEventListener("touchmove", onTouchMove, { passive: false })
    el.addEventListener("touchend", onTouchEnd)
    el.addEventListener("touchcancel", onTouchEnd)
    return () => {
      el.removeEventListener("touchstart", onTouchStart)
      el.removeEventListener("touchmove", onTouchMove)
      el.removeEventListener("touchend", onTouchEnd)
      el.removeEventListener("touchcancel", onTouchEnd)
    }
  }, [total])

  return (
    <section id="cara-pesan" className="scroll-mt-20 bg-surface">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <SectionTitle
          title={title}
          actionHref={routeUrl("cara-pemesanan")}
          actionLabel="Lihat Panduan →"
        />

        <div
          ref={surfaceRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="relative w-full overflow-hidden rounded-xl bg-foreground shadow-[0_2px_16px_rgba(10,0,0,0.12)] [touch-action:pan-y]"
        >
          <div
            className={cn(
              "flex h-[120px] w-full",
              !isDesktop && !(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) &&
                "transition-transform duration-200 ease-emphasized",
            )}
            style={{ transform: isDesktop ? "translateX(0)" : `translateX(-${active * 100}%)` }}
            aria-live="polite"
          >
            {steps.map((item, index) => {
              const icon = orderStepIcon(item.title, index)
              const desc =
                stepDescriptions[item.title] ??
                ("description" in item ? item.description : undefined)
              return (
                <div
                  key={`${index}-${item.title}`}
                  className="flex h-full w-full shrink-0 items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:w-1/3 lg:basis-1/3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white sm:size-10">
                    <Icon name={icon} className="size-4.5 sm:size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="mt-0.5 text-[13px] font-bold leading-snug tracking-tight text-white sm:text-sm">
                      {item.title.toLowerCase()}
                    </h3>
                    {desc ? (
                      <p className="mt-0.5 text-[11px] leading-snug text-white/70 sm:text-xs">
                        {desc.toLowerCase()}
                      </p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Dots tipis di kanan bawah */}
          {total > 1 ? (
            <div className="absolute bottom-2 right-3 flex items-center gap-1 lg:hidden">
              {steps.map((item, index) => (
                <button
                  key={`dot-${index}-${item.title}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Langkah ${index + 1}`}
                  className="relative flex size-8 items-center justify-center rounded-full transition-all before:absolute before:-inset-2 before:content-['']"
                >
                  <span
                    className={cn(
                      "h-1 rounded-full transition-all duration-300",
                      index === active ? "w-4 bg-white" : "w-1 bg-white/40 hover:bg-white/70",
                    )}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}


export function HasilPemasanganSection({
  items,
  meta,
}: {
  items: InstallationItem[]
  meta?: { heading?: string; subtitle?: string } | null
}) {
  const seeMoreHref = routeUrl("installation.index")

  return (
    <section id="hasil-pemasangan" className="scroll-mt-20">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <SectionTitle
          title={meta?.heading?.trim() || "Hasil pemasangan"}
          actionHref={seeMoreHref}
          actionLabel="Lihat Semua →"
        />
        {items.length ? (
          <InstallationCarousel items={items} seeMoreHref={seeMoreHref} />
        ) : (
          <EmptyState
            icon="image"
            title="Dokumentasi segera hadir"
            description="Foto pemasangan sedang dikumpulkan. Sementara itu, chat kami untuk melihat contoh di kota Anda."
          />
        )}
      </div>
    </section>
  )
}

export function ApaKataPelangganSection({ testimonials }: { testimonials: Testimonial[] }) {
  const seeMoreHref = `${routeUrl("reviews")}#apa-kata-pelanggan`

  return (
    <section id="apa-kata-pelanggan" className="scroll-mt-20 bg-surface">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <SectionTitle
          title="Apa kata pelanggan kami"
          actionHref={seeMoreHref}
          actionLabel="Lihat Semua →"
        />
        {testimonials.length ? (
          <TestimonialCarousel
            testimonials={testimonials}
            seeMoreHref={seeMoreHref}
            variant="screenshot"
            navLabel="testimoni"
          />
        ) : (
          <EmptyState
            icon="message-circle"
            title="Belum ada screenshot"
            description="Screenshot Shopee/WhatsApp akan tampil di sini setelah admin menambahkan."
          />
        )}
      </div>
    </section>
  )
}

export function UlasanPelangganWebsiteSection({ testimonials }: { testimonials: Testimonial[] }) {
  const seeMoreHref = `${routeUrl("reviews")}#ulasan-website`

  return (
    <section id="ulasan-website" className="scroll-mt-20 bg-surface-muted">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <SectionTitle
          title="Ulasan pelanggan di website"
          actionHref={seeMoreHref}
          actionLabel="Lihat Semua →"
        />
        {testimonials.length ? (
          <TestimonialCarousel
            testimonials={testimonials}
            seeMoreHref={seeMoreHref}
            variant="review"
            navLabel="ulasan"
          />
        ) : (
          <EmptyState
            icon="star"
            title="Belum ada ulasan website"
            description="Ulasan dari pembeli website (teks dan/atau foto) akan tampil di sini."
          />
        )}
      </div>
    </section>
  )
}

const HELP_STEPS = [
  {
    icon: "headset",
    title: "Konsultasi sebelum produksi",
    description:
      "Tim kami bantu memilih model yang pas untuk kebutuhan dan tampilan rumah Anda.",
  },
  {
    icon: "ruler",
    title: "Kami bantu cek & konfirmasi ukuran sebelum produksi",
    description:
      "Ukuran dan opsi dicek ulang bersama Anda sebelum produksi, agar hasilnya pas di lokasi.",
  },
  {
    icon: "package",
    title: "Packing aman & pengiriman ke seluruh Indonesia",
    description:
      "Produk dikemas rapi agar aman sampai di rumah Anda, ke seluruh Indonesia.",
  },
  {
    icon: "whatsapp",
    title: "Masih ragu? Chat WhatsApp, kami bantu sampai jelas",
    description:
      "Tanya apa saja lewat WhatsApp, dari pilihan model sampai panduan pemasangan.",
  },
]

export function ClosingCTASection() {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? routeUrl("contact")

  return (
    <section id="closing-cta" className="scroll-mt-20 bg-[#1a1e1c] text-background">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 flex flex-col items-center py-7 text-center">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xs font-semibold tracking-tight text-white">Pakai produk berkualitas</p>
          <h2 className="text-balance text-[22px] font-bold leading-[1.5] tracking-tight text-background sm:text-3xl">
            Tingkatkan kualitas bangunan Anda bersama kami
          </h2>
        </div>
        <div className="mt-10 flex w-full max-w-xl flex-nowrap items-center justify-center gap-2 sm:gap-3">
          <Button asChild className="h-9 min-w-0 flex-1 whitespace-nowrap bg-background px-3 text-xs text-primary hover:bg-background/90 sm:px-6 sm:text-sm">
            <Link href={routeUrl("catalog.index")}>Pilih Model Produk</Link>
          </Button>
          <Button asChild variant="secondary" className="h-9 min-w-0 flex-1 whitespace-nowrap border border-white/40 bg-transparent px-3 text-xs text-white hover:bg-white/10 sm:px-6 sm:text-sm">
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
              Konsultasi ukuran
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function KamiBantuSection() {
  return (
    <section id="kami-bantu" className="scroll-mt-20 bg-muted/30">
      <div className="container-page !px-5 md:!px-8 lg:!px-12 py-[10px]">
        <div className="mx-auto mb-4 max-w-xl text-center md:mb-6">
          <p className="text-xs font-bold text-primary sm:text-sm">
            Masih Bingung?
          </p>
          <SectionHeading
            size="display"
            fitHeading={false}
            headingClassName="!text-[18px]"
            title={
              <>
                Kami bantu dari <span>awal sampai jadi</span>
              </>
            }
          />
        </div>

        <div className="mx-auto max-w-3xl space-y-3 sm:space-y-4 lg:max-w-none lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {HELP_STEPS.map((item) => (
            <article
              key={item.title}
              className="flex flex-row items-center gap-3 rounded-xl border border-border/60 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:gap-4 sm:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-12">
                <Icon name={item.icon} className="size-5 sm:size-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground sm:text-base">
                  {item.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>

      </div>
    </section>
  )
}
