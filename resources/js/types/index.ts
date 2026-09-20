export type Nullable<T> = T | null

export interface AuthUser {
  id: number
  name: string
  username: string | null
}

export interface FlashMessages {
  success?: string | null
  error?: string | null
  status?: string | null
}

export interface Brand {
  name: string
  short_name: string
  tagline: string
  /** filemtime brand logo untuk cache-busting; null bila berkas tidak ada. */
  logo_version?: number | null
  email: string
  phone: string
  address: string
  hours?: string
  maps_url?: string | null
  maps_embed_url?: string | null
  units_installed_label?: string
  years_experience_label?: string
}

export interface Announcement {
  text: string
  href: string
}

export interface RouteNavItem {
  label: string
  route: string
  icon?: string
  active?: string[]
  params?: Record<string, string | number | boolean | null>
  hash?: string
  /** Capability admin yang dibutuhkan utk menampilkan menu (Foundation Track A). */
  capability?: string
  children?: RouteNavItem[]
}

export interface MegaMenuItem {
  label: string
  model?: string | null
  design?: string | null
  href?: string
}

export interface MegaMenuColumn {
  title: string
  route: string
  items: MegaMenuItem[]
}

export interface ModelMenuItem {
  label: string
  href: string
  category: string
}

export interface PublicNavigation {
  mobile_bottom?: RouteNavItem[]
  hamburger?: RouteNavItem[]
  hamburger_product?: RouteNavItem[]
  hamburger_info?: RouteNavItem[]
  hamburger_footer?: RouteNavItem[]
  hamburger_copyright?: string
  desktop_main?: RouteNavItem[]
  desktop_categories?: RouteNavItem[]
  mega_menu?: MegaMenuColumn[]
  model_menu?: ModelMenuItem[]
}

export interface AdminNavGroup {
  title?: string
  items: RouteNavItem[]
}

export interface FooterLink {
  label: string
  route?: string
  href?: string
  params?: Record<string, string | number | boolean | null>
}

export interface FooterColumn {
  title?: string
  links?: FooterLink[]
}

export interface SocialLink {
  key: string
  label: string
  href: string
  icon?: string
  /** marketplace = jual-beli; social = konten media sosial (bukan marketplace) */
  channel?: "marketplace" | "social"
}

export interface FooterConfig {
  products?: FooterColumn
  help?: FooterColumn
  company?: FooterColumn
  legal?: FooterLink[]
  social?: SocialLink[]
}

export interface CartPreviewItem {
  line_id: string
  parent_sku: string
  name: string
  variation: string
  quantity: number
  unit_price: number
  image?: string | null
}

export interface ConsultationWhatsAppConfig {
  directUrl: string | null
  directLabel: string
  phoneLabel: string
  phoneHint: string
  submitLabel: string
  /** Nomor WA otomasi (sama dengan brand.phone di storefront). */
  phone: string
}

export interface FlashSalePeriod {
  enabled: boolean
  live: boolean
  status: "disabled" | "scheduled" | "live" | "ended"
  starts_at: string | null
  ends_at: string | null
  starts_at_label: string | null
  ends_at_label: string | null
  range_label: string | null
  seconds_remaining: number | null
  daily_seconds_remaining: number | null
  daily_ends_at: string | null
}

export interface SharedPageProps extends Record<string, unknown> {
  auth: { user: AuthUser | null }
  errors?: Record<string, string>
  flash: FlashMessages
  cartCount: number
  cartPreview?: CartPreviewItem[]
  brand: Brand
  consultationWhatsApp: ConsultationWhatsAppConfig
  /**
   * CTA storefront dari Pengaturan Website > CTA Storefront. Null di halaman
   * admin. Bila `enabled` false, seluruh CTA penutup disembunyikan.
   *
   * LAPISAN PEMBANDING, bukan sumber teks: kolom bernilai null (atau daftar
   * kosong) selama admin belum menyimpan blok itu, dan komponen storefront
   * memakai teksnya sendiri. Jadi memasang fitur ini tidak pernah mengubah
   * tampilan storefront.
   *
   * `pages` memuat seluruh blok yang tampil di storefront: banner penutup,
   * kartu reusable (trust, order-help), tombol judul section beranda, dan
   * kondisi kosong. `actions` berisi tombol dengan `destination` berupa kunci
   * CtaSettings::DESTINATIONS, bukan URL bebas.
   */
  ctaSettings?: {
    enabled: boolean
    /** null selama admin belum memilih warna, banner memakai warna brand. */
    color: string | null
    pages: Record<
      string,
      {
        eyebrow: string | null
        heading: string | null
        actions: Array<{ label: string; destination: string; variant: string }>
        /** Kartu/poin blok berbentuk daftar (mis. home-help, pdp-benefits). */
        items: Array<{ label: string; description: string }>
      }
    >
  } | null
  announcements: Announcement[]
  announcementSlide?: { enabled: boolean; interval: number }
  flashSalePeriod?: FlashSalePeriod | null
  footer: FooterConfig
  platforms: SocialLink[]
  nav: {
    public: PublicNavigation
    admin: Record<string, AdminNavGroup>
  }
  csrf: string
  adminNotificationCount?: number
}

export interface SelectOption {
  value: string
  label: string
}

export interface PaginationLink {
  url: string | null
  label: string
  active: boolean
}

export interface Pagination {
  current_page: number
  last_page: number
  total: number
  per_page?: number
  links: PaginationLink[]
}

export interface ProductCardData {
  id: number
  parent_sku: string
  name: string
  short_name?: string | null

  card_key?: string | null
  product_category?: string | null
  product_model?: string | null
  design_variant?: string | null
  min_price?: number | string | null
  compare_price?: number | string | null
  discount_percent?: number | null
  flash_sale?: boolean
  cod_eligible?: boolean
  warranty_label?: string | null
  sold_count?: number | null
  /** Kehadiran stok - false memunculkan kartu redup + label "Stok habis". Default true. */
  isAvailable?: boolean
  /** State wishlist - hanya berpengaruh bila consumer menyediakan onWishlistChange. */
  isWishlisted?: boolean
  image?: string | null
  href: string
}

export interface ModelHighlight {
  icon: string
  label: string
}

export interface ModelCardData {
  title: string
  count: string
  meta: string
  desc: string
  /** Tagline singkat di dialog detail (mis. Timeless & Minimalis). */
  subtitle?: string | null
  highlights?: ModelHighlight[]
  /** Jumlah foto hasil pemasangan untuk model ini. */
  inspiration_count?: number
  /** Deep-link galeri hasil pemasangan (atau fallback listing). */
  inspiration_href?: string | null
  /** Halaman detail model (bukan popup). */
  detail_href?: string | null
  image?: string | null
  /** Galeri foto model dari Media Library (hero halaman detail model). */
  gallery?: Array<{ id: number; url: string | null; label: string | null; kind: string }>
  /** Setelan media: tampilkan foto produk di hero model (default true). */
  show_product_photos?: boolean
  href: string
  model: string
  category: string
  designs: string[]
}

export interface PromoSlide {
  id: number
  eyebrow?: string | null
  headline: string
  subheadline?: string | null
  /** Kartu promo kiri gaya campaign IKEA (layout standar promo). */
  sticker?: boolean
  /** `promo_card` = kartu 3:4 kiri; `landing` = overlay teks + badge layanan. */
  layout?: "promo_card" | "landing" | string | null
  source?: "manual" | "automatic" | "fallback" | string | null
  accent?: string | null
  image?: string | null
  image_alt?: string
  href: string
  disclaimer?: string | null
}

export interface InstallationItem {
  id: number | string
  image?: string | null
  image_url?: string | null
  label?: string | null
  /** Jumlah produk ber-dokumentasi (kartu level model). */
  product_count?: number
  photo_count?: number
  video_count?: number
  category?: string | null
  model?: string | null
  href?: string | null
  product_sku?: string | null
  /** PDP produk terkait (hasil pemasangan level produk). */
  product_href?: string | null
  /** Featured card copy from ModelProductPresentation (+ CMS desc). */
  subtitle?: string | null
  desc?: string | null
  highlights?: ModelHighlight[]
}

export interface Testimonial {
  id: number
  customer_name: string
  message?: string | null
  rating?: number | null
  source?: string | null
  location?: string | null
  image_url?: string | null
  /** Semua foto ulasan (multi-gambar); fallback ke [image_url] bila kosong. */
  images?: string[] | null
  /** Waktu ulasan dikirim (ISO 8601); null pada baris lama tanpa tanggal. */
  created_at?: string | null
  /** Varian yang dipilih pembeli, mis. "Warna: Putih · Kaca: Bening". */
  variant_label?: string | null
  /** Balasan admin atas ulasan (owner 2026-09-18); null bila belum dibalas. */
  admin_reply?: string | null
  admin_replied_at?: string | null
  product?: {
    id: number
    parent_sku: string
    /** Nama pendek (short_name), mis. "200x180". */
    name: string
    /** Judul katalog lengkap; dipakai kartu ulasan. */
    full_name?: string | null
    href: string
  } | null
}

export interface ProductAttribute {
  name: string
  value: string
}

export interface ProductVariant {
  id: number
  variant_sku: string
  price: number
  sale_price?: number | null
  compare_price?: number | null
  flash_sale?: boolean
  stock: number
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  height_cm?: number | null
  width_cm?: number | null
  dimension_compact?: string | null
  dimension_label?: string | null
  label: string
}

export interface ProductMedia {
  id: number
  url?: string | null
  thumb?: string | null
  is_main_image: boolean
  is_video?: boolean
  product_variant_id?: number | null
}

export interface ProductPromoMetadata {
  compare_price?: number | null
  discount_percent?: number | null
  flash_sale?: boolean
  cod_eligible?: boolean
  warranty_label?: string
  min_price?: number | null
  has_explicit_promo?: boolean
}

export interface ProductDetailData {
  id: number
  parent_sku: string
  name: string
  short_name?: string | null
  description?: string | null
  product_category?: string | null
  product_model?: string | null
  design_variant?: string | null
  sold_count?: number | null
  category_label?: string
  model_label?: string
  design_label?: string
  subtitle?: string
  category_href?: string
  model_href?: string
  breadcrumbs?: Array<{ label: string; href: string | null }>
}

export interface CartItem {
  line_id: string
  parent_sku: string
  variant_sku?: string | null
  name: string
  short_name?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  unit_price: number
  compare_price?: number | null
  discount_percent?: number | null
  flash_sale?: boolean
  stock?: number
  quantity: number
  line_total: number
  line_compare_total?: number
  line_discount?: number
  image?: string | null
  /** Catatan per-produk dari pembeli (keputusan #11). */
  note?: string | null
}

export interface CheckoutDetails {
  name: string
  phone: string
  province: string
  city: string
  district: string
  village: string
  province_id: string
  city_id: string
  district_id: string
  village_id: string
  address_line1: string
  address_line2?: string | null
  postal_code: string
}

export interface PublicOrderItem {
  product_name?: string | null
  name?: string | null
  product_id?: number | null
  parent_sku?: string | null
  quantity: number
  line_total?: number
  image?: string | null
  /** Catatan per-produk dari pembeli (keputusan #11). */
  note?: string | null
  variant_label?: string | null
}

export interface OrderEta {
  production_days: number
  min_days: number
  max_days: number
  range_label: string
  start_at: string
  end_at: string
}

export interface PublicOrderShipping {
  carrier_name?: string | null
  waybill_number?: string | null
  status?: string | null
  tracking_url?: string | null
  last_status_at?: string | null
}

export interface PublicOrderTracking {
  shipping_status: string
  carrier_name?: string | null
  waybill_number?: string | null
  record_status?: string | null
  last_status_at?: string | null
  tracking_url?: string | null
  order_status?: string
  payment_status?: string
  payment_method?: string | null
  total_amount?: number
  paid?: boolean
  latest_message?: string | null
  latest_at?: string | null
  timeline?: Array<{ message: string; detail?: string | null; location?: string | null; at?: string | null; source?: string }>
}


export interface TrackingPrimaryStatus {
  key: string
  label: string
  tone: "neutral" | "info" | "success" | "warning" | "danger"
  headline: string
  message: string
  updatedAt?: string
}

export interface TrackingActionRequired {
  type: "pay_now" | "await_verification" | "contact_support" | "none"
  title: string
  message: string
  ctaLabel?: string
  ctaHref?: string
}

export interface TrackingMilestone {
  key: string
  label: string
  state: "completed" | "current" | "upcoming" | "exception"
  occurredAt?: string
  customerMessage?: string
}

export interface OrderTrackingViewModel {
  primaryStatus: TrackingPrimaryStatus
  actionRequired?: TrackingActionRequired | null
  milestones: TrackingMilestone[]
  estimate?: { label: string; startAt?: string; endAt?: string; isShipEstimate: boolean } | null
  recipient: {
    customerName: string
    phoneMasked: string
    city: string
    province: string
    method: string
  }
  carrier?: {
    carrierName: string
    waybill: string
    trackingUrl?: string | null
    lastStatusAt?: string | null
    paymentTerm: string
    payAmount: number
  } | null
  payment: {
    paymentMethod: string
    statusLabel: string
    statusKey: string
    total: number
    paidAt?: string | null
    bank?: {
      bank_name: string
      account_name: string
      account_number: string
      notes: string
    } | null
  }
  shipment: {
    hasWaybill: boolean
    waybill: string | null
    carrierName: string | null
    statusKey: string
    label: string
    officialTrackingUrl: string | null
    location: string | null
    latestEventText: string | null
    latestEventAt: string | null
    syncedAt: string | null
    trackingAvailable: boolean
    stale: boolean
  }
  customerStatus: {
    key: string
    title: string
    description: string
    position: string | null
    source: "store" | "carrier" | "system"
    eventAt: string | null
    syncedAt: string | null
    stale: boolean
    attention: boolean
    stage: string
  }
  summary: {
    steps: Array<{
      key: string
      label: string
      state: "completed" | "current" | "upcoming" | "attention" | "exception"
      icon: string
    }>
  }
  position: {
    stateKey: string
    text: string
    description: string
    latestEventAt: string | null
    syncedAt: string | null
    stale: boolean
  }
  events: Array<{
    key: string
    label: string
    at: string | null
    position: string
    source: "store" | "carrier"
    detail: {
      location?: string | null
      origin?: string | null
      destination?: string | null
      courierName?: string | null
      courierPhone?: string | null
    } | null
  }>
  progress: Array<{
    key: string
    label: string
    state: "completed" | "current" | "upcoming" | "attention" | "exception"
    occurredAt?: string
  }>
  canShowCarrierDetails: boolean
}

export interface PublicOrderReview {
  id: number
  product_id?: number | null
  rating: number
  message: string
  media_items?: Array<{ type: "image" | "video"; url: string; source?: string }>
  moderation_status: string
  published: boolean
  verified_purchase: boolean
  customer_authored: boolean
}

export interface PublicOrder {
  order_number: string
  order_status: string
  payment_status: string
  payment_method?: string
  created_at?: string
  shipping_status: string
  total_amount: number
  billing?: {
    subtotal: number
    discount: number
    voucher_discount: number
    shipping_gross: number
    shipping_subsidy: number
    shipping_net: number
    cod_fee: number
    insurance: number
    total: number
  }
  customer_name: string
  shipping_address?: string | null
  eta?: OrderEta | null
  items: PublicOrderItem[]
  reviews?: PublicOrderReview[]
  shipping?: PublicOrderShipping | null
  tracking?: PublicOrderTracking | null
  whatsapp_url?: string | null
  delivered_at?: string | null
  return_block?: {
    eligible: boolean
    reason?: string | null
    deadline?: string | null
  } | null
  return_whatsapp_url?: string | null
  tracking_public?: PublicOrderTracking | null
  vm?: OrderTrackingViewModel | null
}

export interface ResourceColumn {
  key: string
  label: string
  hrefKey?: string
  format?: "idr" | "date" | "datetime" | string
}

/** Optional row ops for ResourceIndex shells (POST/link). */
export interface ResourceRowAction {
  label: string
  href?: string
  method?: "get" | "post" | "put" | "delete"
  url?: string
  confirm?: string
}

export type ResourceRow = Record<string, unknown> & {
  actions?: ResourceRowAction[]
}

export interface DetailField {
  label: string
  value: unknown
  /**
   * "text" = tampilkan apa adanya (tanpa humanize), untuk teks bebas seperti
   * deskripsi atau ringkasan ukuran. Tanpa ini humanize() mengubah tiap kata
   * jadi Title Case ("6,6 kg" -> "6,6 Kg", "129.666 unit" -> "129.666 Unit").
   */
  format?: "idr" | "date" | "datetime" | "text"
}

export interface DetailSection {
  title: string
  rows: Array<{
    label: string
    value: unknown
    format?: "text"
    meta?: string | null
    thumb_url?: string | null
  }>
}

export interface ResourceIndexProps {
  title: string
  description?: string | null
  createHref?: string | null
  /** Extra header links (e.g. Performa Import from Import list). */
  toolbarLinks?: Array<{ label: string; href: string }>
  columns: ResourceColumn[]
  rows: ResourceRow[]
  pagination?: Pagination
  assetLibrary?: Array<{
    id: number
    label: string
    kind: string
    status: string
    usage_count: number
    preview_url?: string | null
    attach_url: string
  }>
  assetFilters?: { q: string; kind: string; status: string }
  productSearch?: string
  productOptions?: Array<{ id: number; label: string }>
}

export interface ResourceShowProps extends Record<string, unknown> {
  title: string
  subtitle?: string | null
  fields: DetailField[]
  sections?: DetailSection[]
}
