import { Head, Link, usePage } from "@inertiajs/react"
import DOMPurify from "dompurify"
import * as React from "react"

import { ClosingCTASection } from "@/components/public/closing-cta"
import { PageTopBar } from "@/components/public/page-top-bar"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import PublicLayout from "@/layouts/public-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { SharedPageProps } from "@/types"

interface CmsPageData {
  title: string
  heading?: string
  body: string
  slug: string
  updated_at_label?: string | null
}

function ContactChannelCard({
  icon,
  iconClass,
  title,
  badge,
  description,
  info,
  actionLabel,
  actionHref,
  isExternal = false,
  isPrimary = false,
}: {
  icon: string
  iconClass?: string
  title: string
  badge?: string
  description: string
  info: string
  actionLabel: string
  actionHref: string
  isExternal?: boolean
  isPrimary?: boolean
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border bg-surface p-4 transition-all duration-200 sm:p-5",
        isPrimary
          ? "border-primary/40 shadow-sm ring-1 ring-primary/10 hover:border-primary/60"
          : "border-border hover:border-border-strong",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground",
                isPrimary ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                iconClass,
              )}
            >
              <Icon name={icon} className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-bold text-foreground sm:text-base">{title}</h3>
          </div>
          {badge ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
              {badge}
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs font-semibold text-foreground">{info}</p>
      </div>

      <div className="mt-4 pt-2">
        <Button asChild variant={isPrimary ? "primary" : "secondary"} className="w-full text-xs font-semibold">
          <a
            href={actionHref}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
          >
            <Icon name={icon} className="size-3.5" aria-hidden="true" />
            {actionLabel}
          </a>
        </Button>
      </div>
    </div>
  )
}

function ContactWorkshopSection({
  address,
  mapsUrl,
}: {
  address: string
  mapsUrl?: string | null
}) {
  const [copied, setCopied] = React.useState(false)

  const handleCopyAddress = React.useCallback(() => {
    const text = address
    let copySuccess = false
    try {
      const ta = document.createElement("textarea")
      ta.value = text
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      copySuccess = document.execCommand("copy")
      ta.remove()
    } catch {
      // ignore
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {})
    }

    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [address])

  const targetMapsUrl =
    mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Toko Ragil Aluminium ${address}`)}`

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Alamat Workshop */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon name="map-pin" className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground sm:text-base">Workshop & Toko Fisik</h3>
              <p className="text-[11px] text-muted-foreground">Pabrikasi dan showroom produk aluminium</p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">{address}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleCopyAddress}
            className="text-xs"
          >
            <Icon name={copied ? "check" : "copy"} className="size-3.5" aria-hidden="true" />
            {copied ? "Alamat Berhasil Disalin" : "Salin Alamat"}
          </Button>

          <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
            <a href={targetMapsUrl} target="_blank" rel="noreferrer">
              <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
              Buka Google Maps
            </a>
          </Button>
        </div>
      </div>

      {/* Jam Operasional */}
      <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon name="clock" className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground sm:text-base">Jam Kerja & Pelayanan</h3>
              <p className="text-[11px] text-muted-foreground">Waktu operasional produksi dan respon pesan</p>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5">
              <span className="font-medium text-foreground">Senin - Sabtu</span>
              <span className="font-semibold text-primary">08.00 - 17.00 WIB</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5">
              <span className="font-medium text-foreground">Minggu & Libur Nasional</span>
              <span className="text-muted-foreground">Tutup</span>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Pesan WhatsApp di luar jam operasional tetap kami terima dan akan dibalas segera saat jam kerja berikutnya dimulai.
        </p>
      </div>
    </div>
  )
}

function ContactQuickHelpSection() {
  const links = [
    {
      title: "Sering Ditanyakan (FAQ)",
      desc: "Jawaban pertanyaan seputar material aluminium, jenis kaca, packing kayu, dan garansi.",
      href: routeUrl("faq"),
      icon: "help-circle",
      badge: "FAQ",
    },
    {
      title: "Cara Pemesanan",
      desc: "Panduan lengkap langkah belanja produk standar maupun pesanan ukuran custom.",
      href: routeUrl("how-to-order"),
      icon: "clipboard-list",
      badge: "Panduan",
    },
    {
      title: "Masalah & Solusi",
      desc: "Pusat bantuan klaim retur, kendala pengiriman ekspedisi, dan garansi toko.",
      href: routeUrl("masalah-solusi"),
      icon: "shield-check",
      badge: "Solusi",
    },
  ]

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-foreground sm:text-base">Pusat Bantuan & Panduan</h2>
        <p className="text-xs text-muted-foreground">
          Temukan jawaban langsung untuk pertanyaan umum seputar pesanan dan layanan
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-surface-muted/50"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                  <Icon name={item.icon} className="size-4" aria-hidden="true" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {item.badge}
                </span>
              </div>
              <h3 className="mt-2.5 text-xs font-bold text-foreground group-hover:text-primary sm:text-sm">
                {item.title}
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
            <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-primary">
              <span>Buka halaman</span>
              <Icon name="arrow-right" className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function CmsPage({ page }: { page: CmsPageData }) {
  const { brand, consultationWhatsApp } = usePage<SharedPageProps>().props
  const cleanBody = React.useMemo(
    () =>
      DOMPurify.sanitize(page.body, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "h1", "h2", "h4", "h5", "h6"],
        FORBID_ATTR: ["style", "onerror", "onclick"],
      }),
    [page.body],
  )
  const isContact = page.slug === "kontak"
  const isPrivacy = page.slug === "kebijakan-privasi"
  const isLegal = page.slug === "ketentuan-layanan" || isPrivacy
  const heading = page.heading?.trim() || page.title
  const rawPhone = brand.phone || "0881080733754"
  const cleanDigits = rawPhone.replace(/[^0-9]/g, "")
  const intlPhone = cleanDigits.startsWith("0") ? `62${cleanDigits.slice(1)}` : cleanDigits
  const whatsappUrl =
    consultationWhatsApp?.directUrl ?? `https://wa.me/${intlPhone}?text=${encodeURIComponent("Halo Ragil Aluminium, saya ingin konsultasi ukuran khusus untuk produk aluminium.")}`
  const phoneHref = `tel:+${intlPhone}`
  const displayPhone = brand.phone || "0881-0807-33754"

  return (
    <PublicLayout>
      <Head title={isContact ? "Hubungi Kami" : page.title}>
        <meta
          name="description"
          content={
            isContact
              ? "Hubungi Ragil Aluminium untuk konsultasi ukuran custom, spesifikasi produk, dan informasi pesanan jendela aluminium."
              : `${page.title} Ragil Aluminium.`
          }
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <PageTopBar
          title={isContact ? "Hubungi Kami" : heading}
          breadcrumbs={[
            { label: "Beranda", href: routeUrl("home") },
            { label: isContact ? "Hubungi Kami" : page.title, href: null },
          ]}
        />
      </section>

      {isContact ? (
        <>
          <section className="container-page !px-2.5 py-5 sm:py-6 md:!px-8 md:py-8 lg:!px-12 space-y-6 sm:space-y-8">
            {/* Header Intro Banner */}
            <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
              <div className="flex flex-col gap-1 sm:max-w-2xl">
                <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg md:text-xl">
                  Pusat Layanan & Konsultasi Pelanggan
                </h1>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Punya pertanyaan seputar ukuran khusus, spesifikasi kusen dan kaca, estimasi ongkir, atau butuh bantuan pesanan? Pilih saluran komunikasi yang paling nyaman bagi Anda di bawah ini.
                </p>
              </div>
            </div>

            {/* Saluran Komunikasi Langsung */}
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-foreground sm:text-base">Saluran Komunikasi Langsung</h2>
                <p className="text-xs text-muted-foreground">Respon cepat dari tim teknis & layanan pelanggan</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <ContactChannelCard
                  icon="whatsapp"
                  title="Chat WhatsApp"
                  badge="Respon Cepat"
                  description="Konsultasi ukuran custom, kirim foto lokasi kusen, cek estimasi harga, dan konfirmasi pesanan."
                  info={`${displayPhone} (Aktif jam kerja)`}
                  actionLabel="Chat WhatsApp Sekarang"
                  actionHref={whatsappUrl}
                  isExternal
                  isPrimary
                />

                <ContactChannelCard
                  icon="headset"
                  title="Panggilan Telepon"
                  description="Hubungi langsung staf kami untuk komunikasi mendesak atau pertanyaan langsung."
                  info={`${displayPhone} (08.00 - 17.00 WIB)`}
                  actionLabel="Telepon Sekarang"
                  actionHref={phoneHref}
                />

                <ContactChannelCard
                  icon="envelope"
                  title="Email Resmi"
                  description="Kirimkan penawaran kerja sama proyek, dokumen teknis, atau kebutuhan pengadaan."
                  info={brand.email || "ragilaluminium29@gmail.com"}
                  actionLabel="Kirim Email"
                  actionHref={`mailto:${brand.email || "ragilaluminium29@gmail.com"}`}
                />
              </div>
            </div>

            {/* Workshop & Jam Operasional */}
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-bold text-foreground sm:text-base">Lokasi Workshop & Jam Kerja</h2>
                <p className="text-xs text-muted-foreground">Kunjungi workshop kami atau ketahui waktu pelayanan</p>
              </div>

              <ContactWorkshopSection
                address={
                  brand.address ||
                  "Jln. Raya Mandiraja Wetan, Samping Barat Pom Bensin Mandiraja, Desa Mandiraja Wetan, Kec. Mandiraja, Kab. Banjarnegara, Jawa Tengah 53473"
                }
                mapsUrl={brand.maps_url}
              />
            </div>

            {/* Bantuan Cepat */}
            <ContactQuickHelpSection />
          </section>

          {/* CTA Penutup */}
          <ClosingCTASection
            eyebrow="Punya kebutuhan ukuran atau model khusus?"
            heading="Konsultasikan langsung bersama spesialis aluminium kami"
            actions={[
              {
                label: "Konsultasi WhatsApp Gratis",
                href: whatsappUrl,
                whatsappIcon: true,
                external: true,
                variant: "primary",
              },
              {
                label: "Lihat Koleksi Model",
                href: routeUrl("catalog.index"),
                variant: "secondary",
              },
            ]}
          />
        </>
      ) : (
        <section className="container-page !px-2.5 md:!px-8 lg:!px-12 py-6 md:py-8">
          {isLegal ? (
            <div className="mx-auto max-w-3xl border-t border-border pt-8">
              <article className="cms-content" dangerouslySetInnerHTML={{ __html: cleanBody }} />
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,44rem)_18rem] lg:justify-between">
              <div className="min-w-0 space-y-8">
                <article className="cms-content" dangerouslySetInnerHTML={{ __html: cleanBody }} />
              </div>

              <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
                <div className="rounded-lg border border-border bg-surface p-5">
                  <p className="text-lg font-semibold">Butuh bantuan?</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Lihat pertanyaan umum atau hubungi tim Ragil untuk informasi produk.
                  </p>
                  <div className="mt-3 grid">
                    <Link
                      href={routeUrl("faq")}
                      className="flex min-h-11 items-center justify-between border-b border-border text-sm font-semibold hover:text-primary"
                    >
                      Sering ditanyakan
                      <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      href={routeUrl("contact")}
                      className="flex min-h-11 items-center justify-between text-sm font-semibold hover:text-primary"
                    >
                      Hubungi Kami
                      <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <nav className="rounded-lg bg-surface-muted p-5" aria-label="Informasi terkait">
                  <p className="text-xs font-bold tracking-tight text-muted-foreground">Informasi lain</p>
                  <ul className="mt-3 space-y-1">
                    {[
                      ["Cara Pemesanan", "cara-pemesanan"],
                      ["Kebijakan Privasi", "privacy"],
                      ["Ketentuan Layanan", "terms"],
                    ].map(([label, routeName]) => (
                      <li key={routeName}>
                        <Link
                          href={routeUrl(routeName)}
                          className="flex min-h-10 items-center text-sm font-semibold text-foreground hover:text-primary"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            </div>
          )}
        </section>
      )}
    </PublicLayout>
  )
}
