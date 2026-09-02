import { Head, usePage } from "@inertiajs/react"
import type { ComponentProps } from "react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { PageTopBar } from "@/components/public/page-top-bar"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
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
    <ul className="mt-5 space-y-5">
      {items.map((item) => (
        <li key={item.title} className="flex gap-4">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name={item.icon} className="size-5" weight="bold" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold tracking-tight text-foreground sm:text-base">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function PlatformChip({ item }: { item: SocialLink }) {
  const live = isLiveHref(item.href)

  const inner = (
    <>
      {item.icon ? (
        <img src={item.icon} alt="" className="size-5 shrink-0 object-contain" width={20} height={20} />
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <Icon name="storefront" className="size-4" aria-hidden="true" />
        </span>
      )}
      <span className="text-xs font-semibold tracking-tight text-foreground">{item.label}</span>
    </>
  )

  if (live) {
    return (
      <li>
        <a
          href={item.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 transition-colors hover:bg-muted/60"
        >
          {inner}
        </a>
      </li>
    )
  }

  return (
    <li
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 opacity-55"
      title={item.label}
    >
      {inner}
    </li>
  )
}

export default function About({ page }: { page: PageData }) {
  const { brand, consultationWhatsApp, platforms = [] } = usePage<SharedPageProps>().props
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const phoneHref = brand.phone ? `tel:${brand.phone.replace(/[^\d+]/g, "")}` : null
  const heading = page.heading?.trim() || "Tentang Kami"
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
      <Head title={page.title || "Tentang Kami"}>
        <meta
          name="description"
          content={`Profil, keunggulan, dan kontak resmi ${brand.short_name || "Ragil Aluminium"}.`}
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <PageTopBar
          breadcrumbs={[
            { label: "Beranda", href: routeUrl("home") },
            { label: "Tentang Kami", href: null },
          ]}

          title={heading}
        />
      </section>

      <div className="container-page py-6 !px-2.5 md:!px-10 lg:!px-12 sm:py-8">
        <BrandWordmark className="[&_img]:h-14 [&_img]:w-auto [&_img]:max-w-[min(100%,18rem)] sm:[&_img]:h-16" />
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          Produsen jendela & pintu aluminium presisi untuk hunian dan proyek di seluruh Indonesia.
          Dikerjakan di workshop sendiri, dikirim dengan packing kayu aman.
        </p>
      </div>

      <div className="container-page space-y-8 !px-2.5 md:!px-8 lg:!px-12 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-0 md:space-y-0">
        <div className="space-y-6">
          <section aria-labelledby="why-ragil">
            <h2 id="why-ragil" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Kenapa Memilih Ragil Aluminium
            </h2>
            <PointList items={WHY_POINTS} />
          </section>

          <section aria-labelledby="process-ragil">
            <h2 id="process-ragil" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Proses & Produk Kami
            </h2>
            <PointList items={PROCESS_POINTS} />
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="trust-ragil">
            <h2 id="trust-ragil" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Dipercaya oleh Banyak Pelanggan
            </h2>
            <PointList items={trustPoints} />
          </section>

          <section aria-labelledby="how-ragil">
            <h2 id="how-ragil" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              Cara Kerja Kami
            </h2>
            <PointList items={WORK_STEPS.map(s => ({ ...s, body: s.body }))} />
          </section>
        </div>
      </div>

      <div className="container-page space-y-10 !px-2.5 py-2 md:!px-8 lg:!px-12">
        <section aria-labelledby="store-contact">
          <h2 id="store-contact" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Informasi Kontak
          </h2>

          <div className="mt-4">
            <div className="surface-panel grid gap-0 lg:grid-cols-[1fr_1.2fr] lg:overflow-hidden">
              <div className="p-6 sm:p-7">
                <p className="text-xl font-bold tracking-tight">Kontak Ragil Aluminium</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{brand.address}</p>
                <div className="mt-4 grid gap-2">
                  {whatsappUrl ? (
                    <Button asChild>
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                        {consultationWhatsApp?.directLabel ?? "Chat WhatsApp"}
                      </a>
                    </Button>
                  ) : null}
                  {phoneHref ? (
                    <Button asChild variant={whatsappUrl ? "secondary" : undefined}>
                      <a href={phoneHref}>
                        <Icon name="headset" className="h-4 w-4" aria-hidden="true" />
                        Telepon
                      </a>
                    </Button>
                  ) : null}
                  {brand.email ? (
                    <Button asChild variant="secondary">
                      <a href={`mailto:${brand.email}`}>Kirim Email</a>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {brand.hours ?? "Senin – Sabtu, 08.00 – 17.00 WIB"}
                </p>
              </div>

              {brand.maps_embed_url ? (
                <div className="min-h-[220px] lg:min-h-0">
                  <iframe
                    title="Peta lokasi toko Ragil Aluminium"
                    src={brand.maps_embed_url}
                    className="size-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {(socials.length || marketplaces.length) ? (
          <section aria-label="Sosial dan marketplace" className="grid gap-6 md:grid-cols-2">
            {socials.length ? (
              <div>
                <h2 id="store-social" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Ikuti Kami
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {socials.map((item) => (
                    <PlatformChip key={item.key} item={item} />
                  ))}
                </ul>
              </div>
            ) : null}

            {marketplaces.length ? (
              <div>
                <h2 id="store-marketplace" className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Marketplace
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {marketplaces.map((item) => (
                    <PlatformChip key={item.key} item={item} />
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </PublicLayout>
  )
}
