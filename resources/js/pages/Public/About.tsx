import { Head, usePage } from "@inertiajs/react"

import { BrandWordmark } from "@/components/shared/brand-wordmark"
import { Icon } from "@/components/shared/icon"
import { PageTopBar } from "@/components/public/page-top-bar"
import { ClosingCTASection } from "@/components/public/closing-cta"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
import { resolveCtaActions } from "@/lib/cta-actions"
import { channelOf, isLiveHref } from "@/lib/platforms"
import { routeUrl } from "@/lib/routes"
import { telephoneHref } from "@/lib/format"
import type { SharedPageProps, SocialLink } from "@/types"

interface WhyPoint {
  icon: string
  title: string
  body: string
}

interface WorkStep {
  title: string
  body: string
}

interface PageData {
  title: string
  heading?: string
  subtitle?: string
  tagline?: string
  headline?: string
  description?: string
  why_points?: WhyPoint[]
  work_steps?: WorkStep[]
  trust_rows?: string[]
}

interface AboutStats {
  variant_count?: number
}

const WHY_POINTS = [
  {
    icon: "storefront" as const,
    title: "Produksi sendiri",
    body: "Dibuat di workshop kami dengan kontrol kualitas langsung.",
  },
  {
    icon: "ruler" as const,
    title: "Bisa custom",
    body: "Ukuran dan model dapat disesuaikan dengan kebutuhan proyek.",
  },
  {
    icon: "package" as const,
    title: "Packing aman",
    body: "Pengiriman menggunakan packing kayu untuk menjaga produk.",
  },
  {
    icon: "check-circle" as const,
    title: "Proses jelas",
    body: "Pesanan dikonfirmasi sebelum diproses dan dikirim.",
  },
]

const WORK_STEPS = [
  {
    number: "01",
    title: "Konsultasi",
    body: "Tentukan model, ukuran, warna, dan kebutuhan kaca.",
  },
  {
    number: "02",
    title: "Produksi",
    body: "Produk dibuat di workshop dengan pemeriksaan kualitas.",
  },
  {
    number: "03",
    title: "Packing & Kirim",
    body: "Produk dikemas aman lalu dikirim sesuai jadwal.",
  },
]

const TRUST_ROWS = [
  "Melayani pengiriman ke seluruh Indonesia",
  "Bisa konsultasi sebelum pesan",
  "Ada konfirmasi detail sebelum produksi",
  "Ada kebijakan penggantian jika produk bermasalah",
]

/** Pecah label statistik brand (mis. "15+ Tahun Pengalaman") jadi angka + keterangan. */
function parseStatLabel(label: string): { value: string; caption: string } {
  const match = label.trim().match(/^([0-9.,]+\+?)\s*(.+)$/)
  if (match) {
    return { value: match[1], caption: match[2] }
  }
  return { value: label.trim(), caption: "" }
}

function PlatformChip({ item }: { item: SocialLink }) {
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

  return (
    <li>
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 transition-colors hover:border-foreground/25 hover:bg-muted/60"
      >
        {inner}
      </a>
    </li>
  )
}

function PlatformGroup({ title, items }: { title: string; items: SocialLink[] }) {
  const live = items.filter((item) => isLiveHref(item.href))
  // Panel hanya berisi kanal yang benar-benar diisi admin. Nama platform tidak
  // dikarang di kode: bila semua tautan masih kosong, panelnya tidak dirender.
  if (live.length === 0) return null
  return (
    <div className="surface-panel p-5 sm:p-6">
      <h3 className="text-sm font-bold tracking-tight text-foreground">{title}</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {live.map((item) => (
          <PlatformChip key={item.key} item={item} />
        ))}
      </ul>
    </div>
  )
}

export default function About({ page, stats }: { page: PageData; stats?: AboutStats }) {
  const { brand, consultationWhatsApp, platforms = [], ctaSettings } = usePage<SharedPageProps>().props
  // Tombol panel kontak diatur admin lewat CTA Storefront,
  // blok "Tentang Kami: panel toko & workshop".
  const aboutContactActions = resolveCtaActions(
    ctaSettings?.pages?.["about-contact"]?.actions,
    consultationWhatsApp?.directUrl ?? routeUrl("contact"),
  )
  const whatsappUrl = consultationWhatsApp?.directUrl ?? null
  const whatsappLabel = consultationWhatsApp?.directLabel ?? "Chat WhatsApp"
  const phoneHref = telephoneHref(brand.phone)
  const heading = page.heading?.trim() || "Tentang Kami"
  const subtitle = page.subtitle?.trim() || "Sejak 2008"
  const tagline = page.tagline?.trim() ?? ""
  const headline = page.headline?.trim() || "Spesialis Jendela & Pintu Aluminium Siap Pasang Berkualitas"
  const description = page.description?.trim() || "Ragil Aluminium memproduksi berbagai model jendela dan pintu aluminium dengan standar presisi tinggi, material pilihan, dan pengerjaan oleh tenaga berpengalaman. Kami melayani kebutuhan rumah tinggal maupun proyek ke seluruh wilayah Indonesia."
  const whyPoints = page.why_points?.length ? page.why_points : WHY_POINTS
  const workSteps = page.work_steps?.length ? page.work_steps : WORK_STEPS
  const trustRows = page.trust_rows?.length ? page.trust_rows : TRUST_ROWS

  const yearStat = parseStatLabel(brand.years_experience_label ?? "")
  const unitStat = parseStatLabel(brand.units_installed_label ?? "")
  const baseVariantCount = stats?.variant_count ?? 0
  const variantValue =
    baseVariantCount >= 100 ? `${Math.floor(baseVariantCount / 100) * 100}+` : `${baseVariantCount}+`

  const trustStats = [
    yearStat.value ? { value: yearStat.value, caption: yearStat.caption || "Tahun Pengalaman" } : null,
    { value: variantValue, caption: "Varian Ukuran & Model" },
    unitStat.value ? { value: unitStat.value, caption: unitStat.caption || "Unit Terpasang" } : null,
    { value: "Seluruh Indonesia", caption: "Jangkauan Pengiriman" },
  ].filter((item): item is { value: string; caption: string } => item !== null)

  const marketplaces = platforms.filter((item) => channelOf(item) === "marketplace")
  const socials = platforms.filter((item) => channelOf(item) === "social")
  const unitsRow = unitStat.value ? `${unitStat.value} unit terpasang` : null

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

      {/* Hero: satu pesan utama, satu CTA */}
      <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
        <section aria-label="Tentang Ragil Aluminium" className="surface-panel mt-4 px-5 py-8 text-center sm:px-10 sm:py-10">
          <BrandWordmark className="mx-auto [&_img]:h-12 [&_img]:w-auto [&_img]:max-w-[min(100%,17rem)] sm:[&_img]:h-14" />

          {subtitle ? (
            <p className="mx-auto mt-4 text-xs font-bold uppercase tracking-[0.08em] text-primary">{subtitle}</p>
          ) : null}

          <h2 className="mx-auto mt-2 max-w-xl text-lg font-bold leading-snug tracking-tight text-foreground ![text-transform:none] sm:text-xl">
            {headline}
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>

          <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-snug text-muted-foreground ![text-transform:none]">
            {tagline || (
              <>
                <span className="text-primary">Sejak 2008</span> memproduksi jendela &amp; pintu aluminium
              </>
            )}
          </p>
        </section>
      </div>

      {/* Trust strip: grid 2 kolom mobile, 4 kolom desktop */}
      <div className="container-page mt-4 !px-2.5 md:!px-8 lg:!px-12">
        <section aria-label="Statistik Ragil Aluminium">
          <div className="surface-panel grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
            {trustStats.map((stat, index) => (
              <div key={stat.caption || index} className="px-4 py-5 text-center sm:px-6">
                <p className="text-xl font-bold tracking-tight text-foreground tabular-nums">{stat.value}</p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{stat.caption}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Kenapa memilih: 4 card kompak */}
      <div className="container-page mt-6 sm:mt-8 !px-2.5 md:!px-8 lg:!px-12">
        <section aria-labelledby="why-ragil">
          <h2 id="why-ragil" className="text-sm font-bold tracking-tight text-foreground ![text-transform:none]">
            Kenapa memilih Ragil Aluminium?
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {whyPoints.map((item) => (
              <div key={item.title} className="surface-panel p-5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={item.icon} className="size-5" weight="bold" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-bold tracking-tight text-foreground">{item.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Cara kami bekerja: 3 langkah bernomor */}
      <div className="container-page mt-6 sm:mt-8 !px-2.5 md:!px-8 lg:!px-12">
        <section aria-labelledby="process-ragil">
          <h2 id="process-ragil" className="text-sm font-bold tracking-tight text-foreground ![text-transform:none]">
            Cara kami bekerja
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {workSteps.map((step, index) => (
              <li key={index} className="surface-panel p-5 sm:p-6">
                <span className="text-2xl font-bold tabular-nums text-primary">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-sm font-bold tracking-tight text-foreground">{step.title}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Dipercaya untuk rumah dan proyek: bukti sosial + CTA hasil pemasangan */}
      <div className="container-page mt-6 sm:mt-8 !px-2.5 md:!px-8 lg:!px-12">
        <section aria-labelledby="trust-ragil" className="surface-panel grid gap-6 p-6 sm:gap-8 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 id="trust-ragil" className="text-sm font-bold tracking-tight text-foreground ![text-transform:none]">
              Dipercaya untuk rumah dan proyek
            </h2>
            <ul className="mt-3 space-y-2.5">
              {unitsRow ? (
                <li className="flex items-start gap-2.5 text-sm leading-5 text-muted-foreground">
                  <Icon name="check-circle" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {unitsRow}
                </li>
              ) : null}
              {trustRows.map((row) => (
                <li key={row} className="flex items-start gap-2.5 text-sm leading-5 text-muted-foreground">
                  <Icon name="check-circle" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {row}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-4 rounded-lg bg-[#333333] p-6 sm:p-7">
            <p className="text-sm leading-6 text-white/85">
              Lihat foto produk yang sudah terpasang di rumah dan proyek pelanggan kami.
            </p>
            <a
              href={routeUrl("installation.index")}
              className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-bold tracking-tight text-white transition duration-200 hover:bg-white/20"
            >
              Lihat Hasil Pemasangan
              <Icon name="arrow-up-right" className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>

      {/* Kontak: WhatsApp utama, kontak sekunder, alamat + peta */}
      <div className="container-page mt-6 sm:mt-8 !px-2.5 md:!px-8 lg:!px-12">
        <section aria-labelledby="store-contact">
          <div className="mt-3 grid gap-3 lg:grid-cols-1">
            <div className="surface-panel overflow-hidden p-5 sm:p-6">
              <p className="text-sm font-bold tracking-tight text-foreground">
                {ctaSettings?.pages?.["about-contact"]?.heading || "Toko & Workshop Ragil Aluminium"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{brand.address}</p>

              <div className="mt-4 space-y-2.5 text-sm">
                {phoneHref ? (
                  <a href={phoneHref} className="flex items-center gap-2.5 font-medium text-foreground hover:text-primary hover:underline">
                    <Icon name="headset" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {brand.phone}
                  </a>
                ) : null}

                {brand.email ? (
                  <a
                    href={`mailto:${brand.email}`}
                    className="flex items-center gap-2.5 font-medium text-foreground hover:text-primary hover:underline"
                  >
                    <Icon name="envelope" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    {brand.email}
                  </a>
                ) : null}

                <p className="flex items-start gap-2.5 font-medium text-foreground">
                  <Icon name="clock" className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {(brand.hours ?? "Senin - Sabtu, 08.00 - 17.00 WIB").replace(/[–—]/g, "-")}
                </p>
              </div>

              <div className="mt-4">
                {aboutContactActions.length > 0 ? (
                  aboutContactActions.map((action) => (
                    <Button key={action.label} asChild>
                      <a
                        href={action.href}
                        {...(action.external ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {action.whatsappIcon ? (
                          <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                        ) : null}
                        {action.label}
                      </a>
                    </Button>
                  ))
                ) : (
                  <Button asChild>
                    <a href={whatsappUrl ?? routeUrl("contact")} target="_blank" rel="noreferrer">
                      <Icon name="whatsapp" className="h-4 w-4" aria-hidden="true" />
                      {whatsappLabel}
                    </a>
                  </Button>
                )}
              </div>

              {/* Maps di urutan paling akhir card (di bawah tombol chat whatsapp) */}
              <div className="mt-4 overflow-hidden rounded-lg border border-border">
                <iframe
                  src={
                    brand.maps_embed_url ||
                    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3956.273646849492!2d109.5288635!3d-7.44972!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e65530ecf16e515%3A0x9c84f69c3e0477df!2sToko%20Ragil%20Aluminium%20(Interior%2C%20Furniture)!5e0!3m2!1sid!2sid!4v1"
                  }
                  title="Lokasi Toko Ragil Aluminium"
                  loading="lazy"
                  className="h-56 w-full border-0"
                />
              </div>


            </div>
          </div>
        </section>
      </div>

      {/* Sosial dan marketplace: hanya kanal yang benar-benar diisi admin. */}
      <div className="container-page mt-6 sm:mt-8 !px-2.5 md:!px-8 lg:!px-12">
        {(socials.length || marketplaces.length) ? (
          <section aria-label="Sosial dan marketplace" className="grid gap-3 md:grid-cols-2">
            {socials.length ? <PlatformGroup title="Ikuti kami" items={socials} /> : null}
            {marketplaces.length ? <PlatformGroup title="Belanja di marketplace" items={marketplaces} /> : null}
          </section>
        ) : null}
      </div>

      {/* CTA penutup seragam (reusable) */}
      <ClosingCTASection
        pageKey="about"
        compact={false}
        eyebrow="Butuh bantuan memilih produk?"
        heading="Konsultasi gratis untuk menentukan model dan ukuran yang sesuai"
        actions={[
          {
            label: whatsappLabel,
            href: whatsappUrl ?? routeUrl("contact"),
            variant: "primary",
            whatsappIcon: true,
            external: true,
          },
          { label: "Lihat Produk", href: routeUrl("products"), variant: "secondary" },
        ]}
      />
    </PublicLayout>
  )
}
