import { Head, usePage } from "@inertiajs/react"
import type { ComponentProps } from "react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
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
        <div className="container-page hidden py-4 sm:block">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Informasi Toko", href: null },
            ]}
          />
        </div>
        <div className="container-page pb-4 pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="-ml-2 flex size-11 shrink-0 items-center justify-center sm:hidden"
              aria-label="Kembali"
            >
              <Icon name="caret-left" className="size-5" aria-hidden="true" />
            </button>
            <h1 className="text-lg font-bold leading-snug tracking-tight text-foreground">{heading}</h1>
          </div>
          <BrandWordmark className="[&_img]:h-11 [&_img]:w-auto [&_img]:max-w-[min(100%,16rem)] sm:[&_img]:h-12 mt-3" />
          <p className="mt-2 text-xs font-semibold text-foreground sm:text-sm">
            Sejak 2008 memproduksi jendela aluminium
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
            Kami berkomitmen menghadirkan produk berkualitas dengan desain modern, tahan lama, dan
            presisi tinggi untuk setiap kebutuhan Anda.
          </p>
        </div>
      </section>

      <div className="container-page space-y-6 py-6 sm:py-8 md:grid md:grid-cols-2 md:gap-8 md:space-y-0">
        <div className="space-y-6">
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
        </div>

        <div className="space-y-6">
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
            <PointList items={WORK_STEPS.map(s => ({ ...s, body: s.body }))} />
          </section>
        </div>
      </div>

      <div className="container-page space-y-8 py-6 sm:py-8">
        <section aria-labelledby="store-contact">
          <h2 id="store-contact" className="text-base font-bold tracking-tight text-foreground">
            Informasi Kontak
          </h2>

          <div className="mt-4">
            <div className="surface-panel grid gap-0 lg:grid-cols-[1fr_1.2fr] lg:overflow-hidden">
              <div className="p-5">
                <p className="text-lg font-semibold">Kontak Ragil Aluminium</p>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">{brand.address}</p>
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
                      <a href={`mailto:${brand.email}`}>Kirim email</a>
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
                <h2 id="store-social" className="text-base font-bold tracking-tight text-foreground">
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
                <h2 id="store-marketplace" className="text-base font-bold tracking-tight text-foreground">
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
