export type Nullable<T> = T | null

export interface AuthUser {
  id: number
  name: string
  email: string
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
  cartPreview: CartPreviewItem[]
  brand: Brand
  consultationWhatsApp: ConsultationWhatsAppConfig
  announcements: Announcement[]
  flashSalePeriod?: FlashSalePeriod | null
  footer: FooterConfig
  platforms: SocialLink[]
  nav: {
    public: PublicNavigation
    admin: Record<string, AdminNavGroup>
  }
  csrf: string
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
  product?: {
    id: number
    parent_sku: string
    name: string
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
}

export interface CheckoutDetails {
  name: string
  phone: string
  email?: string | null
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
  notes?: string | null
}

export interface PublicOrderItem {
  product_name?: string | null
  name?: string | null
  quantity: number
  line_total?: number
}

export interface PublicOrderShipping {
  carrier_name?: string | null
  waybill_number?: string | null
  status?: string | null
  status_raw?: string | null
  tracking_url?: string | null
  last_status_at?: string | null
}

export interface PublicOrderTracking {
  shipping_status: string
  carrier_name?: string | null
  waybill_number?: string | null
  record_status?: string | null
  status_raw?: string | null
  last_status_at?: string | null
  tracking_url?: string | null
  order_status?: string
  payment_status?: string
  payment_method?: string | null
  total_amount?: number
  paid?: boolean
  latest_message?: string | null
  latest_at?: string | null
  timeline?: Array<{ message: string; at?: string | null; source?: string }>
}

export interface PublicOrder {
  order_number: string
  order_status: string
  payment_status: string
  payment_method?: string
  shipping_status: string
  total_amount: number
  customer_name: string
  customer_phone?: string | null
  items: PublicOrderItem[]
  shipping?: PublicOrderShipping | null
  tracking?: PublicOrderTracking | null
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
}

export interface DetailSection {
  title: string
  rows: Array<{ label: string; value: unknown }>
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
}

export interface ResourceShowProps extends Record<string, unknown> {
  title: string
  subtitle?: string | null
  fields: DetailField[]
  sections?: DetailSection[]
}
