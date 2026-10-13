import { Head, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { HelpPageFrame } from "@/components/public/help-page-frame"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { hasExampleContent, splitOptionDescription } from "@/lib/masalah-solusi-content"
import { mediaLayout, mediaLayoutClass, type MasalahSolusiMediaLayout } from "@/lib/masalah-solusi-media"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface RichSolutionOption {
  title: string
  description: string
  icon?: string
}

interface RichSolutionMedia {
  /** Media lama tanpa penanda jenis diperlakukan sebagai gambar. */
  kind?: "image" | "video"
  src: string
  alt?: string
  /** Ukuran asli aset gambar, dipakai menentukan tata letak. */
  width?: number | null
  height?: number | null
  /** Khusus video: poster dan asal berkasnya. */
  poster?: string | null
  source?: "library" | "url"
}

interface RichSolutionContent {
  type: "rich"
  examples_label?: string
  examples_hint?: string
  /** Satu daftar media berurutan, bisa gambar dan video bercampur. */
  media?: RichSolutionMedia[]
  solutions_label?: string
  lead?: string
  body?: string
  options?: RichSolutionOption[]
  whatsapp_note?: string
}

interface ProblemSolutionItem {
  id: number
  problem: string
  solution:
    | { type: "text"; content: string }
    | { type: "rich"; content: RichSolutionContent }
}

interface Guide {
  title: string
  heading: string
  subtitle: string
  items: ProblemSolutionItem[]
}

type NormalizedSolution =
  | { type: "text"; content: string }
  | { type: "rich"; content: RichSolutionContent }

function resolveSolution(raw: ProblemSolutionItem["solution"] | string | null | undefined): NormalizedSolution {
  if (!raw) {
    return { type: "text", content: "" }
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as RichSolutionContent
      if (parsed?.type === "rich") {
        return { type: "rich", content: parsed }
      }
    } catch {
      // Plain text answer from admin/CMS.
    }

    return { type: "text", content: raw }
  }

  if (raw.type === "rich" && raw.content) {
    return { type: "rich", content: raw.content }
  }

  if (raw.type === "text") {
    return { type: "text", content: String(raw.content ?? "") }
  }

  return { type: "text", content: "" }
}

/**
 * Satu media contoh pada halaman publik.
 *
 * Tata letaknya ditentukan dari ukuran asli aset yang dikirim server. Bila ukuran
 * itu belum ada, gambar diukur sendiri begitu selesai dimuat supaya tata letaknya
 * tetap benar tanpa perlu menunggu muat ulang halaman.
 */
function MediaFigure({ photo }: { photo: RichSolutionMedia }) {
  const [terukur, setTerukur] = React.useState<MasalahSolusiMediaLayout | null>(null)
  const layout = mediaLayout(photo.width, photo.height) ?? terukur

  return (
    <figure className={"min-w-0 " + mediaLayoutClass(layout)}>
      <img
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        onLoad={(event) => {
          const img = event.currentTarget
          setTerukur(mediaLayout(img.naturalWidth, img.naturalHeight))
        }}
        className="w-full rounded-lg border border-border bg-muted object-contain"
      />
      {photo.alt ? (
        <figcaption className="mt-1.5 text-xs leading-5 text-muted-foreground">
          {photo.alt}
        </figcaption>
      ) : null}
    </figure>
  )
}

function MediaVideo({ media }: { media: RichSolutionMedia }) {
  return (
    <figure className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon name="video" className="size-4" aria-hidden="true" />
        Video
      </div>
      {media.source === "library" ? (
        /* Berkas video dari Media Library: diputar langsung di halaman. */
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <video
            src={media.src}
            poster={media.poster ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="max-h-[min(70dvh,32rem)] w-full bg-black object-contain"
          />
        </div>
      ) : (
        /* Tautan luar (mis. YouTube): dibuka di tab baru dengan pratinjau poster. */
        <a
          href={media.src}
          target="_blank"
          rel="noreferrer"
          className="group relative block overflow-hidden rounded-lg border border-border bg-muted"
        >
          {media.poster ? (
            <ResponsiveImage
              src={media.poster}
              alt="Video contoh kondisi kerusakan"
              wrapperClassName="aspect-video"
              className="object-cover transition group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-muted">
              <Icon name="video" className="size-10 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/20">
            <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface/95 text-primary shadow-sm">
              <Icon name="caret-right" className="size-5" weight="fill" aria-hidden="true" />
            </span>
          </span>
        </a>
      )}
      {media.alt ? (
        <figcaption className="mt-1.5 text-xs leading-5 text-muted-foreground">{media.alt}</figcaption>
      ) : null}
    </figure>
  )
}

/**
 * Panel isi satu item di halaman publik.
 *
 * Diekspor supaya test DOM bisa merender panel ini langsung dari payload tanpa
 * menjalankan halaman penuh beserta layout publiknya.
 */
export function RichSolutionPanel({
  content,
  whatsappUrl,
}: {
  content: RichSolutionContent
  whatsappUrl: string | null
}) {
  const media = content.media ?? []
  const options = content.options ?? []
  const body = (content.body ?? "").trim()

  return (
    <div className="grid min-w-0 gap-6">
      {/* Judul bagian contoh hanya tampil bila memang ada isinya. Judul ini
          punya nilai bawaan di form admin, jadi tanpa penjaga ini item yang
          belum punya media maupun teks pengganti menampilkan judul menggantung
          tanpa apa pun di bawahnya. */}
      {hasExampleContent(content) ? (
        <div>
          <p className="text-sm font-bold text-foreground">
            {content.examples_label ?? "Contoh kondisi kerusakan"}
          </p>

          {media.length ? (
            /* Satu daftar berurutan mengikuti pilihan admin (kontrak owner
               2026-09-30): media tidak lagi dipisah foto dan video, jadi urutan
               di sini sama dengan urutan di form. Tata letak gambar mengikuti
               bentuk aslinya (kontrak 2026-09-20): banner dan landscape berdiri
               sendiri selebar penuh, persegi atau tegak dipasangkan berjejer.
               Video selalu selebar penuh karena butuh ruang putar. */
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3">
              {media.map((item, index) => {
                const kunci = `${item.kind ?? "image"}-${item.src}-${index}`

                if (item.kind === "video") {
                  return (
                    <div key={kunci} className="col-span-2 min-w-0">
                      <MediaVideo media={item} />
                    </div>
                  )
                }

                return <MediaFigure key={kunci} photo={item} />
              })}
            </div>
          ) : content.examples_hint ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.examples_hint}</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-primary/15 bg-accent/35 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-surface text-primary">
            <Icon name="shield-check" className="size-5" weight="bold" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">
              {content.solutions_label ?? "Solusi yang kami tawarkan"}
            </p>
            {content.lead ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{content.lead}</p>
            ) : null}
          </div>
        </div>

        {/* Kontrak owner 2026-10-01: teks solusi SELALU tampil, juga saat item
            memakai daftar opsi. Sebelumnya daftar opsi menutup teks ini sehingga
            naskah yang sudah ditulis admin tidak pernah terbaca pelanggan
            padahal tersimpan di database dan tampil di kolom Solusi di daftar
            admin. */}
        {body ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{body}</p>
        ) : null}

        {options.length ? (
          <ol className="mt-4 grid gap-4">
            {options.map((option, index) => (
              <li key={`${index}-${option.title}`} className="flex gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon
                    name={option.icon ?? "check-circle"}
                    className="size-4"
                    weight="bold"
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">
                    {index + 1}. {option.title}
                  </p>
                  {/* Kontrak owner 2026-10-01: nomor WhatsApp yang ditulis di
                      keterangan opsi menjadi tombol CTA, sisanya tetap teks. */}
                  {splitOptionDescription(option.description).map((segmen, segmenIndex) =>
                    segmen.kind === "phone" ? (
                      <Button key={`wa-${segmenIndex}`} asChild variant="primary" size="sm" className="mt-2">
                        <a href={segmen.href} target="_blank" rel="noreferrer">
                          <Icon name="whatsapp" className="size-4 shrink-0" aria-hidden="true" />
                          {segmen.display}
                        </a>
                      </Button>
                    ) : (
                      <p key={`teks-${segmenIndex}`} className="mt-1 text-sm leading-6 text-muted-foreground">
                        {segmen.text}
                      </p>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {content.whatsapp_note ? (
          <p className="mt-4 border-t border-primary/10 pt-4 text-sm leading-6 text-muted-foreground">
            {whatsappUrl && content.whatsapp_note.includes("WhatsApp") ? (
              <>
                {content.whatsapp_note.split("WhatsApp")[0]}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-whatsapp underline-offset-2 hover:underline"
                >
                  WhatsApp
                </a>
                {content.whatsapp_note.split("WhatsApp").slice(1).join("WhatsApp")}
              </>
            ) : (
              content.whatsapp_note
            )}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function MasalahSolusi({ guide }: { guide?: Guide }) {
  const { consultationWhatsApp } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const guideItems = guide?.items
  const items = React.useMemo(() => guideItems ?? [], [guideItems])
  const [openId, setOpenId] = React.useState<number | null>(null)

  React.useEffect(() => {
    // Jaga pilihan tetap valid saat konten CMS berubah (semua tertutup secara default,
    // konsisten dengan halaman FAQ - tidak ada item yang otomatis terbuka).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId((current) => (current !== null && items.some((item) => item.id === current) ? current : null))
  }, [items])

  const pageTitle = guide?.title ?? "Masalah & Solusi"
  const pageHeading = guide?.heading ?? "Masalah & Solusi"
  const pageSubtitle = guide?.subtitle ?? "Temukan solusi untuk masalah yang mungkin Anda hadapi."

  return (
    <PublicLayout>
      <Head title={pageTitle}>
        <meta
          name="description"
          content={pageSubtitle || "Kendala umum pemasangan dan solusi produk aluminium Ragil."}
        />
      </Head>

      <HelpPageFrame
        title={pageHeading}
        breadcrumbs={[
          { label: "Beranda", href: routeUrl("home") },
          { label: "Masalah & solusi", href: null },
        ]}
        subtitle={pageSubtitle || "Temukan solusi untuk masalah yang mungkin Anda hadapi."}
      >
        <div>
          {items.length ? (
            <ul className="overflow-hidden rounded-lg border border-border bg-surface">
              {items.map((item, index) => {
                const open = openId === item.id
                const panelId = `masalah-panel-${item.id}`
                const solution = resolveSolution(item.solution)

                return (
                  <li key={item.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
                      onClick={() => setOpenId(open ? null : item.id)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      id={`masalah-trigger-${item.id}`}
                    >
                      <span className="flex min-w-0 items-start gap-3">
                        <span className="tabular-nums mt-0.5 text-xs font-bold text-primary/70">{String(index + 1).padStart(2, "0")}</span>
                        <span className="text-sm font-semibold leading-5 text-foreground">{item.problem}</span>
                      </span>
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${open ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted-foreground"}`}>
                        <Icon name={open ? "chevron-up" : "chevron-down"} className="size-3.5" aria-hidden="true" />
                      </span>
                    </button>

                    {open ? (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={`masalah-trigger-${item.id}`}
                        className="border-t border-border bg-surface-muted/45 px-4 pb-4 pt-3 sm:px-5"
                      >
                        {solution.type === "rich" ? (
                          <RichSolutionPanel content={solution.content} whatsappUrl={whatsappUrl} />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {solution.content}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState
              title="Panduan belum tersedia"
              description="Panduan masalah dan solusi belum diisi. Sementara itu, chat WhatsApp untuk konsultasi."
              className="mx-auto max-w-lg"
            />
          )}

        </div>
      </HelpPageFrame>

      <ClosingCTASection
        pageKey="masalah-solusi"
        compact={false}
        eyebrow="Masih ragu spesifikasi yang tepat?"
        heading="Tim kami siap bantu memilih model & ukuran yang sesuai kebutuhan Anda, gratis tanpa komitmen"
        actions={[
          {
            label: "Konsultasi WhatsApp",
            href: whatsappUrl ?? routeUrl("contact"),
            variant: "primary",
            whatsappIcon: true,
            external: true,
          },
          { label: "Lihat FAQ", href: routeUrl("faq"), variant: "secondary" },
        ]}
      />
    </PublicLayout>
  )
}
