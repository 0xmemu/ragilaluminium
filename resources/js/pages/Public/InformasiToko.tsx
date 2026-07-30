import { Head, Link, usePage } from "@inertiajs/react"
import type { ComponentProps } from "react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
import { cn } from "@/lib/utils"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps, SocialLink } from "@/types"

interface PageData {
  title: string
  heading?: string
  body: string
}

const WHY_POINTS = [
  {
    icon: "ruler" as const,
    title: "30.000+ Variasi Ukuran & Model",
    body: "Pilihan lengkap untuk semua kebutuhan Anda.",
  },
  {
    icon: "truck" as const,
    title: "Kirim ke Seluruh Indonesia",
    body: "Pengiriman aman dengan packing kayu berkualitas.",
  },
  {
    icon: "storefront" as const,
    title: "Produksi Sendiri",
    body: "Dikerjakan oleh tim berpengalaman dengan standar kualitas tinggi.",
  },
  {
    icon: "lightning" as const,
    title: "Proses Cepat",
    body: "Pesanan diproses & dikirim maksimal 1 hari kerja.",
  },
]

const PROCESS_POINTS = [
  {
    icon: "wrench" as const,
    title: "Workshop",
    body: "Didukung peralatan lengkap dan ruang produksi yang luas untuk hasil maksimal.",
  },
  {
    icon: "package" as const,
    title: "Proses Produksi",
    body: "Setiap proses dikerjakan dengan teliti oleh tenaga ahli berpengalaman.",
  },
  {
    icon: "badge-check" as const,
    title: "Produk Real",
    body: "Hasil produk rapi, kuat, dan siap mempercantik hunian Anda.",
  },
]

const TRUST_POINTS = [
  {
    icon: "package" as const,
    title: "200.000+ Unit Terpasang",
    body: "Telah digunakan di berbagai proyek & rumah di Indonesia.",
  },
  {
    icon: "trend-up" as const,
    title: "Melayani Seluruh Indonesia",
    body: "Dari Sabang sampai Merauke, kami siap kirim ke Anda.",
  },
  {
    icon: "shield-check" as const,
    title: "Garansi Pengembalian",
    body: "Jika barang rusak atau tidak sesuai, kami ganti atau perbaiki.",
  },
  {
    icon: "check-circle" as const,
    title: "Konfirmasi Sebelum Diproses",
    body: "Setiap pesanan akan kami konfirmasi detail terlebih dahulu.",
  },
]

const WORK_STEPS = [
  {
    icon: "shopping-cart" as const,
    title: "Pilih Produk",
    body: "Pilih model & ukuran yang Anda butuhkan.",
  },
  {
    icon: "whatsapp" as const,
    title: "Konfirmasi via WhatsApp",
    body: "Kami konfirmasi detail pesanan, ukuran, alamat & jadwal kirim.",
  },
  {
    icon: "truck" as const,
    title: "Proses & Pengiriman",
    body: "Pesanan diproses dan dikirim maksimal 1 hari kerja.",
  },
]

function isLiveHref(href?: string | null): boolean {
  return Boolean(href && href !== "#")
}

function channelOf(item: SocialLink): "marketplace" | "social" {
  if (item.channel === "marketplace" || item.channel === "social") {
    return item.channel
  }
  return ["shopee", "tokopedia", "lazada", "tiktok_shop"].includes(item.key) ? "marketplace" : "social"
}

function PointList({
  items,
}: {
  items: Array<{ icon: ComponentProps<typeof Icon>["name"]; title: string; body: string }>
}) {
  return (
    <ul className="mt-4 space-y-4">
      {items.map((item) => (
        <li key={item.title} className="flex gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon name={item.icon} className="size-4" weight="bold" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-foreground">{item.title}</p>
            <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function PlatformLinkRow({ item }: { item: SocialLink }) {
  const live = isLiveHref(item.href)

  const row = (
    <div
      className={cn(
        "flex min-h-[3.5rem] items-center gap-3 px-4 py-3.5",
        live && "transition-colors hover:bg-muted/60",
      )}
    >
      {item.icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
          <img src={item.icon} alt="" className="size-6 object-contain" width={24} height={24} />
        </span>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon name="storefront" className="size-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight text-foreground">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {live ? "Buka tautan" : "Tautan belum tersedia"}
        </p>
      </div>
      {live ? (
        <Icon name="arrow-right" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
    </div>
  )

  if (live) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="block border-b border-border last:border-b-0"
      >
        {row}
      </a>
    )
  }

  return <div className="border-b border-border opacity-55 last:border-b-0">{row}</div>
}

function ContactRow({
  label,
  children,
  icon,
  className,
}: {
  label: string
  children: React.ReactNode
  icon: ComponentProps<typeof Icon>["name"]
  className?: string
}) {
  return (
    <div className={cn("border-t border-border px-5 py-4 first:border-t-0", className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon name={icon} className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">{label}</p>
          <div className="mt-1.5">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function InformasiToko({ page }: { page: PageData }) {
  const { brand, consultationWhatsApp, platforms = [] } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const phoneHref = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null
  const heading = page.heading?.trim() || "Informasi Toko"
  const unitsLabel = brand.units_installed_label?.trim()
  const trustPoints = TRUST_POINTS.map((item, index) =>
    index === 0 && unitsLabel
      ? {
          ...item,
          title: unitsLabel.includes("Unit") ? unitsLabel.replace(/\s+di\s+.+$/i, "").trim() : unitsLabel,
        }
      : item,
  )

  const marketplaces = platforms.filter((item) => channelOf(item) === "marketplace")
  const socials = platforms.filter((item) => channelOf(item) === "social")

  return (
    <PublicLayout>
      <Head title={page.title || "Informasi Toko"}>
        <meta
          name="description"
          content={`Profil, keunggulan, dan kontak resmi ${brand.short_name || "Ragil Aluminium"}.`}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page py-5">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Informasi Toko", href: null },
            ]}
          />
        </div>
        <div className="container-page mx-auto max-w-2xl pb-8 pt-2">
          <BrandWordmark className="[&_img]:h-11 [&_img]:w-auto [&_img]:max-w-[min(100%,16rem)] sm:[&_img]:h-12" />
          <h1 className="mt-4 text-2xl font-bold leading-snug tracking-tight sm:text-3xl">{heading}</h1>
          <p className="mt-2 text-sm font-semibold text-foreground sm:text-base">
            Sejak 2008 memproduksi jendela aluminium
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Kami berkomitmen menghadirkan produk berkualitas dengan desain modern, tahan lama, dan
            presisi tinggi untuk setiap kebutuhan Anda.
          </p>
        </div>
      </section>

      <div className="container-page mx-auto max-w-2xl space-y-10 py-8 sm:py-10">
        <section aria-labelledby="why-ragil">
          <h2 id="why-ragil" className="text-base font-bold tracking-tight text-foreground">
            Kenapa Memilih Ragil Aluminium
          </h2>
          <PointList items={WHY_POINTS} />
        </section>

        <section aria-labelledby="process-ragil">
          <h2 id="process-ragil" className="text-base font-bold tracking-tight text-foreground">
            Proses & Produk Kami
          </h2>
          <PointList items={PROCESS_POINTS} />
        </section>

        <section aria-labelledby="trust-ragil">
          <h2 id="trust-ragil" className="text-base font-bold tracking-tight text-foreground">
            Dipercaya oleh Banyak Pelanggan
          </h2>
          <PointList items={trustPoints} />
        </section>

        <section aria-labelledby="how-ragil">
          <h2 id="how-ragil" className="text-base font-bold tracking-tight text-foreground">
            Cara Kerja Kami
          </h2>
          <ol className="mt-4 space-y-4">
            {WORK_STEPS.map((item, index) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground">
                    <Icon name={item.icon} className="size-4 text-primary" aria-hidden="true" />
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={routeUrl("catalog.index")}>Pilih Model Produk</Link>
            </Button>
            {whatsappUrl ? (
              <Button asChild size="sm">
                <a href={whatsappUrl} target="_blank" rel="noreferrer">
                  <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                  Konsultasi WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="store-contact">
          <h2 id="store-contact" className="text-base font-bold tracking-tight text-foreground">
            Informasi Kontak
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Kunjungi toko atau hubungi tim kami untuk konsultasi produk.
          </p>

          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border bg-surface-muted/40 px-5 py-5">
              <p className="text-[11px] font-semibold uppercase tracking-tight text-muted-foreground">
                Alamat toko
              </p>
              <p className="mt-2 text-base font-normal leading-7 tracking-tight text-foreground sm:text-lg">
                {brand.address}
              </p>
              {brand.maps_url ? (
                <a
                  href={brand.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Buka di Google Maps
                  <Icon name="arrow-right" className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>

            {brand.phone || whatsappUrl ? (
              <ContactRow label="WhatsApp" icon="whatsapp">
                {brand.phone ? (
                  <p className="text-sm font-semibold text-foreground">
                    {phoneHref ? (
                      <a href={phoneHref} className="hover:text-primary">
                        {brand.phone}
                      </a>
                    ) : (
                      brand.phone
                    )}
                  </p>
                ) : null}
                {whatsappUrl ? (
                  <Button asChild className="mt-2.5" size="sm">
                    <a href={whatsappUrl} target="_blank" rel="noreferrer">
                      <Icon name="whatsapp" className="size-4" aria-hidden="true" />
                      {consultationWhatsApp?.directLabel ?? "Chat via WhatsApp"}
                    </a>
                  </Button>
                ) : null}
              </ContactRow>
            ) : null}

            {brand.email ? (
              <ContactRow label="Email bisnis" icon="envelope">
                <a
                  href={`mailto:${brand.email}`}
                  className="break-all text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {brand.email}
                </a>
              </ContactRow>
            ) : null}

            <ContactRow label="Jam operasional" icon="clock">
              <p className="text-sm leading-6 text-foreground">
                {brand.hours ?? "Senin - Sabtu, 08.00 - 17.00 WIB"}
              </p>
            </ContactRow>
          </div>

          {brand.maps_embed_url ? (
            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <iframe
                title="Peta lokasi toko Ragil Aluminium"
                src={brand.maps_embed_url}
                className="aspect-[4/3] w-full border-0 sm:aspect-video"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          ) : null}
        </section>

        {socials.length ? (
          <section aria-labelledby="store-social">
            <h2 id="store-social" className="text-base font-bold tracking-tight text-foreground">
              Ikuti Kami
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Update produk, tips perawatan, dan dokumentasi pemasangan.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              {socials.map((item) => (
                <PlatformLinkRow key={item.key} item={item} />
              ))}
            </div>
          </section>
        ) : null}

        {marketplaces.length ? (
          <section aria-labelledby="store-marketplace">
            <h2 id="store-marketplace" className="text-base font-bold tracking-tight text-foreground">
              Marketplace
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Belanja melalui toko resmi Ragil Aluminium di platform berikut.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              {marketplaces.map((item) => (
                <PlatformLinkRow key={item.key} item={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PublicLayout>
  )
}
