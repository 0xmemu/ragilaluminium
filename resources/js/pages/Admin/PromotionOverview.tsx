import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber, formatRentangTanggal, formatRentangWaktu } from "@/lib/format"

/**
 * Seluruh kartu ringkasan bisa diklik (owner 2026-09-29). Klik pada tautan,
 * tombol, dan input di dalam kartu tetap ditangani elemennya sendiri; sisanya
 * membuka tujuan kartu.
 */
function klikKartu(event: React.MouseEvent, href: string) {
  const target = event.target as HTMLElement
  if (target.closest("button, a, input, [data-no-select]")) return
  router.visit(href)
}
import { cn } from "@/lib/utils"

interface CampaignRow {
  id: number
  name: string
  type: string
  type_label: string
  status: string
  live: boolean
  scheduled: boolean
  discount_percent: number
  starts_at: string | null
  ends_at: string | null
  products_count: number
  detail_href: string
}

interface VoucherRow {
  id: number
  name: string
  code: string
  discount_label: string
  ends_at: string | null
}

interface BannerRow {
  id: number
  title: string
  link_url: string | null
}

interface AnnouncementRow {
  id: number
  text: string
  starts_at: string | null
  ends_at: string | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Terjadwal",
  active: "Aktif",
  ended: "Diakhiri",
  finished: "Selesai",
}

/**
 * Bahasa visual per jenis kampanye, disamakan dengan kartu ringkasan di atas
 * halaman ini: Flash Sale memakai aksen sale + ikon kilat, Diskon Reguler
 * memakai aksen primary + ikon persen. Dipakai supaya kedua jenis tidak
 * tertukar saat berdampingan dalam satu grid.
 */
const CAMPAIGN_ACCENTS: Record<string, { icon: string; chip: string; text: string; stripe: string; ring: string }> = {
  flash_sale: {
    icon: "zap",
    chip: "bg-sale/10 text-sale",
    text: "text-sale",
    stripe: "bg-sale",
    ring: "ring-sale/25",
  },
  store: {
    icon: "ticket-percent",
    chip: "bg-primary/10 text-primary",
    text: "text-primary",
    stripe: "bg-primary/70",
    ring: "ring-primary/20",
  },
}

function formatDay(iso: string | null): string {
  if (!iso) return "Tanpa batas"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Tanpa batas"
  return date.toLocaleDateString("id-ID", { dateStyle: "medium" })
}

function CountCard({
  label,
  value,
  icon,
  href,
  accent,
}: {
  label: string
  value: number
  icon: string
  href: string
  accent: "primary" | "sale" | "secondary"
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-soft transition hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md",
          accent === "primary" && "bg-primary/10 text-primary",
          accent === "sale" && "bg-sale/10 text-sale",
          accent === "secondary" && "bg-secondary text-secondary-foreground",
        )}
      >
        <Icon name={icon} className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold tabular-nums leading-none text-foreground">{formatNumber(value)}</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground group-hover:text-foreground">{label}</p>
      </div>
    </Link>
  )
}

export default function PromotionOverview({
  title,
  description,
  counts,
  campaigns = [],
  vouchers = [],
  banners = [],
  announcements = [],
  storeUrl,
  flashSaleUrl,
  vouchersUrl,
  bannersUrl,
  announcementsUrl,
  createStoreUrl,
  createFlashSaleUrl,
}: {
  title: string
  description: string
  counts: {
    diskon_reguler: number
    flash_sale: number
    voucher: number
    banner: number
    bar_promo: number
  }
  campaigns: CampaignRow[]
  vouchers: VoucherRow[]
  banners: BannerRow[]
  announcements: AnnouncementRow[]
  storeUrl: string
  flashSaleUrl: string
  vouchersUrl: string
  bannersUrl: string
  announcementsUrl: string
  /** Form buat kampanye; dipakai tombol di keadaan kosong. */
  createStoreUrl?: string
  createFlashSaleUrl?: string
}) {
  // Ringkasan hanya menampilkan kampanye yang berjalan atau terjadwal.
  // Draft/diakhiri/selesai dikelola di tab Diskon Reguler dan Flash Sale.
  const runningCampaigns = campaigns.filter((campaign) => campaign.live || campaign.scheduled)

  return (
    <AdminLayout
      title={title}
      description={description}
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <CountCard label="Diskon Reguler berjalan" value={counts.diskon_reguler} icon="ticket-percent" href={storeUrl} accent="primary" />
          <CountCard label="Flash Sale berjalan" value={counts.flash_sale} icon="zap" href={flashSaleUrl} accent="sale" />
          <CountCard label="Voucher berlaku" value={counts.voucher} icon="voucher" href={vouchersUrl} accent="secondary" />
          <CountCard label="Banner terbit" value={counts.banner} icon="megaphone" href={bannersUrl} accent="secondary" />
          <CountCard label="Bar Promo aktif" value={counts.bar_promo} icon="message-square" href={announcementsUrl} accent="secondary" />
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Kampanye diskon</h2>

          {campaigns.length === 0 ? (
            <Card className="border border-border bg-card">
              <EmptyState
                icon="ticket-percent"
                title="Belum ada kampanye diskon"
                description="Buat Diskon Reguler untuk potongan berkelanjutan, atau Flash Sale untuk diskon ekstra jangka pendek."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Link
                      href={createStoreUrl ?? storeUrl}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-soft transition hover:bg-primary-hover"
                    >
                      <Icon name="ticket-percent" className="size-4" aria-hidden="true" />
                      Buat Diskon Reguler
                    </Link>
                    <Link
                      href={createFlashSaleUrl ?? flashSaleUrl}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-xs font-medium text-foreground shadow-soft transition hover:bg-muted"
                    >
                      <Icon name="zap" className="size-4" aria-hidden="true" />
                      Buat Flash Sale
                    </Link>
                  </div>
                }
                className="border-0"
              />
            </Card>
          ) : runningCampaigns.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface/50 px-4 py-3 text-xs text-muted-foreground">
              Tidak ada kampanye yang sedang berjalan. Kampanye draft, diakhiri, dan selesai dikelola di halaman Diskon Reguler dan Flash Sale.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {runningCampaigns.map((campaign) => {
                const accent = CAMPAIGN_ACCENTS[campaign.type] ?? CAMPAIGN_ACCENTS.store
                return (
                <Card
                  key={campaign.id}
                  onClick={(event) => klikKartu(event, campaign.detail_href)}
                  className={cn(
                    "relative cursor-pointer overflow-hidden border border-border bg-card p-4 pl-5 transition hover:shadow-md",
                    (campaign.live || campaign.scheduled) ? cn("ring-1", accent.ring) : "",
                  )}
                >
                  <span className={cn("absolute inset-y-0 left-0 w-1", accent.stripe)} aria-hidden="true" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", accent.chip)}>
                        <Icon name={accent.icon} className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{campaign.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{campaign.type_label}</p>
                      </div>
                    </div>
                    <StatusBadge
                      status={campaign.live ? "active" : campaign.scheduled ? "scheduled" : campaign.status}
                      tone={campaign.live ? "success" : campaign.scheduled ? "info" : "neutral"}
                      label={campaign.live ? "Berjalan" : campaign.scheduled ? "Terjadwal" : (STATUS_LABELS[campaign.status] ?? campaign.status)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className={cn("font-semibold tabular-nums", accent.text)}>{campaign.discount_percent}%</span>
                    <span>{formatRentangWaktu(campaign.starts_at, campaign.ends_at)}</span>
                    <span>{formatNumber(campaign.products_count)} produk</span>
                  </div>
                  <Link href={campaign.detail_href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Lihat detail
                    <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                  </Link>
                </Card>
                )
              })}
            </div>
          )}
        </section>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="flex flex-col overflow-hidden border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Voucher berlaku</h2>
              <Link href={vouchersUrl} className="text-xs text-primary hover:underline">Kelola</Link>
            </div>
            {vouchers.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Tidak ada voucher yang sedang berlaku.</p>
            ) : (
              <ul className="divide-y divide-border">
                {vouchers.map((voucher) => (
                  <li
                    key={voucher.id}
                    onClick={(event) => klikKartu(event, vouchersUrl)}
                    className="cursor-pointer px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{voucher.name}</p>
                      <span className="shrink-0 font-semibold tabular-nums text-primary">{voucher.discount_label}</span>
                    </div>
                    <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      {voucher.code} · {voucher.ends_at ? `s.d. ${formatDay(voucher.ends_at)}` : "Tanpa batas"}
                      <CopyButton text={voucher.code} label="Salin kode voucher" compact showTextInTitle />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col overflow-hidden border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Banner terbit</h2>
              <Link href={bannersUrl} className="text-xs text-primary hover:underline">Kelola</Link>
            </div>
            {banners.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Tidak ada banner yang terbit.</p>
            ) : (
              <ul className="divide-y divide-border">
                {banners.map((banner) => (
                  <li
                    key={banner.id}
                    onClick={(event) => klikKartu(event, bannersUrl)}
                    className="cursor-pointer px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{banner.title}</p>
                    {banner.link_url ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{banner.link_url}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-col overflow-hidden border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Bar Promo aktif</h2>
              <Link href={announcementsUrl} className="text-xs text-primary hover:underline">Kelola</Link>
            </div>
            {announcements.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Tidak ada bar promo yang aktif.</p>
            ) : (
              <ul className="divide-y divide-border">
                {announcements.map((item) => (
                  <li
                    key={item.id}
                    onClick={(event) => klikKartu(event, announcementsUrl)}
                    className="cursor-pointer px-4 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{item.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatRentangTanggal(item.starts_at, item.ends_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}
