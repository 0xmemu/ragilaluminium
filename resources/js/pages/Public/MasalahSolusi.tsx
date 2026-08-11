import { Head, Link, usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

interface RichSolutionOption {
  title: string
  description: string
  icon?: string
}

interface RichSolutionPhoto {
  src: string
  alt: string
}

interface RichSolutionVideo {
  src: string
  poster?: string
  duration?: string
}

interface RichSolutionContent {
  type: "rich"
  examples_label?: string
  examples_hint?: string
  photos?: RichSolutionPhoto[]
  video?: RichSolutionVideo | null
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

function RichSolutionPanel({
  content,
  whatsappUrl,
}: {
  content: RichSolutionContent
  whatsappUrl: string | null
}) {
  const photos = content.photos ?? []
  const options = content.options ?? []

  return (
    <div className="grid min-w-0 gap-6">
      <div>
        <p className="text-sm font-bold text-foreground">
          {content.examples_label ?? "Contoh kondisi kerusakan"}
        </p>

        {photos.length ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {photos.map((photo) => (
              <ResponsiveImage
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                wrapperClassName="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted"
                className="object-cover"
              />
            ))}
          </div>
        ) : content.examples_hint ? (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.examples_hint}</p>
        ) : null}

        {content.video?.src ? (
          <div className="mt-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Icon name="video" className="size-4" aria-hidden="true" />
              Video
            </p>
            <a
              href={content.video.src}
              target="_blank"
              rel="noreferrer"
              className="group relative block overflow-hidden rounded-lg border border-border bg-muted"
            >
              {content.video.poster ? (
                <ResponsiveImage
                  src={content.video.poster}
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
              {content.video.duration ? (
                <span className="tabular-nums absolute bottom-2 right-2 rounded bg-foreground/75 px-2 py-0.5 text-xs font-semibold text-background">
                  {content.video.duration}
                </span>
              ) : null}
            </a>
          </div>
        ) : null}
      </div>

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

        {options.length ? (
          <ol className="mt-4 grid gap-4">
            {options.map((option, index) => (
              <li key={option.title} className="flex gap-3">
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
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : content.body ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{content.body}</p>
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
                  className="font-semibold text-[#25D366] underline-offset-2 hover:underline"
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
  const [openId, setOpenId] = React.useState<number | null>(items[0]?.id ?? null)

  React.useEffect(() => {
    if (openId !== null && !items.some((item) => item.id === openId)) {
      // Keep the accordion selection valid when CMS content changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenId(items[0]?.id ?? null)
    }
  }, [items, openId])

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

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden py-2 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Masalah & solusi", href: null },
            ]}
          />
        </div>
        <div className="container-page py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="arrow-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              {pageHeading}
            </h1>
          </div>
        </div>
      </section>

      <section className="py-4 lg:py-6">
        <div className="container-page">
          {items.length ? (
            <ol className="mx-auto grid max-w-3xl gap-3">
              {items.map((item, index) => {
                const open = openId === item.id
                const panelId = `masalah-panel-${item.id}`
                const solution = resolveSolution(item.solution)

                return (
                  <li key={item.id} className="overflow-hidden border border-border bg-surface">
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5"
                      onClick={() => setOpenId(open ? null : item.id)}
                      aria-expanded={open}
                      aria-controls={panelId}
                      id={`masalah-trigger-${item.id}`}
                    >
                      <span
                        className={cn(
                          "tabular-nums flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          open ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold text-foreground sm:text-lg">
                        {item.problem}
                      </span>
                      <Icon
                        name={open ? "chevron-up" : "chevron-down"}
                        className={cn(
                          "size-4 shrink-0",
                          open ? "text-primary" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {open ? (
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={`masalah-trigger-${item.id}`}
                        className="border-t border-border px-4 pb-5 pt-4 sm:px-5"
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
            </ol>
          ) : (
            <EmptyState
              title="Konten segera hadir"
              description="Tim kami sedang menyusun panduan masalah & solusi. Sementara itu, chat WhatsApp untuk konsultasi."
              className="mx-auto max-w-lg"
            />
          )}

          <div className="mx-auto mt-12 max-w-xl text-center">
            <p className="text-sm text-muted-foreground">Masih ragu spesifikasi yang tepat?</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button asChild variant="secondary" className="px-4 sm:px-6">
                <Link href={routeUrl("faq")}>Lihat FAQ</Link>
              </Button>
              <Button asChild className="px-4 sm:px-6">
                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                    Konsultasi WhatsApp
                  </a>
                ) : (
                  <Link href={routeUrl("contact")}>Hubungi kami</Link>
                )}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
