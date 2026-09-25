import { Head, Link } from "@inertiajs/react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "tanpa batas"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "tanpa batas"
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
}

function formatDay(iso: string | null): string {
  if (!iso) return "tanpa batas"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "tanpa batas"
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
        <p className="mt-1 truncate text-xs text-muted-foreground group-hover:text-foreground">{label}</p>
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
  createStoreUrl: string
  createFlashSaleUrl: string
}) {
  // Ringkasan hanya menampilkan kampanye yang berjalan atau terjadwal.
  // Draft/diakhiri/selesai dikelola di tab Diskon Reguler dan Flash Sale.
  const runningCampaigns = campaigns.filter((campaign) => campaign.live || campaign.scheduled)

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={createFlashSaleUrl}>
              <Icon name="zap" className="size-4" aria-hidden="true" />
              Buat Flash Sale
            </Link>
          </Button>
          <Button asChild>
            <Link href={createStoreUrl}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Buat Diskon Reguler
            </Link>
          </Button>
        </div>
      }
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Kampanye diskon</h2>
            <div className="flex items-center gap-2 text-xs">
              <Link href={storeUrl} className="text-primary hover:underline">Semua Diskon Reguler</Link>
              <span className="text-muted-foreground">·</span>
              <Link href={flashSaleUrl} className="text-primary hover:underline">Semua Flash Sale</Link>
              <span className="text-muted-foreground">·</span>
              <Link href={vouchersUrl} className="text-primary hover:underline">Kelola Voucher</Link>
            </div>
          </div>

          {campaigns.length === 0 ? (
            <Card className="border border-border bg-card">
              <EmptyState
                icon="ticket-percent"
                title="Belum ada kampanye diskon"
                description="Buat Diskon Reguler untuk potongan berkelanjutan, atau Flash Sale untuk diskon ekstra jangka pendek."
                action={
                  <Link
                    href={storeUrl}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-soft transition hover:bg-primary-hover"
                  >
                    Buat kampanye pertama
                  </Link>
                }
                className="border-0"
              />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {runningCampaigns.map((campaign) => (
                <Card key={campaign.id} className={cn("border border-border bg-card p-4", (campaign.live || campaign.scheduled) ? "ring-1 ring-primary/20" : "")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={campaign.detail_href} className="font-semibold text-foreground hover:text-primary hover:underline">
                        {campaign.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{campaign.type_label}</p>
                    </div>
                    <StatusBadge
                      status={campaign.live ? "active" : campaign.scheduled ? "scheduled" : campaign.status}
                      tone={campaign.live ? "success" : campaign.scheduled ? "info" : "neutral"}
                      label={campaign.live ? "Berjalan" : campaign.scheduled ? "Terjadwal" : (STATUS_LABELS[campaign.status] ?? campaign.status)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-semibold tabular-nums text-primary">{campaign.discount_percent}%</span>
                    <span>{formatDateTime(campaign.starts_at)} → {formatDateTime(campaign.ends_at)}</span>
                    <span>{formatNumber(campaign.products_count)} produk</span>
                  </div>
                  <Link href={campaign.detail_href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Lihat detail
                    <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                  </Link>
                </Card>
              ))}
            </div>
          )}
          {runningCampaigns.length === 0 && campaigns.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Tidak ada kampanye yang sedang berjalan. Kampanye draft, diakhiri, dan selesai dikelola di tab Diskon Reguler dan Flash Sale.
            </p>
          ) : null}
        </section>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Voucher berlaku</h2>
              <Link href={vouchersUrl} className="text-xs text-primary hover:underline">Kelola</Link>
            </div>
            {vouchers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface/50 p-3 text-xs text-muted-foreground">
                Tidak ada voucher yang sedang berlaku.
              </p>
            ) : (
              <ul className="space-y-2">
                {vouchers.map((voucher) => (
                  <li key={voucher.id} className="rounded-lg border border-border bg-card p-3 shadow-soft">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">{voucher.name}</p>
                      <span className="shrink-0 font-semibold tabular-nums text-primary">{voucher.discount_label}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {voucher.code} · s.d. {formatDay(voucher.ends_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Banner terbit</h2>
              <Link href={bannersUrl} className="text-xs text-primary hover:underline">Kelola</Link>
            </div>
            {banners.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface/50 p-3 text-xs text-muted-foreground">
                Tidak ada banner yang terbit.
              </p>
            ) : (
              <ul className="space-y-2">
                {banners.map((banner) => (
                  <li key={banner.id} className="rounded-lg border border-border bg-card p-3 shadow-soft">
                    <p className="truncate text-sm font-medium text-foreground">{banner.title}</p>
                    {banner.link_url ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{banner.link_url}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Bar Promo aktif</h2>
              <Link href={announcementsUrl} className="text-xs text-primary hover:underline">Kelola</Link>
            </div>
            {announcements.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border bg-surface/50 p-3 text-xs text-muted-foreground">
                Tidak ada bar promo yang aktif.
              </p>
            ) : (
              <ul className="space-y-2">
                {announcements.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border bg-card p-3 shadow-soft">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{item.text}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDay(item.starts_at)} → {formatDay(item.ends_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  )
}
