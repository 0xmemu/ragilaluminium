import { Head } from "@inertiajs/react"

import { CategoryMenu, type CategoryMenuItem } from "@/components/public/category-menu"
import { HomeHero } from "@/components/public/home-hero"
import {
  ApaKataPelangganSection,
  CaraPesanSection,
  HasilPemasanganSection,
  KamiBantuSection,
  PalingBanyakDipesanSection,
  PilihModelProdukSection,
  UlasanPelangganWebsiteSection,
  type HowToOrderData,
} from "@/components/public/home-sections"
import PublicLayout from "@/layouts/public-layout"
import type {
  InstallationItem,
  ModelCardData,
  ProductCardData,
  PromoSlide,
  Testimonial,
} from "@/types"

interface HomepageLayoutProps {
  sections: Array<{ key: string; enabled: boolean }>
  how_to_order: HowToOrderData
}

interface HomeProps {
  promoSlides: PromoSlide[]
  modelCards: ModelCardData[]
  featuredProducts: ProductCardData[]
  popularProducts: ProductCardData[]
  categoryMenu?: CategoryMenuItem[]
  testimonials?: Testimonial[]
  marketplaceTestimonials?: Testimonial[]
  websiteTestimonials?: Testimonial[]
  installations?: InstallationItem[]
  installationMeta?: { title?: string; heading?: string; subtitle?: string } | null
  homepageLayout?: HomepageLayoutProps
}

export default function Home({
  promoSlides = [],
  modelCards = [],
  featuredProducts = [],
  popularProducts = [],
  categoryMenu = [],
  testimonials = [],
  marketplaceTestimonials,
  websiteTestimonials,
  installations = [],
  installationMeta = null,
  homepageLayout,
}: HomeProps) {
  const marketplaceItems = marketplaceTestimonials?.length
    ? marketplaceTestimonials
    : testimonials
  const websiteItems = websiteTestimonials ?? []
  const popular = popularProducts.length ? popularProducts : featuredProducts
  const sections = homepageLayout?.sections?.length
    ? homepageLayout.sections
    : [
        { key: "category_menu", enabled: true },
        { key: "banner", enabled: true },
        { key: "how_to_order", enabled: true },
      ]

  function isSectionEnabled(key: string) {
    return sections.find((section) => section.key === key)?.enabled ?? true
  }

  function renderManagedSection(key: string) {
    if (!isSectionEnabled(key)) return null

    if (key === "category_menu") {
      return categoryMenu.length ? <CategoryMenu items={categoryMenu} /> : null
    }

    if (key === "banner") {
      return <HomeHero key="banner" slides={promoSlides} />
    }
    return null
  }

  const bannerSections = sections.filter((section) => section.key === "banner")
  const showCaraPesan = isSectionEnabled("how_to_order")

  return (
    <PublicLayout>
      <Head title="Ragil Aluminium">
        <meta
          name="description"
          content="Pilih jendela, pintu, dan bouven aluminium berdasarkan model, desain, ukuran, dan harga."
        />
      </Head>

      <h1 className="sr-only">Bukaan presisi untuk rumah yang terasa lebih lega.</h1>

      {renderManagedSection("category_menu")}
      {bannerSections.map((section) => renderManagedSection(section.key))}
      <PilihModelProdukSection models={modelCards} />
      <PalingBanyakDipesanSection products={popular} />
      {showCaraPesan ? <CaraPesanSection data={homepageLayout?.how_to_order} /> : null}
      <HasilPemasanganSection items={installations} meta={installationMeta} />
      <ApaKataPelangganSection testimonials={marketplaceItems} />
      {websiteItems.length >= 10 ? (
        <UlasanPelangganWebsiteSection testimonials={websiteItems} />
      ) : null}
      <KamiBantuSection />
    </PublicLayout>
  )
}
