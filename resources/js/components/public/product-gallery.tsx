import * as React from "react"

import { GalleryLightbox } from "@/components/public/gallery-lightbox"
import { Icon } from "@/components/shared/icon"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { cn } from "@/lib/utils"
import type { ProductMedia } from "@/types"

/**
 * Galeri produk: strip horizontal sejajar dengan swipe real-time, thumbnail,
 * panah prev/next, dan lightbox. Semua state galeri (index, drag, lightbox)
 * hidup di sini - ProductDetail cukup mengirim `items` + judul.
 */
export function ProductGallery({
  items,
  title,
  onActiveMediaChange,
  highlightedMediaId,
}: {
  items: ProductMedia[]
  title: string
  /** Lapor media yang sedang dilihat ke parent (dipakai animasi fly saat add-to-cart). */
  onActiveMediaChange?: (media: ProductMedia | null) => void
  /** Foto varian yang ditonjolkan (urutan galeri TIDAK diubah). */
  highlightedMediaId?: string | number | null
}) {
  const [activeMediaIndex, setActiveMediaIndex] = React.useState(0)
  const [lightboxIndex, setLightboxIndex] = React.useState(-1)
  // Strip carousel: index thumb paling kiri yang terlihat di viewport strip.
  const [leftVisibleIndex, setLeftVisibleIndex] = React.useState(0)
  const stripRef = React.useRef<HTMLDivElement>(null)
  const stripScrollProgrammatic = React.useRef(false)
  const stripSnapTimer = React.useRef<number | null>(null)
  const userStripScrollAt = React.useRef(0)
  const stripProgrammaticTimer = React.useRef<number | undefined>(undefined)
  // 5 thumb terlihat di mobile; desktop aman karena scroll strip tak aktif di lg.
  const visibleThumbs = 5
  const STRIP_GAP = 8
  const STRIP_PAD = 10
  // Lebar thumb dihitung dari lebar strip nyata supaya PERSIS 5 terlihat:
  // (lebarDalam - 4*gap) / 5. Simpan via state -> inline style CSS var.
  const [thumbW, setThumbW] = React.useState(56)
  const THUMB_STEP = thumbW + STRIP_GAP

  // Ukur lebar wrapper strip: thumb = floor((lebarWrapper - padL - padR -
  // (n-1)*gap) / n). Floor menjamin 5 thumb PENUH terlihat tanpa terpotong,
  // dan thumb ke-6 mulai DI LUAR area terlihat (tidak bocor).
  React.useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    const wrapper = strip.parentElement
    if (!wrapper) return
    const measure = () => {
      // Area konten yang terlihat = lebar strip (clip di stripRight) dikurangi
      // padding kiri. Floor menjamin 5 thumb utuh dan sisanya di luar clip.
      const inner = strip.clientWidth - STRIP_PAD
      const w = Math.floor((inner - (visibleThumbs - 1) * STRIP_GAP) / visibleThumbs)
      setThumbW(Math.max(40, w))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lightboxItems = React.useMemo(
    () =>
      items
        .filter((item) => Boolean(item.url))
        .map((item) => ({
          src: item.url!,
          alt: `${title}, ${item.is_video ? "video" : "foto"} ${item.id}`,
          is_video: Boolean(item.is_video),
        })),
    [items, title],
  )

  // Swipe galeri - pakai touch events native + drag real-time.
  const [galleryDrag, setGalleryDrag] = React.useState(0)
  const [galleryDragging, setGalleryDragging] = React.useState(false)
  const galleryStartX = React.useRef(0)
  const [galleryWidth, setGalleryWidth] = React.useState(0)
  const galleryRef = React.useRef<HTMLDivElement>(null)
  const didSwipe = React.useRef(false)

  // Ref untuk drag real-time TANPA setState per frame (re-render per move bikin jank).
  const galleryDragRef = React.useRef(0)
  const galleryTrackRef = React.useRef<HTMLDivElement | null>(null)
  const galleryLastX = React.useRef(0)
  const galleryLastT = React.useRef(0)
  const galleryVelocity = React.useRef(0)

  /** Terapkan transform langsung ke DOM: drag + damping di ujung kiri/kanan. */
  function applyGalleryTransform(dx: number) {
    const track = galleryTrackRef.current
    if (!track) return
    const atStart = activeMediaIndex === 0
    const atEnd = activeMediaIndex === items.length - 1
    let effective = dx
    if ((atStart && dx > 0) || (atEnd && dx < 0)) {
      // Rubber-band: 1/3 dari jarak di ujung.
      effective = dx / 3
    }
    const base = -(activeMediaIndex * 100)
    const pct = galleryWidth ? (effective / galleryWidth) * 100 : 0
    track.style.transform = `translateX(calc(${base}% + ${pct}%))`
  }

  function onGalleryTouchStart(event: React.TouchEvent) {
    if (items.length <= 1) return
    const t = event.touches[0]
    galleryStartX.current = t.clientX
    galleryLastX.current = t.clientX
    galleryLastT.current = performance.now()
    galleryVelocity.current = 0
    setGalleryWidth(galleryRef.current?.clientWidth ?? 0)
    didSwipe.current = false
    setGalleryDragging(true)
    setGalleryDrag(0)
    galleryDragRef.current = 0
    if (galleryTrackRef.current) galleryTrackRef.current.style.transition = 'none'
  }

  function onGalleryTouchMove(event: React.TouchEvent) {
    if (!galleryDragging) return
    const dx = event.touches[0].clientX - galleryStartX.current
    if (Math.abs(dx) > 8) didSwipe.current = true
    galleryDragRef.current = dx
    // velocity px/ms untuk deteksi flick
    const now = performance.now()
    const dt = now - galleryLastT.current
    if (dt > 0) {
      galleryVelocity.current = (event.touches[0].clientX - galleryLastX.current) / dt
      galleryLastX.current = event.touches[0].clientX
      galleryLastT.current = now
    }
    applyGalleryTransform(dx)
  }

  function onGalleryTouchEnd() {
    if (!galleryDragging) return
    setGalleryDragging(false)
    const dx = galleryDragRef.current
    const threshold = galleryWidth * 0.2
    // Flick: geser cepat (|v| > 0.5 px/ms) dengan jarak minimal 24px tetap pindah.
    const flick = Math.abs(galleryVelocity.current) > 0.5 && Math.abs(dx) > 24
    if (Math.abs(dx) > threshold || flick) {
      moveGallery(galleryDrag < 0 || dx < 0 ? 1 : -1)
    } else {
      // Kembali ke posisi aktif (bukan nol) dengan transisi halus.
      if (galleryTrackRef.current) galleryTrackRef.current.style.transition = ''
      applyGalleryTransform(0)
    }
    setGalleryDrag(0)
    galleryDragRef.current = 0
  }

  function moveGallery(direction: -1 | 1) {
    setActiveMediaIndex((current) => {
      const next = current + direction
      return Math.min(Math.max(next, 0), items.length - 1)
    })
  }

  const activeMedia = items[activeMediaIndex] ?? items[0] ?? null

  React.useEffect(() => {
    onActiveMediaChange?.(activeMedia)
  }, [activeMedia, onActiveMediaChange])

  React.useEffect(() => {
    if (activeMediaIndex >= items.length) {
      // Clamp saat varian terpilih punya lebih sedikit foto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveMediaIndex(Math.max(0, items.length - 1))
    }
  }, [activeMediaIndex, items.length])

  // Desain owner (09-05): klik varian TIDAK mengubah urutan galeri. Varian
  // dengan foto khusus hanya MENONJOLKAN fotonya: strip digulir ke foto itu
  // dan foto itu jadi foto aktif. Varian tanpa foto khusus: galeri tetap di
  // posisi sekarang (tidak melompat).
  React.useEffect(() => {
    if (highlightedMediaId == null) {
      return
    }
    const idx = items.findIndex((item) => item.id === highlightedMediaId)
    if (idx === -1 || idx === activeMediaIndex) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveMediaIndex(idx)
    // Tidak perlu scrollIntoView di sini: effect sinkronisasi dua arah di
    // bawah sudah menggulir strip ke thumb aktif. Dua scroll bersamaan yang
    // dulu menyebabkan main image loncat ke foto terakhir.
  }, [highlightedMediaId, items, activeMediaIndex])

  // Geser strip (user swipe): deteksi thumb paling kiri yang terlihat. Jika
  // berubah karena geseran user (bukan programmatic), main image pindah ke
  // thumb yang BARU masuk dari arah geser (kontrak owner 09-05).
  const onStripScroll = () => {
    const strip = stripRef.current
    if (!strip) return
    if (!stripScrollProgrammatic.current) {
      userStripScrollAt.current = Date.now()
    }
    const idx = Math.round(strip.scrollLeft / THUMB_STEP)
    const clamped = Math.max(0, Math.min(idx, items.length - visibleThumbs))
    if (stripScrollProgrammatic.current) {
      // Programmatic scroll (dari effect sinkronisasi/snap): abaikan sbg input
      // user; flag dibersihkan oleh timeout setelah animasi selesai.
      setLeftVisibleIndex(clamped)
      return
    }
    setLeftVisibleIndex((prev) => {
      // Satu geseran = SATU langkah, apapun jarak scrollnya: delta dibatasi 1.
      const step = clamped > prev ? 1 : clamped < prev ? -1 : 0
      if (step === 1) {
        // Geser kiri: main image ke thumb yang baru masuk dari kanan.
        const target = Math.min(prev + visibleThumbs, items.length - 1)
        setActiveMediaIndex(target)
      } else if (step === -1) {
        // Geser kanan: main image ke thumb yang baru masuk dari kiri.
        setActiveMediaIndex(Math.max(prev - 1, 0))
      }
      return Math.max(0, Math.min(prev + step, items.length - visibleThumbs))
    })
    // Snap ke kelipatan terdekat setelah user berhenti menggeser (150ms),
    // supaya satu geseran = tepat satu thumb (kontrak owner 09-05).
    if (stripSnapTimer.current) window.clearTimeout(stripSnapTimer.current)
    stripSnapTimer.current = window.setTimeout(() => {
      const el = stripRef.current
      if (!el) return
      const target = Math.round(el.scrollLeft / THUMB_STEP) * THUMB_STEP
      const max = el.scrollWidth - el.clientWidth
      const snapped = Math.max(0, Math.min(target, max))
      if (Math.abs(el.scrollLeft - snapped) > 1) {
        el.scrollTo({ left: snapped, behavior: 'smooth' })
      }
    }, 150)
  }

  // Strip mengikuti foto aktif (sinkronisasi dua arah): saat main image
  // di-swipe/ubah varian/thumb di-tap, strip tergulir agar thumb aktif
  // terlihat - tanpa memicu logika geser (programmatic guard).
  React.useEffect(() => {
    const strip = stripRef.current
    if (!strip) return
    // Jangan ganggu strip saat user masih menggesernya (interaksi berlangsung
    // atau snap timer belum selesai) - ini yang dulu membuat scroll user
    // selalu di-reset dan main image loncat-loncat.
    if (Date.now() - userStripScrollAt.current < 400) return
    const btns = strip.querySelectorAll('button')
    const target = btns[activeMediaIndex]
    if (!target) return
    const offset = activeMediaIndex * THUMB_STEP
    const maxScroll = strip.scrollWidth - strip.clientWidth
    const desired = Math.min(offset, Math.max(0, maxScroll))
    if (Math.abs(strip.scrollLeft - desired) > 2) {
      stripScrollProgrammatic.current = true
      window.clearTimeout(stripProgrammaticTimer.current)
      stripProgrammaticTimer.current = window.setTimeout(() => {
        stripScrollProgrammatic.current = false
      }, 600)
      strip.scrollTo({ left: desired, behavior: 'smooth' })
    }
    setLeftVisibleIndex(Math.round(desired / THUMB_STEP))
  }, [activeMediaIndex, items.length])

  return (
    <div className="group/gallery -mx-2.5 min-w-0 overflow-x-clip sm:-mx-8 lg:mx-0" aria-label="Galeri produk">
      {activeMedia ? (
        <>
          <div
            data-gallery-main
            ref={galleryRef}
            onTouchStart={onGalleryTouchStart}
            onTouchMove={onGalleryTouchMove}
            onTouchEnd={onGalleryTouchEnd}
            onTouchCancel={onGalleryTouchEnd}
            className="relative mx-auto aspect-square w-full overflow-hidden bg-white"
          >
            {/* Horizontal strip: semua gambar sejajar - swipe real-time */}
            <div
              ref={galleryTrackRef}
              className="flex h-full touch-pan-y will-change-transform"
              onClick={(event) => {
                if (!didSwipe.current && event.target === event.currentTarget) setLightboxIndex(activeMediaIndex)
              }}
              style={{
                transform: `translateX(${-activeMediaIndex * 100 + (galleryWidth && galleryDrag ? (galleryDrag / galleryWidth) * 100 : 0)}%)`,
                transition: galleryDragging ? 'none' : 'transform 320ms cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {items.map((item, index) => (
                <div key={item.id} className="flex h-full w-full shrink-0 items-center justify-center bg-white">
                  {item.is_video ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!didSwipe.current) setLightboxIndex(index)
                      }}
                      className="relative size-full select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      aria-label={`Perbesar video produk ${index + 1}`}
                    >
                      <img
                        src={item.thumb ?? ""}
                        alt={`${title}, video ${index + 1}`}
                        loading={index <= activeMediaIndex + 1 ? "eager" : "lazy"}
                        className="size-full bg-white object-contain"
                      />
                      <span className="absolute inset-0 z-10 flex items-center justify-center">
                        <span className="flex size-14 items-center justify-center rounded-full bg-foreground/70 text-background shadow-lg transition-transform group-hover/gallery:scale-105">
                          <Icon name="play" className="size-6" weight="fill" aria-hidden="true" />
                        </span>
                      </span>
                    </button>
                  ) : (
                    <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      if (!didSwipe.current) setLightboxIndex(index)
                    }}
                    className="relative size-full select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`Perbesar foto produk ${index + 1}`}
                  >
                    <ResponsiveImage
                      src={item.url}
                      alt={`${title}, foto ${index + 1}`}
                      loading={index <= activeMediaIndex + 1 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : undefined}
                      wrapperClassName="size-full bg-white"
                      className="!object-contain"
                    />
                      </button>
                  )}

                </div>
              ))}
            </div>

            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => moveGallery(-1)}
                  disabled={activeMediaIndex === 0}
                  aria-label="Lihat foto sebelumnya"
                  className="absolute left-2 top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-left-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                >
                  <Icon name="arrow-left" className="size-6" weight="bold" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveGallery(1)}
                  disabled={activeMediaIndex === items.length - 1}
                  aria-label="Lihat foto berikutnya"
                  className="absolute right-2 top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-muted-foreground text-white opacity-100 shadow-md transition-[opacity,background-color] hover:bg-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed md:-right-14 md:flex md:size-12 md:opacity-0 md:group-hover/gallery:opacity-100 md:group-focus-within/gallery:opacity-100 md:group-hover/gallery:disabled:opacity-35 md:group-focus-within/gallery:disabled:opacity-35"
                >
                  <Icon name="arrow-right" className="size-6" weight="bold" aria-hidden="true" />
                </button>
              </>
            ) : null}

          {items.length > 1 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                if (!didSwipe.current) setLightboxIndex(activeMediaIndex)
              }}
              data-gallery-counter="1" className="absolute bottom-2 right-2 z-20 inline-flex items-center rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-bold tabular-nums text-foreground shadow-md backdrop-blur-sm transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Buka foto ${activeMediaIndex + 1} dari ${items.length}`}
            >
              {activeMediaIndex + 1}/{items.length}
            </button>
          ) : null}
          </div>

          {items.length > 1 ? (
            <div
              ref={stripRef}
              onScroll={onStripScroll}
              data-gallery-strip
              className="mt-2 flex w-[calc(100%-0px)] max-w-[calc(100vw-20px)] gap-2 overflow-x-auto scroll-smooth pr-0 pl-2.5 pb-2 sm:px-8 lg:px-0 [scroll-padding-left:10px] -mx-2.5 w-[calc(100%+20px)]"
              style={{ "--thumb-w": thumbW + "px" } as React.CSSProperties}
              aria-label="Pilih foto produk"
            >
              {/* Desain owner (09-05): strip carousel geser, tampil 5 thumb
                  sekaligus, isi SEMUA foto. Geser = thumb keluar/masuk satu per
                  satu, main image ikut pindah ke thumb yang baru masuk. Chip
                  kiri/kanan = keterangan foto tersembunyi di arah tersebut. */}
              {items.map((item, index) => {
                // Chip +N dinamis (kontrak owner 09-05): kiri = jumlah thumb
                // yang sudah keluar di kiri, kanan = jumlah yang belum terlihat
                // di kanan. Keduanya mengikuti posisi strip saat ini.
                const leftHidden = leftVisibleIndex
                const rightHidden = items.length - (leftVisibleIndex + visibleThumbs)
                const showLeftBadge = leftHidden > 0 && index === leftVisibleIndex
                const showRightBadge = rightHidden > 0 && index === leftVisibleIndex + visibleThumbs - 1
                return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setActiveMediaIndex(index)
                  }}
                  aria-label={`Tampilkan foto ${index + 1}`}
                  aria-current={activeMediaIndex === index ? "true" : undefined}
                  className={cn(
                    "relative aspect-square w-[var(--thumb-w)] min-w-[var(--thumb-w)] shrink-0 snap-start overflow-hidden rounded-[3px] border-2 bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:size-12",
                    activeMediaIndex === index
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  {item.is_video ? (
                    <>
                      <img src={item.thumb ?? item.url ?? ""} alt="" className="size-full bg-white object-contain" loading="lazy" />
                      <span className="absolute inset-0 z-10 flex items-center justify-center">
                        <span className="flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background">
                          <Icon name="play" className="size-3" weight="fill" aria-hidden="true" />
                        </span>
                      </span>
                    </>
                  ) : (
                    <ResponsiveImage
                      src={item.thumb ?? item.url}
                      alt=""
                      wrapperClassName="size-full bg-white"
                      className="object-contain"
                    />
                  )}
                  {showLeftBadge ? (
                    <span data-gallery-more-left="1" className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/60 text-sm font-bold text-white">
                      +{leftHidden}
                    </span>
                  ) : null}
                  {showRightBadge ? (
                    <span data-gallery-more-count="1" className="absolute inset-0 z-20 flex items-center justify-center bg-foreground/60 text-sm font-bold text-white">
                      +{rightHidden}
                    </span>
                  ) : null}

                </button>
                )
              })}
              {/* Spacer kanan: saat mentok, thumb terakhir menyentuh tepi
                  viewport - tidak ada space putih stuck. */}
              <div aria-hidden="true" className="shrink-0" style={{ width: thumbW + STRIP_PAD }} />
            </div>
          ) : null}

          <p className="sr-only" aria-live="polite">
            Foto {activeMediaIndex + 1} dari {items.length}
          </p>
        </>
      ) : (
        <EmptyState
          icon="image"
          title="Foto belum tersedia"
          description="Foto produk akan tampil setelah media selesai diunggah."
        />
      )}

      {lightboxItems.length ? (
        <GalleryLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onOpenChange={(open) => { if (!open) setLightboxIndex(-1) }}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
    </div>
  )
}
