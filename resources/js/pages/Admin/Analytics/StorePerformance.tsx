import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { DeltaBadge } from "@/components/admin/ui/delta-badge"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Sheet, SheetContent } from "@/components/admin/ui/sheet"
import AdminLayout from "@/layouts/admin-layout"
import type { DeltaComparison } from "@/lib/delta-comparison"
import {
  formatCurrency,
  formatDate,
  formatJamIso,
  formatKontrak,
  formatKontrakChart,
  formatDurationVis,
  formatNumber,
  formatWaktuIso,
} from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { HintTip } from "@/components/admin/ui/hint-tip"

interface Kpi {
  key: string
  label: string
  value: number
  /** Kosong untuk metrik snapshot yang tidak punya periode pembanding. */
  previous?: number | null
  change_percent: number | null
  format: "currency" | "number" | "percent" | "hours" | "days"
  detail?: string | null
  /**
   * Nilai periode ini dan periode sebelumnya, dirakit halaman untuk
   * keterangan badge perubahan. Kosong untuk metrik bercakupan sekarang,
   * karena angkanya tidak dibandingkan dengan periode sebelumnya.
   */
  comparison?: DeltaComparison
}

interface Section {
  key: string
  title: string
  kpis: Kpi[]
}

interface SeriesPoint {
  bucket: string
  label: string
  value: number
  previous_value?: number
  previous_label?: string | null
}

interface ChartBlock {
  key: string
  title: string
  total: number
  previous_total?: number
  total_format: "currency" | "number" | "percent"
  /** Salah bila jendela pembanding berada di luar era pencatatan pengunjung. */
  previous_measured?: boolean
  series: SeriesPoint[]
  previous_series?: SeriesPoint[]
}

interface Report {
  range: {
    period: string
    label: string
    from_date: string
    to_date: string
    /** Tanggal ISO, dipakai untuk perbandingan; from_date hanya untuk tampilan. */
    from_date_iso?: string
    to_date_iso?: string
    granularity: string
    compare_label: string
    range_detail?: string
    compare_from_date: string
    compare_to_date: string
    is_running: boolean
    /** Parameter tanggal yang diminta tetapi tidak dipakai karena bukan tanggal. */
    input_diabaikan?: string[]
    /** Benar bila rentang yang diminta melewati hari ini sehingga dipotong. */
    rentang_dipotong?: boolean
  }
  generated_at: string
  financial: {
    gross_revenue: number
    items_before_discount?: number
    insurance?: number
    shipping_raw?: number
    product_discount?: number
    voucher_discount?: number
    shipping_paid_by_customer?: number
    shipping_subsidy?: number
    cod_fee?: number
    refund_adjustments: number
    return_shipping_store?: number
    net_revenue: number
    buyer_orders?: number
    /** Jumlah pembeli unik, dihitung server supaya tidak dibulatkan ulang. */
    buyers?: number
    visitors?: number
    /** Tanggal paling awal data kunjungan yang layak dipercaya. */
    visitors_available_from?: string | null
    payments_received?: number
    cod_paid?: number
    cod_pending_amount?: number
    cod_pending_count?: number
    /** Dana COD belum cair untuk pesanan yang DIBUAT dalam periode terpilih. */
    cod_pending_in_period_amount?: number
    cod_pending_in_period_count?: number
    payment_pending_count?: number
    refused_goods_value?: number
    refused_borne_count?: number
    refused_shipping_cost?: number
    refused_cod_fee?: number
    refused_borne_cost?: number
    definition: string
  }
  sections: Section[]
  /**
   * Apakah rentang pembanding punya pesanan sama sekali. Bila false, badge
   * perubahan pada kartu tidak bermakna.
   */
  previous_has_data?: boolean
  /**
   * Cakupan dan tanggal acuan tiap metrik, dari kontrak server. Dipakai tabel
   * Dasar Setiap Metrik di kategori Referensi.
   */
  metric_basis?: Record<string, { scope: "current" | "period"; anchor: string | null; marker: string | null; unit: string | null }>
  date_contract?: Record<string, string>
  /** Ongkir retur per kasus yang ongkirnya ditanggung toko. */
  return_shipping_costs?: Array<{
    order_id: number
    order_number: string | null
    completed_at: string | null
    fault_party: string | null
    reason: string | null
    return_shipping_cost: number
  }>
  charts: ChartBlock[]
  top_products: Array<{
    parent_sku: string
    name: string
    image?: string | null
    units: number
    revenue: number
    order_count: number
  }>
  customers: Array<{
    customer_name: string
    customer_phone: string
    order_count: number
    total_spent: number
    last_order_at: string | null
  }>
  payment_mix: Array<{ method: string; count: number; revenue: number }>
  product_breakdowns: {
    most_viewed: Array<{ product_id: number; parent_sku: string; name: string; image: string | null; views: number; clicks: number; total: number }>
    most_clicked: Array<{ product_id: number; parent_sku: string; name: string; image: string | null; views: number; clicks: number; total: number }>
    best_sellers: Array<{ product_id: number; parent_sku: string; name: string; image?: string | null; units: number; revenue: number; order_count: number }>
  }
}


/**
 * Format nilai total dan pembanding pada grafik tren. Satu tempat saja supaya
 * rupiah, persen, dan angka polos tidak berbeda antar chart.
 */
function formatChartValue(value: number | undefined, totalFormat: string): string {
  return formatKontrakChart(value, totalFormat)
}

function formatDuration(value: number, isDays = false): string {
  return formatDurationVis(value, isDays)
}

const TrendChart = React.lazy(() => import("@/components/admin/charts/trend-chart"))

function HoverHint({
  label,
  hint,
  className,
  side,
  align,
}: {
  label: React.ReactNode
  hint?: string
  className?: string
  side?: "top" | "bottom" | "auto"
  align?: "left" | "right" | "auto"
}) {
  // Satu komponen hint untuk seluruh halaman, di components/admin/ui/hint-tip.
  return <HintTip label={label} hint={hint} className={className} side={side} align={align} />
}


type ProductBreakdown = {
  product_id: number
  parent_sku: string
  name: string
  image?: string | null
  units?: number
  revenue?: number
  order_count?: number
  views?: number
  clicks?: number
  total?: number
}

type ProductBreakdownGridProps = {
  breakdowns: {
    most_viewed: ProductBreakdown[]
    most_clicked: ProductBreakdown[]
  }
  onViewAll: () => void
}

function ProductBreakdownGrid({
  breakdowns,
  onViewAll,
  tab,
}: ProductBreakdownGridProps & { tab: "viewed" | "clicked" }) {
  // Tab dipilih di header kartu analisis produk (tombolnya di sana); komponen
  // ini hanya merender konten sesuai tab yang aktif.
  const data = tab === "viewed" ? breakdowns.most_viewed : breakdowns.most_clicked

  // Batasi persis 6 produk di kartu ringkas
  const previewRows = data.slice(0, 6)

  return (
    <section className="flex flex-col justify-between">
      <div className="p-5 pb-0">

        <EngagementList rows={previewRows} />
        {data.length === 0 ? (
          <EmptyState className="min-h-24 border-0 bg-transparent py-8" title="Belum ada data" description="Belum ada interaksi produk pada periode ini." />
        ) : null}
      </div>

      {data.length > 0 ? (
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewAll}
            className="w-full text-xs font-semibold"
          >
            Lihat semua {data.length} produk ({tab === "viewed" ? "Paling Dilihat" : "Paling Diklik"})
            <Icon name="arrow-right" className="ml-1.5 size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function EngagementList({ rows }: { rows: ProductBreakdown[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-3 divide-y divide-border">
      {rows.map((p) => (
        <article key={p.product_id} className="flex items-center gap-3 py-2">
          {p.image ? (
            <img src={p.image} alt={p.name} className="size-9 shrink-0 rounded-md object-cover border border-border" />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">
              {p.name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-normal text-foreground" title={p.name}>{p.name}</p>
            <div className="flex items-center gap-1">
              <span className="truncate font-mono text-xs text-muted-foreground">{p.parent_sku}</span>
              <CopyButton text={p.parent_sku} label="Salin SKU" compact showTextInTitle />
            </div>
          </div>
          <div className="text-right text-xs tabular-nums">
            <p className="font-semibold text-foreground">{formatNumber(p.views ?? 0)} dilihat</p>
            <p className="text-[11px] text-muted-foreground">{formatNumber(p.clicks ?? 0)} klik</p>
          </div>
        </article>
      ))}
    </div>
  )
}

/* ==========================================================================
   Detail per kategori.

   Halaman ini dulu membuka tiga belas drawer berbeda, satu per KPI. Sekarang
   hanya ada SATU drawer, dan isinya dipilih lewat filter kategori di baris
   filter.

   Kenapa satu drawer dan bukan permintaan ke server per kategori: membangun
   laporan butuh 418 ms dengan 177 query (diukur 2026-09-21). Kalau berpindah
   kategori memicu permintaan, biaya itu dibayar ulang setiap kali. Karena itu
   pemilihan kategori HANYA mengubah state lokal: tanpa permintaan, tanpa byte
   jaringan, drawer terbuka seketika.

   Seluruh angka dibaca dari props `report` dan `kpiMap`. Tidak ada nilai yang
   ditulis di komponen ini.
   ========================================================================== */

/** Kategori drawer. Urutan di sini menentukan urutan pil di filter dan drawer. */
type DetailCategory =
  | "penjualan"
  | "arus-kas"
  | "operasional"
  | "pengunjung"
  | "retur"
  | "katalog"
  | "referensi"

const DETAIL_CATEGORIES: Array<{ key: DetailCategory; label: string }> = [
  { key: "penjualan", label: "Penjualan" },
  { key: "arus-kas", label: "Arus Kas" },
  { key: "operasional", label: "Operasional" },
  { key: "pengunjung", label: "Pengunjung & Pelanggan" },
  { key: "retur", label: "Retur & Pembatalan" },
  { key: "katalog", label: "Katalog" },
  { key: "referensi", label: "Referensi & Kelengkapan" },
]

/**
 * Batas baris daftar di dalam drawer. Daftar penuh ada di modal katalog dan di
 * ekspor XLSX, jadi drawer tidak perlu menyalin seluruhnya dan jumlah simpul
 * DOM yang dibuat tetap terbatas.
 */
const DETAIL_LIST_LIMIT = 12

type DetailSign = "+" | "−" | "=" | "÷" | "·"

type DetailRow = {
  label: string
  value: string
  sign: DetailSign
  sub?: string
  note?: string
  tone?: "default" | "primary" | "destructive"
  /** Persentase perubahan. undefined berarti badge tidak ditampilkan. */
  delta?: number | null
  /** Keterangan yang muncul saat badge perubahan diarahkan kursor. */
  comparison?: DeltaComparison
  /** Kunci metrik payload yang dimuat baris ini, untuk data-metric-key. */
  metricKey?: string
  /** Cakupan metrik dari metric_basis, sumber badge pembeda kartu. */
  scope?: "period" | "current"
  /** Penanda cakupan dari payload, mis. "kondisi saat ini" atau "semua waktu". */
  marker?: string | null
}

type DetailBlock =
  | { kind: "rows"; title?: string; rows: DetailRow[]; bandingkan?: boolean; sub?: string; mode?: "kartu" | "tabel" }
  | { kind: "items"; title?: string; items: Array<{ title: string; value: string; desc: string }> }
  | { kind: "list"; title?: string; head: string[]; rows: string[][]; total: number; rowKeys?: string[] }

type CategoryDetail = {
  title: string
  badge: string
  intro?: string
  formula?: string
  blocks: DetailBlock[]
  source?: string
  notes: string[]
}

/** Skala grafik dalam bahasa pembaca, bukan kode internal. */
function labelGranularitas(granularity: string): string {
  const peta: Record<string, string> = {
    hour: "Per Jam",
    day: "Per Hari",
    week: "Per Minggu",
    month: "Per Bulan",
    year: "Per Tahun",
  }
  return peta[granularity] ?? granularity
}

/** Waktu laporan dalam WIB, bukan cap waktu ISO mentah. */
function formatWaktuWib(iso: string): string {
  return formatWaktuIso(iso)
}

/** Pihak yang menanggung ongkir retur, dalam bahasa toko. */
function labelPenanggung(nilai: string | null): string {
  if (!nilai) return "-"
  const peta: Record<string, string> = {
    store: "Toko",
    customer: "Pembeli",
    seller: "Toko",
    buyer: "Pembeli",
    other: "Lainnya",
  }
  return peta[nilai] ?? "Lainnya"
}

/** Metode pembayaran apa adanya. Tidak menebak "Transfer Bank" untuk metode lain. */
function labelMetodeBayar(metode: string): string {
  const kunci = metode.trim().toLowerCase()
  const peta: Record<string, string> = {
    cod: "COD",
    transfer: "Transfer Bank",
    bank_transfer: "Transfer Bank",
    gateway: "Pembayaran Online",
    other: "Lainnya",
  }
  return peta[kunci] ?? "Metode Lain"
}

/**
 * Nilai diformat dari angka dan satuannya. Dipakai untuk nilai periode ini
 * maupun nilai periode sebelumnya, supaya keterangan pembanding memakai satuan
 * yang sama persis dengan angka di kartu.
 */
function formatNilaiKpi(nilai: number | null | undefined, format: Kpi["format"]): string {
  return formatKontrak(nilai, format)
}

/** Satu tempat untuk mengubah nilai KPI menjadi teks, supaya satuan seragam. */
function formatKpiValue(kpi: Kpi): string {
  return formatKontrak(kpi.value, kpi.format)
}

/**
 * Baris dari satu kunci KPI. Mengembalikan null bila kuncinya tidak ada, supaya
 * kategori tidak pernah menampilkan baris kosong atau label kosong.
 */
function kpiRow(
  kpiMap: Record<string, Kpi>,
  key: string,
  sign: DetailSign = "·",
  laporan?: Report,
): DetailRow | null {
  const kpi = kpiMap[key]
  if (!kpi) return null
  // Status penyajian dibaca dari metric_basis payload, bukan dari nilai atau
  // label. Metrik bercakupan sekarang tidak pernah diberi delta periode.
  const status = laporan ? displayComparison(laporan, kpi) : null
  const delta = status
    ? status.pakaiDelta
      ? (kpi.change_percent ?? undefined)
      : undefined
    : adalahSnapshot(kpi)
      ? undefined
      : (kpi.change_percent ?? undefined)
  const basis = laporan?.metric_basis?.[key]
  const hintParts = [
    kpi.detail ?? null,
    basis?.marker ? "Cakupan: " + basis.marker : null,
    basis?.anchor ? "Acuan: " + basis.anchor : null,
    basis?.unit ? "Satuan: " + basis.unit : null,
  ].filter(Boolean)

  return {
    label: kpi.label,
    value: formatKpiValue(kpi),
    sign,
    metricKey: key,
    note: hintParts.length > 0 ? hintParts.join(" · ") : (kpi.detail ?? undefined),
    delta,
    comparison: delta === undefined ? undefined : kpi.comparison,
  }
}

/**
 * Metrik dengan cakupan sekarang tidak punya periode pembanding, sehingga
 * server mengirim nilai pembandingnya kosong. Itu penandanya.
 */
function adalahSnapshot(kpi?: Kpi): boolean {
  return kpi !== undefined && kpi.previous === null
}

/**
 * Cakupan metrik dibaca dari metric_basis payload, satu-satunya sumber.
 * Dilarang menyimpulkan scope dari nilai, label, kelompok, atau bentuk angka.
 */
function scopeMetrik(
  report: Report,
  key: string,
): "period" | "current" {
  return report.metric_basis?.[key]?.scope === "current" ? "current" : "period"
}

/**
 * Status penyajian perbandingan satu metrik. Helper ini TIDAK menghitung apa
 * pun: ia membaca scope dari metric_basis dan delta dari payload, lalu
 * memutuskan bagaimana barisnya ditampilkan.
 */
function displayComparison(
  report: Report,
  kpi: Pick<Kpi, "key" | "previous" | "change_percent"> | undefined,
): { bandingkan: boolean; pakaiDelta: boolean } {
  if (!kpi || scopeMetrik(report, kpi.key) === "current") {
    return { bandingkan: false, pakaiDelta: false }
  }
  return { bandingkan: true, pakaiDelta: kpi.change_percent !== null }
}

/**
 * Kelompok resmi UI menurut scope. Diperbarui dari payload metric_basis:
 * kunci yang tidak dikenal masuk "tak-terpetakan" dan test mapping akan merah.
 */
export const KELOMPOK_SNAPSHOT = new Set([
  "open_orders",
  "dispatched_orders",
  "returns_open",
  "payment_pending_count",
  "cod_pending_amount",
  "cod_pending_count",
])

export function kelompokMetrik(report: Report, key: string): "periode" | "kini" | "tak-terpetakan" {
  const scope = report.metric_basis?.[key]?.scope
  if (scope === "current") return "kini"
  if (scope === "period") return "periode"
  return "tak-terpetakan"
}

/**
 * Label tanpa penanda cakupan. Tabel Dasar Setiap Metrik sudah punya kolom
 * Cakupan sendiri, jadi penanda di label akan terduplikasi di situ. Yang dibuang
 * hanya dua frasa cakupan, bukan tanda kurung lain pada label.
 */
function labelTanpaCakupan(label: string): string {
  return label.replace(/\s*\((kondisi saat ini|semua waktu)\)$/, "")
}

/** Label untuk metrik ber-cakupan yang tidak tampil sebagai kartu KPI. */
const LABEL_KONTRAK_TANGGAL: Record<string, string> = {
  timezone: "Zona Waktu",
  start_boundary: "Batas Mulai",
  end_boundary: "Batas Selesai",
  running_period: "Periode Berjalan",
  comparison: "Cara Membandingkan",
  per_metric: "Tanggal Acuan per Metrik",
  recognition: "Pengakuan Penjualan",
}

const LABEL_DASAR_TAMBAHAN: Record<string, string> = {
  cod_pending_amount: "Belum Masuk, nilai",
  cod_pending_count: "Belum Masuk, jumlah pesanan",
  cod_pending_in_period_amount: "Belum Masuk periode ini, nilai",
  cod_pending_in_period_count: "Belum Masuk periode ini, jumlah pesanan",
  buyers: "Pembeli Unik",
}


/** Kumpulkan baris KPI, buang yang tidak ada di payload. */
function kpiRows(
  kpiMap: Record<string, Kpi>,
  keys: string[],
  laporan?: Report,
  sign: DetailSign = "·",
): DetailRow[] {
  return keys
    .map((key) => kpiRow(kpiMap, key, sign, laporan))
    .filter((row): row is DetailRow => row !== null)
}

/**
 * Apakah kolom daftar berisi teks, bukan angka. Dipakai kepala dan isi tabel
 * sekaligus supaya perataannya tidak pernah berbeda.
 */
function isKolomTeks(judul: string): boolean {
  return /nama|sku|metode|penanggung|keterangan|uraian|produk|cakupan|acuan|perbandingan/i.test(judul)
}

/** Potong daftar dan sertakan jumlah totalnya supaya sisanya tidak disembunyikan. */
function daftarTerbatas<T>(items: T[]): { rows: T[]; total: number } {
  return { rows: items.slice(0, DETAIL_LIST_LIMIT), total: items.length }
}

function bangunKategoriDetail(
  category: DetailCategory,
  report: Report,
  kpiMap: Record<string, Kpi>,
  kunjunganTidakLengkap: boolean,
  tersediaSejak: string | null,
): CategoryDetail {
  const fin = report.financial
  const range = report.range
  const rp = formatCurrency
  const ang = formatNumber
  const badgePeriode = "Periode Terpilih"

  const catatanKunjungan: string[] =
    kunjunganTidakLengkap && tersediaSejak
      ? [
          "Data kunjungan baru andal sejak " +
            tersediaSejak +
            ". Rentang yang mulai sebelum tanggal itu tidak menampilkan angka kunjungan dan konversi.",
        ]
      : []

  // Dipakai jalur pembentukan Penjualan Gross, yang muncul di kategori
  // Penjualan maupun Arus Kas.
  const pembentukanGross: DetailRow[] = [
    {
      label: "Nilai Produk Terjual",
      value: rp(fin.items_before_discount ?? 0),
      sign: "+",
      metricKey: "items_before_discount",
      sub: "Subtotal nilai produk sebelum dipotong voucher toko dan ongkir.",
    },
    {
      label: "Voucher Toko",
      value: rp(fin.voucher_discount ?? 0),
      sign: "−",
      metricKey: "voucher_discount",
      sub: "Potongan harga dari voucher promosi toko yang digunakan pembeli.",
    },
    {
      label: "Ongkir Dibayar Pembeli",
      value: rp(fin.shipping_paid_by_customer ?? 0),
      sign: "+",
      metricKey: "shipping_paid_by_customer",
      sub: "Biaya pengiriman kargo yang dibayarkan pembeli saat checkout.",
    },
    {
      label: "Asuransi Pengiriman",
      value: rp(fin.insurance ?? 0),
      sign: "+",
      metricKey: "insurance",
      sub: "Biaya asuransi perlindungan barang yang dibayarkan pembeli.",
    },
    {
      label: "Biaya COD Dibayar Pembeli",
      value: rp(fin.cod_fee ?? 0),
      sign: "+",
      metricKey: "cod_fee",
      sub: "Biaya administrasi layanan bayar di tempat dari pembeli.",
    },
    {
      label: "Total Penjualan Gross",
      value: rp(fin.gross_revenue),
      sign: "=",
      tone: "primary",
      metricKey: "omzet",
      sub: "Total transaksi pesanan yang masuk alur pemenuhan.",
      delta: kpiMap["omzet"]?.change_percent,
    },
  ]

  switch (category) {
    case "penjualan":
      return {
        title: "Penjualan",
        badge: badgePeriode,
        intro: "Angka penjualan pada periode terpilih, termasuk dua rata-rata dan cara keduanya dibentuk.",
        blocks: [
          {
            kind: "rows",
            title: "Ringkasan Penjualan",
            rows: kpiRows(kpiMap, [
              "omzet",
              "orders",
              "models",
              "sub_models",
              "products",
              "units",
              "completed_orders",
            ], report),
          },
          {
            kind: "rows",
            title: "Rata-rata Nilai Pesanan",
            rows: [
              {
                label: "Penjualan Gross",
                value: rp(fin.gross_revenue),
                sign: "+",
                metricKey: "omzet",
                sub: "Total transaksi penjualan kotor pada periode ini.",
              },
              {
                label: "Jumlah Pesanan",
                value: ang(kpiMap["orders"]?.value ?? 0) + " pesanan",
                sign: "÷",
                metricKey: "orders",
                sub: "Total pesanan valid pada periode ini.",
              },
              {
                label: "Rata-rata Nilai Pesanan",
                value: rp(kpiMap["aov"]?.value ?? 0),
                sign: "=",
                tone: "primary",
                metricKey: "aov",
                sub: "Penjualan Gross dibagi Jumlah Pesanan (Average Order Value).",
              },
            ],
          },
          {
            kind: "rows",
            title: "Harga Rata-rata per Unit",
            rows: [
              {
                label: "Nilai Produk",
                value: rp(fin.items_before_discount ?? 0),
                sign: "+",
                metricKey: "items_before_discount",
                sub: "Subtotal produk pada pesanan, sebelum ongkir dan biaya layanan COD.",
              },
              {
                label: "Jumlah Unit Terjual",
                value: ang(kpiMap["units"]?.value ?? 0) + " unit",
                sign: "÷",
                metricKey: "units",
                sub: "Total kuantitas barang fisik yang terjual pada periode ini.",
              },
              {
                label: "Harga Rata-rata per Unit",
                value: rp(kpiMap["avg_unit_price"]?.value ?? 0),
                sign: "=",
                tone: "primary",
                metricKey: "avg_unit_price",
                sub: "Nilai Produk dibagi Jumlah Unit Terjual.",
              },
            ],
          },
        ],
        formula:
          "Rata-rata Nilai Pesanan = Penjualan Gross dibagi Jumlah Pesanan. Harga Rata-rata per Unit = Nilai Produk dibagi Jumlah Unit Terjual.",
        source: "Data pesanan dan item pesanan",
        notes: [
          "Pesanan yang belum dikonfirmasi, menunggu pembayaran, atau dibatalkan tidak dihitung.",
          "Produk Terjual menghitung SKU varian berbeda, jadi satu produk dengan dua ukuran dihitung dua.",
          "Unit dan nilai produk diambil dari snapshot pesanan saat checkout, bukan dari katalog aktif.",
          "Harga Rata-rata per Unit memakai Nilai Produk, bukan Penjualan Gross, supaya ongkir dan biaya COD tidak ikut terbagi ke harga satuan.",
        ],
      }

    case "arus-kas": {
      const blocks: DetailBlock[] = [
        { kind: "rows", title: "A. Pembentukan Penjualan Gross", rows: pembentukanGross },
        {
          kind: "rows",
          title: "B. Pengurang setelah Penjualan Gross",
          rows: [
            {
              label: "Tagihan J&T",
              value: rp(fin.shipping_raw ?? 0),
              sign: "−",
              metricKey: "shipping_raw",
              sub:
                "Ongkir dibayar pembeli " +
                rp(fin.shipping_paid_by_customer ?? 0) +
                " · Asuransi dibayar pembeli " +
                rp(fin.insurance ?? 0) +
                " · Subsidi ongkir ditanggung toko " +
                rp(fin.shipping_subsidy ?? 0),
              note: "Tagihan J&T adalah satu-satunya pengurang ongkir. Baris rincian di atas menjelaskan komposisinya, bukan pengurang tambahan. Komposisi memakai tarif J&T saat checkout (ongkir pembeli + asuransi + subsidi toko); angka kepala memakai tagihan final J&T setelah paket ditimbang kurir. Keduanya dihitung sistem J&T yang sama, hanya berbeda waktu, sehingga nominalnya bisa berbeda tipis.",
            },
            {
              label: "Biaya COD ke J&T",
              value: rp(fin.cod_fee ?? 0),
              sign: "−",
              metricKey: "cod_fee",
              sub: "Biaya penanganan transaksi COD yang disetorkan ke ekspedisi kargo.",
            },
            {
              label: "Refund diberikan",
              value: rp(fin.refund_adjustments ?? 0),
              sign: "−",
              metricKey: "refund_given",
              sub: "Total pengembalian dana yang disetujui pada kasus retur selesai.",
            },
            {
              label: "Ongkir retur toko",
              value: rp(fin.return_shipping_store ?? 0),
              sign: "−",
              metricKey: "return_shipping_cost_total",
              sub: "Biaya pengiriman retur barang yang ditanggung oleh toko.",
            },
            {
              label: "Nilai barang retur paket",
              value: rp(fin.refused_goods_value ?? 0),
              sign: "−",
              metricKey: "refused_goods_value",
              sub: "Nilai produk pada paket kiriman yang ditolak pembeli saat COD.",
            },
            {
              label: "Penjualan Bersih",
              value: rp(fin.net_revenue),
              sign: "=",
              metricKey: "net_revenue",
              tone: "primary",
              delta: kpiMap["net_revenue"]?.change_percent,
            },
          ],
        },
      ]

      if ((fin.product_discount ?? 0) !== 0) {
        blocks.push({
          kind: "items",
          title: "C. Catatan di Luar Kas",
          items: [
            {
              title: "Diskon Produk atau Flash Sale",
              value: rp(fin.product_discount ?? 0),
              desc: "Selisih harga coret terhadap harga jual. Tidak ada uang yang bergerak, hanya potensi harga yang tidak diambil. Harga jual yang dibayar pembeli sudah tercatat pada Nilai Produk di bagian A.",
            },
          ],
        })
      }

      // Posisi kas DIPECAH menurut scope metric_basis: kas yang mengikuti
      // rentang dan boleh dibandingkan, terpisah dari kondisi saat ini yang
      // tidak pernah diberi delta periode.
      blocks.push({
        kind: "rows",
        title: "D. Kas Periode Terpilih",
        rows: [
          {
            label: "Pembayaran Terverifikasi (periode ini)",
            value: rp(fin.payments_received ?? 0),
            sign: "+",
            metricKey: "payments_received",
            sub: "COD Selesai " + rp(fin.cod_paid ?? 0),
            note: "Basis waktunya dana benar-benar lunas, berbeda dari hak penjualan barang.",
            delta: kpiMap["payments_received"]?.change_percent,
          },
          {
            label: kpiMap["cod_paid"]?.label,
            value: rp(kpiMap["cod_paid"]?.value ?? 0),
            sign: "·",
            metricKey: "cod_paid",
            sub: "Pesanan COD yang barangnya sudah sampai ke pembeli pada periode terpilih.",
            delta: kpiMap["cod_paid"]?.change_percent,
          },
          {
            label: "Belum Masuk (periode ini)",
            value: rp(fin.cod_pending_in_period_amount ?? 0),
            sign: "·",
            metricKey: "cod_pending_in_period_amount",
            sub:
              ang(fin.cod_pending_in_period_count ?? 0) +
              " pesanan COD aktif yang pesanannya dibuat dalam periode terpilih.",
          },
          {
            label: "Belum Masuk, jumlah pesanan (periode ini)",
            value: ang(fin.cod_pending_in_period_count ?? 0) + " pesanan",
            sign: "·",
            metricKey: "cod_pending_in_period_count",
            sub: "Kuantitas pesanan COD aktif yang dibuat pada periode terpilih.",
          },
          {
            label: "Retur Paket Ditanggung Toko",
            value: rp(fin.refused_borne_cost ?? 0),
            sign: "·",
            metricKey: "refused_borne_cost",
            sub:
              ang(fin.refused_borne_count ?? 0) +
              " pesanan. Ongkir kirim " +
              rp(fin.refused_shipping_cost ?? 0) +
              " ditambah biaya layanan COD " +
              rp(fin.refused_cod_fee ?? 0) +
              " untuk paket yang kembali sebelum diterima pembeli.",
            note: "Pembeli tidak membayar apa pun untuk paket ini, jadi toko yang menanggung tagihannya.",
          },
        ],
      })
      blocks.push({
        kind: "rows",
        title: "E. Posisi Kas Saat Ini, tidak dibandingkan periode",
        rows: [
          {
            label: "Belum Masuk (semua waktu)",
            value: rp(fin.cod_pending_amount ?? 0),
            sign: "·",
            metricKey: "cod_pending_amount",
            sub:
              ang(fin.cod_pending_count ?? 0) +
              " pesanan COD aktif. Angka ini kondisi saat ini, dihitung tanpa batas periode.",
          },
          {
            label: "Belum Masuk, jumlah pesanan (semua waktu)",
            value: ang(fin.cod_pending_count ?? 0) + " pesanan",
            sign: "·",
            metricKey: "cod_pending_count",
            sub: "Total kuantitas pesanan COD aktif yang belum selesai di seluruh waktu.",
          },
          {
            label: "Pembayaran Transfer Pending",
            value: ang(kpiMap["payment_pending_count"]?.value ?? 0) + " pembayaran",
            sign: "·",
            metricKey: "payment_pending_count",
            sub: "Pembayaran non-COD yang belum lunas pada pesanan aktif saat laporan dibangun.",
          },
        ],
      })

      if (report.payment_mix.length > 0) {
        const bauran = daftarTerbatas(report.payment_mix)
        blocks.push({
          kind: "list",
          title: "F. Bauran Metode Pembayaran",
          head: ["Metode", "Nilai Pesanan", "Pesanan"],
          total: bauran.total,
          rows: bauran.rows.map((row) => [
            labelMetodeBayar(row.method),
            rp(row.revenue),
            ang(row.count),
          ]),
        })
      }

      const ongkirReturSemua = report.return_shipping_costs ?? []
      if (ongkirReturSemua.length > 0) {
        const ongkirRetur = daftarTerbatas(ongkirReturSemua)
        blocks.push({
          kind: "list",
          title: "G. Ongkir Retur per Kasus",
          head: ["Pesanan", "Selesai", "Penanggung", "Ongkir"],
          total: ongkirRetur.total,
          rows: ongkirRetur.rows.map((row) => [
            row.order_number ?? ("#" + row.order_id),
            row.completed_at ? formatDate(row.completed_at) : "-",
            labelPenanggung(row.fault_party),
            rp(row.return_shipping_cost),
          ]),
        })
      }

      return {
        title: "Arus Kas",
        badge: badgePeriode,
        intro:
          "Dari nilai transaksi pembeli sampai uang yang benar-benar masuk kas. Kas periode terpilih dipisah dari posisi kas saat ini.",
        formula: "Penjualan Bersih = Penjualan Gross dikurangi Tagihan J&T dikurangi Retur dan Biaya Retur",
        blocks,
        source: "Data pesanan, retur, pembayaran, dan pengiriman",
        notes: [
          fin.definition,
          "Angka pembayaran diterima dan refund berasal dari pencatatan serta verifikasi manual admin di luar website (transfer bank/m-Banking), bukan mutasi otomatis perbankan.",
          "Kas Diterima memakai basis waktu dana benar-benar lunas, berbeda dari hak penjualan barang.",
          "Baris Belum Masuk dan Pembayaran Transfer Pending adalah kondisi saat ini, bukan angka periode.",
          "Ongkir dan biaya COD pada paket yang kembali sudah tercakup di Tagihan J&T dan Biaya COD ke J&T, jadi tidak dikurangkan dua kali.",
        ].filter((note): note is string => Boolean(note)),
      }
    }

    case "operasional":
      return {
        title: "Operasional",
        badge: badgePeriode,
        intro:
          "Antrean yang sedang menumpuk sekarang, ditambah kecepatan layanan pada periode terpilih.",
        blocks: [
          {
            kind: "rows",
            title: "Antrean Saat Ini, tidak dibandingkan",
            rows: kpiRows(kpiMap, ["open_orders", "dispatched_orders", "returns_open"], report),
          },
          {
            kind: "rows",
            title: "Metrik Periode Terpilih",
            rows: kpiRows(
              kpiMap,
              [
                "open_orders_in_period",
                "completed_orders",
                "avg_confirm_hours",
                "avg_process_days",
              ],
              report,
            ),
          },
          {
            kind: "rows",
            title: "Kondisi Saat Ini, tidak dibandingkan",
            rows: kpiRows(kpiMap, ["payment_pending_count"], report),
          },
        ],
        source: "Data pesanan, pengiriman, dan riwayat perubahan status",
        notes: [
          "Pesanan Belum Selesai dan Dalam Pengiriman menghitung seluruh pesanan yang berstatus itu saat laporan dibangun, tanpa melihat tanggal pembuatan. Itulah ukuran antrean yang sedang ditangani, jadi angkanya memang bisa lebih besar daripada jumlah pesanan pada periode terpilih.",
          "Pesanan Dibuat Periode Ini yang Masih Terbuka menjawab pertanyaan berbeda: dari pesanan yang masuk pada periode terpilih, berapa yang belum selesai. Angka ini terikat periode dan ikut dibandingkan.",
          "Pesanan Selesai dihitung dari waktu pesanan berpindah ke status selesai, bukan waktu pesanan dibuat, supaya pesanan lama yang selesai pada periode ini tetap terhitung.",
          "Rata-rata Waktu Konfirmasi dihitung dari pesanan masuk sampai dikonfirmasi admin. Rata-rata Waktu Proses dari dikonfirmasi sampai siap diserahkan ke kurir.",
        ],
      }

    case "pengunjung": {
      const visitors = fin.visitors ?? 0
      const rate = kpiMap["conversion"]?.value ?? 0
      // Jumlah pembeli dikirim server. Sebelumnya dihitung ulang dari
      // persentase yang sudah dibulatkan, sehingga hasilnya bisa meleset.
      const pembeli = fin.buyers ?? 0

      const blocks: DetailBlock[] = [
        {
          kind: "rows",
          title: "Kunjungan dan Konversi",
          rows: [
            {
              label: kpiMap["visitors"]?.label,
              value: kunjunganTidakLengkap ? "Belum tersedia" : ang(visitors) + " sesi",
              sign: "+",
              metricKey: "visitors",
              sub: "Dijumlah per hari, bukan hitungan unik sepanjang rentang: satu pengunjung dihitung satu sesi per hari.",
              delta: kunjunganTidakLengkap ? undefined : kpiMap["visitors"]?.change_percent,
            },
            {
              label: "Pembeli Unik",
              value: kunjunganTidakLengkap ? "Belum tersedia" : ang(pembeli) + " pembeli",
              sign: "÷",
              metricKey: "buyers",
              sub: "Dihitung dari nomor telepon berbeda pada pesanan yang sudah masuk proses.",
              delta: kpiMap["buyers"]?.change_percent,
            },
            {
              label: "Pengunjung yang Membeli",
              value: kunjunganTidakLengkap ? "Belum tersedia" : ang(rate) + "%",
              sign: "=",
              note: "Ini adalah persentase pembeli unik dibanding pengunjung unik pada periode terpilih, bukan jumlah orang.",
              metricKey: "conversion",
              tone: "primary",
            },
          ],
        },
        {
          kind: "rows",
          title: "Pelanggan",
          rows: kpiRows(kpiMap, ["new_customers", "repeat_customers", "repeat_order_rate"], report),
        },
      ]

      if (report.customers.length > 0) {
        const pelanggan = daftarTerbatas(report.customers)
        blocks.push({
          kind: "list",
          title: "Pelanggan dengan Pembelian Terbesar",
          head: ["Nama", "Telepon", "Pesanan", "Total Belanja"],
          total: pelanggan.total,
          rows: pelanggan.rows.map((row) => [
            row.customer_name ?? "-",
            row.customer_phone ?? "-",
            ang(row.order_count),
            rp(row.total_spent),
          ]),
        })
      }

      return {
        title: "Pengunjung dan Pelanggan",
        badge: badgePeriode,
        intro: "Berapa yang datang, berapa yang membeli, dan siapa yang paling banyak berbelanja.",
        formula: "Pengunjung yang Membeli = Pembeli Unik dibagi Pengunjung Unik, dikali 100 persen",
        blocks,
        source: "Data kunjungan situs dan data pesanan",
        notes: [
          "Angka konversi adalah rasio dua populasi, bukan penautan sesi ke pesanan: sistem tidak menyimpan relasi antara sesi kunjungan dan pesanan, sehingga tidak berarti orang yang mengunjungi lalu membeli.",
          "Pengunjung Unik dijumlah per hari, bukan hitungan unik sepanjang rentang, karena satu pengunjung dihitung satu sesi per hari.",
          "Nomor telepon yang hanya muncul di pesanan batal tidak dihitung, baik sebagai pelanggan baru maupun pelanggan ulang.",
          ...catatanKunjungan,
        ],
      }
    }

    case "retur": {
      const bagianRetur = report.sections.find((section) => section.key === "returns_cancellations")
      if (!bagianRetur) {
        return {
          title: "Retur dan Pembatalan",
          badge: badgePeriode,
          blocks: [],
          notes: ["Bagian retur dan pembatalan belum tersedia pada laporan ini."],
        }
      }

      // Kelompok drawer mengikuti scope metric_basis: retur aktif sekarang
      // dipisah dari retur periode supaya tidak berada di tabel ber-delta.
      const kelompok: Array<{ judul: string; kunci: string[] }> = [
        {
          judul: "Retur Periode Terpilih",
          kunci: [
            "returns",
            "return_value",
            "returns_created",
            "returns_completed",
            "return_rate_created",
            "return_rate_completed",
          ],
        },
        {
          judul: "Retur Aktif Saat Ini, tidak dibandingkan",
          kunci: ["returns_open"],
        },
        {
          judul: "Pembatalan Periode Terpilih",
          kunci: [
            "cancelled_orders",
            "cancelled_by_customer",
            "cancelled_by_store",
            "cancelled_value",
            "cancellation_rate",
          ],
        },
        {
          judul: "Dampak Beban Biaya Periode Terpilih",
          kunci: [
            "refund_given",
            "return_shipping_cost_total",
            "return_shipping_cost_cases",
            "refused_orders",
            "refused_borne_cost",
          ],
        },
      ]

      return {
        title: "Retur dan Pembatalan",
        badge: badgePeriode,
        intro: "Seluruh indikator retur, pembatalan, dan beban biaya yang ditanggung toko.",
        formula:
          "Retur dan Biaya Retur = Refund Pembeli + Ongkir Retur Ditanggung Toko + Nilai Barang Retur Paket",
        blocks: kelompok
          .map((grup) => ({ kind: "rows" as const, title: grup.judul, rows: kpiRows(kpiMap, grup.kunci, report) }))
          .filter((block) => block.rows.length > 0),
        source: "Data retur, riwayat pembatalan, dan pesanan",
        notes: [
          "Retur dan pembatalan tidak mengurangi Penjualan Gross pada periode terjadinya, melainkan mengurangi Penjualan Bersih.",
          "Refund mencakup seluruh pengembalian uang ke pembeli, termasuk pengembalian tanpa barang yang dikirim balik.",
          "Ongkir dan biaya COD pada pesanan yang paketnya kembali ditanggung toko karena pembeli tidak membayar apa pun.",
          "Retur Aktif adalah snapshot kondisi saat ini, sedangkan indikator lain pada kategori ini terikat periode terpilih.",
        ],
      }
    }

    case "katalog": {
      const blocks: DetailBlock[] = []

      if (report.top_products.length > 0) {
        const terlaris = daftarTerbatas(report.top_products)
        blocks.push({
          kind: "list",
          title: "Produk Terlaris menurut Nilai",
          head: ["Produk", "SKU", "Unit", "Pesanan", "Nilai"],
          total: terlaris.total,
          rows: terlaris.rows.map((row) => [
            row.name,
            row.parent_sku,
            ang(row.units),
            ang(row.order_count),
            rp(row.revenue),
          ]),
        })
      }

      if (report.product_breakdowns.best_sellers.length > 0) {
        const terlarisUnit = daftarTerbatas(report.product_breakdowns.best_sellers)
        blocks.push({
          kind: "list",
          title: "Produk Terlaris menurut Unit",
          head: ["Produk", "SKU", "Unit", "Pesanan", "Nilai"],
          total: terlarisUnit.total,
          rows: terlarisUnit.rows.map((row) => [
            row.name,
            row.parent_sku,
            ang(row.units),
            ang(row.order_count),
            rp(row.revenue),
          ]),
        })
      }

      if (report.product_breakdowns.most_viewed.length > 0) {
        const dilihat = daftarTerbatas(report.product_breakdowns.most_viewed)
        blocks.push({
          kind: "list",
          title: "Paling Dilihat",
          head: ["Produk", "SKU", "Dilihat", "Klik", "Total Interaksi"],
          total: dilihat.total,
          rows: dilihat.rows.map((row) => [
            row.name,
            row.parent_sku,
            ang(row.views),
            ang(row.clicks),
            ang(row.total),
          ]),
        })
      }

      if (report.product_breakdowns.most_clicked.length > 0) {
        const diklik = daftarTerbatas(report.product_breakdowns.most_clicked)
        blocks.push({
          kind: "list",
          title: "Paling Diklik",
          head: ["Produk", "SKU", "Dilihat", "Klik", "Total Interaksi"],
          total: diklik.total,
          rows: diklik.rows.map((row) => [
            row.name,
            row.parent_sku,
            ang(row.views),
            ang(row.clicks),
            ang(row.total),
          ]),
        })
      }

      return {
        title: "Katalog",
        badge: badgePeriode,
        intro:
          "Peringkat produk menurut nilai penjualan, unit terjual, dan minat pengunjung. Daftar dipotong di sini karena daftar penuh sudah ada di modal katalog dan ekspor XLSX.",
        blocks,
        source: "Data pesanan, item pesanan, dan catatan interaksi produk",
        notes: [
          "Peringkat menurut nilai dan menurut unit bisa berbeda: produk berharga tinggi dengan unit sedikit bisa memuncaki nilai tetapi tidak unit.",
          "Dilihat dan Klik dihitung per produk, bukan per varian, dan diambil dari catatan interaksi pada periode terpilih.",
          "Produk yang sudah tidak ada di katalog tetap dihitung pada penjualan, tetapi tidak muncul di peringkat interaksi karena namanya tidak bisa ditampilkan.",
        ],
      }
    }

    case "referensi": {
      // Satu baris per metrik: cakupan dan tanggal acuannya, sumbernya kontrak
      // server supaya tabel ini tidak bisa berbeda dari label dan ekspor.
      //
      // Tabel ini TIDAK dipotong seperti daftar produk: ukurannya tetap sepanjang
      // kontrak, dan memotongnya menyembunyikan metrik bercakupan sekarang yang
      // justru paling mudah salah dibaca sebagai angka periode. Metrik itu
      // ditaruh lebih dulu supaya langsung terlihat.
      const dasarMetrik: Array<{ kunci: string; label: string; cakupan: string; satuan: string; acuan: string; perbandingan: string; sekarang: boolean }> =
        Object.entries(report.metric_basis ?? {}).map(([key, basis]) => ({
          kunci: key,
          label: kpiMap[key] ? labelTanpaCakupan(kpiMap[key].label) : (LABEL_DASAR_TAMBAHAN[key] ?? key),
          perbandingan: basis.scope === "current" ? "Tidak dibandingkan" : "Periode sebelumnya",
          cakupan:
            basis.scope === "current"
              ? basis.marker === "semua waktu"
                ? "Semua waktu"
                : "Kondisi saat ini"
              : "Periode terpilih",
          acuan: basis.anchor ?? "Tanpa tanggal",
          satuan: basis.unit ?? "-",
          sekarang: basis.scope === "current",
        }))

      const dasarUrut = [
        ...dasarMetrik.filter((baris) => baris.sekarang),
        ...dasarMetrik.filter((baris) => !baris.sekarang),
      ]

      return {
        title: "Referensi dan Kelengkapan Data",
        badge: "Referensi",
        intro:
          "Dasar cakupan setiap metrik, rentang yang dipakai laporan, penanda kejujuran tiap grafik, dan batas data yang perlu diketahui sebelum membaca angka lain.",
        blocks: [
          {
            kind: "rows",
            title: "Kontrak Tanggal",
            mode: "tabel",
            rows: Object.entries(report.date_contract ?? {}).map(([kunci, nilai]) => ({
              label: LABEL_KONTRAK_TANGGAL[kunci] ?? kunci,
              value: nilai,
              sign: "·",
              note:
                kunci === "timezone"
                  ? "Zona waktu resmi sistem untuk pembatasan hari dan jam kalender."
                  : kunci === "start_boundary"
                    ? "Titik awal jam pemotongan tanggal dalam sehari."
                    : kunci === "end_boundary"
                      ? "Titik akhir jam pemotongan tanggal dalam sehari."
                      : kunci === "running_period"
                        ? "Aturan pembandingan untuk periode yang hari ini masih berjalan."
                        : kunci === "comparison"
                          ? "Metode pembanding data terhadap periode historis sebelumnya."
                          : kunci === "per_metric"
                            ? "Dasar tanggal yang menjadi acuan pengakuan masing-masing metrik."
                            : kunci === "recognition"
                              ? "Aturan pengakuan status pesanan masuk ke dalam omzet toko."
                              : undefined,
            })),
          },
          {
            kind: "list",
            title: "Dasar Setiap Metrik",
            head: ["Metrik", "Cakupan", "Satuan", "Acuan Tanggal", "Perbandingan"],
            // total sama dengan jumlah baris supaya keterangan "daftar penuh ada
            // di ekspor XLSX" tidak muncul: tabel ini memang utuh di sini, dan
            // memang tidak ada di ekspor.
            total: dasarUrut.length,
            rowKeys: dasarUrut.map((baris) => baris.kunci),
            rows: dasarUrut.map((baris) => [baris.label, baris.cakupan, baris.satuan, baris.acuan, baris.perbandingan]),
          },
          {
            kind: "rows",
            title: "Rentang Laporan",
            mode: "tabel",
            rows: [
              { label: "Periode", value: range.label, sign: "·", note: "Preset periode waktu yang sedang aktif." },
              { label: "Tanggal Mulai", value: range.from_date, sign: "·", note: "Batas awal pengambilan data transaksi." },
              { label: "Tanggal Selesai", value: range.to_date, sign: "·", note: "Batas akhir pengambilan data transaksi." },
              { label: "Rentang Lengkap", value: range.range_detail ?? "-", sign: "·", note: "Rincian rentang tanggal dan jam kalender." },
              { label: "Rentang Pembanding", value: range.compare_label ?? "-", sign: "·", note: "Periode pembanding historis yang dipakai menghitung delta." },
              {
                label: "Pembanding Mulai",
                value: range.compare_from_date ?? "-",
                sign: "·",
                note: "Tanggal mulai periode pembanding.",
              },
              {
                label: "Pembanding Selesai",
                value: range.compare_to_date ?? "-",
                sign: "·",
                note: "Tanggal selesai periode pembanding.",
              },
              {
                label: "Periode Masih Berjalan",
                value: range.is_running ? "Ya, dibandingkan sampai jam yang sama" : "Tidak, dibandingkan penuh",
                sign: "·",
                note: "Status apakah periode saat ini belum selesai secara kalender.",
              },
              {
                label: "Skala Grafik",
                value: labelGranularitas(range.granularity),
                sign: "·",
                note: "Menentukan lebar satu titik pada grafik tren.",
              },
              {
                label: "Laporan Dibangun",
                value: formatWaktuWib(report.generated_at),
                sign: "·",
                note: "Waktu pembuatan data laporan ini di server.",
              },
              {
                label: "Periode Pembanding Punya Data",
                value: report.previous_has_data
                  ? "Ya, ada pesanan pada rentang pembanding"
                  : "Tidak, rentang pembanding tidak punya pesanan",
                sign: "·",
                note: "Bila tidak ada data pembanding, badge perubahan pada kartu tidak bermakna.",
              },
            ],
          },

        ],
        formula: fin.definition,
        source: "Dihitung dari data pesanan, pembayaran, pengiriman, dan kunjungan",
        notes: [
          "Kunjungan baru dicatat sejak tanggal tertentu; rentang yang mulai sebelum tanggal itu tidak menampilkan angka kunjungan dan konversi.",
          "Cakupan setiap metrik tertulis pada labelnya: metrik bertanda kondisi saat ini dihitung dari keadaan sekarang, bukan dari rentang tanggal.",
          "Periode yang masih berjalan dibandingkan sampai jam yang sama pada periode sebelumnya, bukan dibandingkan penuh.",
          "Grafik adalah tampilan visual dari angka yang sama dengan kartu, drawer, dan ekspor XLSX. Grafik dipakai untuk melihat arah dan perbandingan, bukan untuk menghitung; angka yang dipakai menghitung selalu berasal dari sumber data yang sama dengan kartu dan drawer.",
          "Metrik yang bercakupan kondisi saat ini tidak dibandingkan dengan periode sebelumnya, karena angkanya keadaan sekarang sehingga selisihnya selalu nol dan menyesatkan.",
        ],
      }
    }
  }
}

/**
 * Membangun isi kategori lalu menganotasi setiap baris dengan scope-nya dari
 * metric_basis. Anotasi dilakukan di SATU tempat supaya badge pembeda metrik
 * periode dan metrik kondisi saat ini tidak bisa berbeda antar kategori dan
 * tidak pernah berasal dari teks yang ditulis manual di renderer.
 */
export function buildCategoryDetail(
  category: DetailCategory,
  report: Report,
  kpiMap: Record<string, Kpi>,
  kunjunganTidakLengkap: boolean,
  tersediaSejak: string | null,
): CategoryDetail {
  const detail = bangunKategoriDetail(category, report, kpiMap, kunjunganTidakLengkap, tersediaSejak)
  const blokAnotasi = detail.blocks.map((block) =>
    block.kind === "rows"
      ? {
          ...block,
          rows: block.rows.map((row) => {
            const basis = row.metricKey ? report.metric_basis?.[row.metricKey] : null
            const kpi = row.metricKey ? kpiMap[row.metricKey] : null
            const basisHint = basis
              ? [
                  basis.marker ? "Cakupan: " + basis.marker : null,
                  basis.anchor ? "Acuan: " + basis.anchor : null,
                  basis.unit ? "Satuan: " + basis.unit : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : null
            return {
              ...row,
              note: row.note ?? kpi?.detail ?? (basisHint || undefined),
              scope: row.metricKey && basis ? scopeMetrik(report, row.metricKey) : row.scope,
              marker: basis?.marker ?? row.marker ?? null,
            }
          }),
        }
      : block,
  )

  return { ...detail, blocks: blokAnotasi }
}

/**
 * Isi drawer: satu kategori pada satu waktu. Pemilih kategori ada di dalam
 * drawer supaya berpindah kategori tidak perlu menutup dan membuka ulang.
 */
export function CategoryDetailPanel({
  category,
  detail,
  onSelectCategory,
}: {
  category: DetailCategory
  detail: CategoryDetail
  onSelectCategory: (next: DetailCategory) => void
}) {
  return (
    <div className="pb-6">
      {/* Padding tidak ditambah di sini: SheetContent sudah memberi p-5, jadi
          menambah px-5 lagi hanya mempersempit tabel dan membuat tepi kiri
          tidak sejajar dengan tombol tutup. */}
      <header className="border-b border-border pb-4 pr-10">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{detail.title}</h3>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {detail.badge}
          </span>
          {/* Sumber data dan catatan batas data dijadikan satu keterangan hover
              di sini. Sebelumnya keduanya kotak terpisah di bawah drawer, dan
              keduanya penjelasan sehingga mendorong angka ke atas. */}
          {detail.source || detail.notes.length > 0 ? (
            <HoverHint
              label={<Icon name="info" className="size-3.5" aria-hidden="true" />}
              hint={[
                detail.source ? `Sumber data: ${detail.source}.` : null,
                ...detail.notes,
              ]
                .filter(Boolean)
                .join(" ")}
              className="text-muted-foreground"
              side="bottom"
            />
          ) : null}
        </div>
        {detail.intro ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail.intro}</p>
        ) : null}
      </header>

      {/* Pil kategori menempel di atas: isinya bisa panjang, dan tanpa ini
          berpindah kategori menuntut menggulir balik ke atas dulu. */}
      <div className="sticky -top-5 z-10 -mx-5 border-b border-border bg-surface px-5 py-3">
        <p className="text-[11px] font-semibold text-muted-foreground">Kategori</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DETAIL_CATEGORIES.map((item) => {
            const aktif = item.key === category
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectCategory(item.key)}
                aria-pressed={aktif}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  aktif
                    ? "border-foreground/30 bg-secondary font-semibold text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {detail.blocks.map((block, blockIndex) => (
          <div key={"blok-" + blockIndex} className="overflow-hidden rounded-xl border border-border">
            {block.title ? (
              <p className="border-b border-border bg-muted/20 px-4 py-2 text-xs font-semibold text-foreground">
                {block.title}
              </p>
            ) : null}

            {block.kind === "rows" && block.mode !== "tabel" ? (
              /* Pola kartu metrik: label, nilai besar, keterangan, dan
                 perbandingan. Tanda operasi (±) tidak lagi menjadi kolom
                 utama; ia turun ke keterangan kartu supaya drawer terbaca
                 sebagai laporan, bukan lembar kalkulator. */
              <div className="divide-y divide-border/60">
                {block.rows.map((row, rowIndex) => {
                  const barisPenjelas = [row.sub, row.note].filter(Boolean).join(" ")
                  const operasi = row.sign && row.sign !== "·" ? "Operasi: " + row.sign : null
                  const hintKartu = [barisPenjelas, operasi].filter(Boolean).join(" ")
                  return (
                    <div
                      key={"kartu-" + blockIndex + "-" + rowIndex}
                      data-metric-key={row.metricKey}
                      className={cn("px-4 py-3", row.tone === "primary" && "bg-muted/20")}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <HoverHint
                          label={row.label}
                          hint={hintKartu || undefined}
                          side="bottom"
                          className={cn(
                            "min-w-0 text-xs",
                            row.tone === "primary" ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
                          )}
                        />
                        {row.delta !== undefined && row.delta !== null ? (
                          <DeltaBadge percent={row.delta} comparison={row.comparison} />
                        ) : null}
                      </div>
                      {/* Badge pembeda cakupan: sumbernya metric_basis payload,
                          bukan teks manual, supaya metrik periode dan metrik
                          kondisi saat ini tidak pernah terlihat sama. */}
                      {row.scope ? (
                        <p className="mt-1.5">
                          <span
                            className={cn(
                              "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                              row.scope === "current"
                                ? "border-warning/40 bg-warning/10 text-warning"
                                : "border-border bg-muted text-muted-foreground",
                            )}
                          >
                            {row.scope === "current" ? (row.marker ?? "Kondisi saat ini") : "Periode terpilih"}
                          </span>
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 font-mono text-lg font-bold tabular-nums tracking-tight",
                          row.tone === "primary"
                            ? "text-primary"
                            : row.tone === "destructive"
                              ? "text-destructive"
                              : "text-foreground",
                        )}
                      >
                        {row.value}
                      </p>
                      {barisPenjelas && !operasi ? (
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{barisPenjelas}</p>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}

            {block.kind === "rows" && block.mode === "tabel" ? (
              <table className="w-full text-xs">
                {/* Mode tabel kompak untuk kategori teknis (Referensi): empat
                    kolom kepala dipertahankan karena isinya memang tabular. */}
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-4 text-left font-medium">Uraian</th>
                    <th className="w-6 py-2 text-center font-medium" aria-label="Operasi">
                      <span aria-hidden="true">±</span>
                    </th>
                    <th className="py-2 pl-4 text-right font-medium">Nilai</th>
                    <th className="w-24 py-2 pl-3 text-right font-medium">Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => {
                    // Nilai yang berisi kalimat tidak boleh dipaksa satu baris
                    // rata kanan dengan huruf monospace: itu merusak tabel dan
                    // membuat prosanya terpotong. Angka tetap satu baris.
                    const nilaiProsa = !/^[\d\s.,%+\-−Rprp·=]*$/.test(row.value)
                    const barisPenjelas = [row.sub, row.note].filter(Boolean).join(" · ")
                    const operasi = row.sign && row.sign !== "·" ? "Operasi: " + row.sign : null
                    const hintTabel = [barisPenjelas, operasi].filter(Boolean).join(" · ")
                    const total = row.sign === "="
                    return (
                      <React.Fragment key={"baris-" + blockIndex + "-" + rowIndex}>
                        <tr
                        data-metric-key={row.metricKey}
                        className={cn("border-t border-border/60 align-top", total ? "font-semibold" : "")}
                      >
                          <td
                            className={cn(
                              "break-words py-2 pr-4",
                              total ? "font-semibold text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {/* Penjelasan baris jadi keterangan hover, bukan baris
                                tabel tersendiri, supaya tabelnya tidak setinggi itu.
                                Angkanya sendiri tetap terlihat di kolom Nilai. */}
                            <HoverHint label={row.label} hint={hintTabel || undefined} side="bottom" />
                          </td>
                          <td className="w-6 py-2 text-center font-mono text-muted-foreground">
                            {row.sign}
                          </td>
                          <td
                            className={cn(
                              "py-2 pl-4",
                              nilaiProsa
                                ? "text-left text-muted-foreground"
                                : "whitespace-nowrap text-right font-mono tabular-nums",
                              !nilaiProsa
                                ? total
                                  ? "font-semibold text-primary"
                                  : row.tone === "destructive"
                                    ? "text-destructive"
                                    : "text-foreground"
                                : "",
                            )}
                          >
                            {row.value}
                          </td>
                          <td className="w-24 py-2 pl-3 text-right">
                            {row.delta === undefined ? null : (
                              <DeltaBadge percent={row.delta} comparison={row.comparison} />
                            )}
                          </td>
                        </tr>

                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            ) : null}

            {block.kind === "items" ? (
              <div className="space-y-2 p-4">
                {block.items.map((item, itemIndex) => (
                  <div
                    key={"item-" + blockIndex + "-" + itemIndex}
                    className="rounded-lg border border-border bg-muted/20 p-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-foreground">
                      <HoverHint label={item.title} hint={item.desc} />
                      <span className="font-mono tabular-nums">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {block.kind === "list" ? (
              <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {block.head.map((judul, headIndex) => {
                        // Satu predikat untuk kepala dan isi, supaya keduanya
                        // tidak pernah berbeda perataan. Sebelumnya kepala
                        // memakai nomor kolom dan isi memakai nama kolom,
                        // sehingga terbukti tidak cocok di beberapa daftar.
                        const kolomTeks = isKolomTeks(judul)
                        return (
                          <th
                            key={"kepala-" + blockIndex + "-" + headIndex}
                            className={cn(
                              "px-4 py-2 font-medium",
                              kolomTeks || headIndex === 0 ? "text-left" : "text-right",
                            )}
                          >
                            {judul}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {block.rows.map((row, rowIndex) => (
                      <tr key={"daftar-" + blockIndex + "-" + rowIndex} data-metric-key={block.rowKeys?.[rowIndex]}>
                        {row.map((sel, cellIndex) => {
                          const kolomTeks = isKolomTeks(block.head[cellIndex] ?? "")
                          const kolomPertama = cellIndex === 0
                          return (
                            <td
                              key={"sel-" + blockIndex + "-" + rowIndex + "-" + cellIndex}
                              className={cn(
                                "px-4 py-2",
                                kolomPertama
                                  ? "text-foreground"
                                  : kolomTeks
                                    ? "font-mono text-muted-foreground"
                                    : "whitespace-nowrap text-right font-mono tabular-nums text-muted-foreground",
                              )}
                            >
                              {sel}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Keterangan jumlah diletakkan di luar area gulir supaya tidak
                  ikut tergeser saat tabel digulir ke kanan. */}
              {block.total > block.rows.length ? (
                <p className="border-t border-border py-2 text-[11px] text-muted-foreground">
                  Menampilkan {block.rows.length} dari {block.total} baris. Daftar penuh ada di ekspor XLSX.
                </p>
              ) : null}
              </>
            ) : null}
          </div>
        ))}

        {detail.formula ? <DasarPerhitungan formula={detail.formula} /> : null}
      </div>
    </div>
  )
}

/**
 * Bagian lipat "Dasar perhitungan": formula tetap dapat diakses untuk audit,
 * tetapi bukan lagi blok pertama yang dilihat admin.
 */
export function DasarPerhitungan({ formula }: { formula: string }) {
  const [terbuka, setTerbuka] = React.useState(false)
  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        aria-expanded={terbuka}
        onClick={() => setTerbuka((nilai) => !nilai)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        Dasar perhitungan
        <Icon name={terbuka ? "chevron-up" : "chevron-down"} className="size-3.5" aria-hidden="true" />
      </button>
      {terbuka ? (
        <p className="border-t border-border px-4 py-3 text-xs leading-relaxed text-foreground">
          {formula}
        </p>
      ) : null}
    </div>
  )
}

export default function StorePerformance({
  title,
  description,
  filters,
  periodOptions,
  granularityOptions,
  report,
  exportUrl,
}: {
  title: string
  description: string
  filters: { period: string; from: string; to: string; granularity: string }
  periodOptions: Array<{ value: string; label: string }>
  granularityOptions: Array<{ value: string; label: string }>
  report: Report
  exportUrl: string
}) {
  const [refreshing, setRefreshing] = React.useState(false)
  // Kategori detail pada Sheet samping. null berarti panel tertutup.
  // Pemilihan kategori hanya mengubah state lokal: membangun laporan butuh
  // 418 ms dengan 177 query, jadi berpindah kategori tidak boleh memicu
  // permintaan ke server.
  const [detailCategory, setDetailCategory] = React.useState<DetailCategory | null>(null)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [exportRange, setExportRange] = React.useState<"screen" | "custom">("screen")
  const [exportFrom, setExportFrom] = React.useState("")
  const [exportTo, setExportTo] = React.useState("")
  const [exportGranularity, setExportGranularity] = React.useState("day")
  const [refreshError, setRefreshError] = React.useState(false)
  const [period, setPeriod] = React.useState(filters.period)
  const [from, setFrom] = React.useState(filters.from)
  const [to, setTo] = React.useState(filters.to)
  const [granularity, setGranularity] = React.useState(filters.granularity)

  // Ref dan penutup klik luar untuk popover export
  const exportRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!exportOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExportOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [exportOpen])

  // State Modal Popover Lebar
  const [showTopProductsModal, setShowTopProductsModal] = React.useState(false)
  const [showInteractionModal, setShowInteractionModal] = React.useState(false)
  const [searchQueryTop, setSearchQueryTop] = React.useState("")
  const [searchQueryInteraction, setSearchQueryInteraction] = React.useState("")
  const [modalInteractionTab, setModalInteractionTab] = React.useState<"viewed" | "clicked">("viewed")

  const kpiMap = React.useMemo(() => {
    const map: Record<string, (typeof report)["sections"][number]["kpis"][number]> = {}
    // Rentang pembanding disebut sekali di sini, lalu dipakai keterangan badge
    // di seluruh halaman.
    const periodePembanding =
      report.range.compare_from_date && report.range.compare_to_date
        ? report.range.compare_from_date + " - " + report.range.compare_to_date
        : undefined

    for (const sec of report.sections) {
      for (const k of sec.kpis) {
        // Metrik bercakupan sekarang tidak punya pembanding, jadi tidak diberi
        // keterangan: angkanya keadaan saat ini, bukan hasil perbandingan.
        map[k.key] =
          k.previous === null || k.previous === undefined
            ? k
            : {
                ...k,
                comparison: {
                  current: formatNilaiKpi(k.value, k.format),
                  previous: formatNilaiKpi(k.previous, k.format),
                  period: periodePembanding,
                },
              }
      }
    }

    return map
  }, [report])

  // Tanggal pembanding tidak lagi diulang di setiap kartu; cukup sekali di
  // banner Periode Analisis, tempatnya memang untuk konteks rentang.

  // Renderer pasif: penjelasan kartu sepenuhnya dari payload. Definisi dari
  // KPI, cakupan, acuan, dan satuan dari metric_basis. Tidak ada teks kontrak
  // dan tidak ada hitungan yang ditulis di halaman.
  const kpiHint = (key: string): string =>
    [
      kpiMap[key]?.detail ?? null,
      report.metric_basis?.[key]?.marker ? "Cakupan: " + report.metric_basis[key]?.marker : null,
      report.metric_basis?.[key]?.anchor ? "Acuan: " + report.metric_basis[key]?.anchor : null,
      report.metric_basis?.[key]?.unit ? "Satuan: " + report.metric_basis[key]?.unit : null,
    ]
      .filter(Boolean)
      .join(" · ")

  const kpiUnit = (key: string): string => report.metric_basis?.[key]?.unit ?? ""

  const nilaiKpi = (key: string): string => {
    const k = kpiMap[key]
    return k ? formatKontrak(k.value, k.format) : ""
  }

  // Isi hint kontrak tanggal dirangkai dari payload date_contract, bukan
  // ditulis ulang di sini.
  const kontrakTanggalHint = Object.entries(report.date_contract ?? {})
    .map(([kunci, nilai]) => (LABEL_KONTRAK_TANGGAL[kunci] ?? kunci) + ": " + nilai)
    .join(" · ")

  // Dana COD yang sudah dikirim tapi belum cair. Dipakai di header section
  // operasional sebagai ringkasan kas yang masih di jalan.
  const codPendingAmount = report.financial.cod_pending_amount ?? 0
  const codPendingCount = report.financial.cod_pending_count ?? 0

  // Data kunjungan hanya layak sejak penyaring bot aktif. Periode yang mulai
  // sebelum tanggal itu mencampur data tercemar, jadi angka kunjungan dan
  // konversinya tidak ditampilkan: 7 pembeli dibagi 7 pengunjung akan terbaca
  // konversi 100%, padahal artinya bukan begitu.
  const tersediaSejak = report.financial.visitors_available_from ?? null
  // Perbandingan memakai tanggal ISO. Sebelumnya memakai from_date yang
  // berformat tampilan ("23 Agt 2026") sehingga dibandingkan sebagai teks, dan
  // hasilnya bergantung pada angka harinya: "15 Sep 2026" kebetulan lebih kecil
  // dari "2026-09-19" sehingga penjaganya menyala, sedangkan "21 Sep 2026" tidak.
  const kunjunganTidakLengkap =
    Boolean(tersediaSejak) &&
    Boolean(report.range.from_date_iso) &&
    report.range.from_date_iso! < tersediaSejak!

  // Satu kalimat pemberitahuan bila rentang yang tampil bukan rentang yang
  // diminta: masukannya bukan tanggal, atau rentangnya melewati hari ini dan
  // dipotong. Dibuat satu kalimat supaya barisnya tidak menumpuk, dan tanpa
  // menyebut istilah teknis.
  const peringatanRentang = (() => {
    const diabaikan = report.range.input_diabaikan ?? []
    const dipotong = report.range.rentang_dipotong === true

    if (diabaikan.length && dipotong) {
      return "Tanggal yang diminta tidak dikenali, dan rentangnya melewati hari ini, jadi laporan memakai rentang yang tampil sekarang."
    }
    if (diabaikan.length) {
      return `Tanggal ${diabaikan.join(" dan ")} yang diminta tidak dikenali, jadi laporan memakai rentang yang tampil sekarang.`
    }
    if (dipotong) {
      return "Rentang yang diminta melewati hari ini, jadi batasnya dipotong sampai hari ini."
    }

    return null
  })()

  // Isi drawer dibangun dari props report yang sama dengan kartu di halaman,
  // jadi tidak ada nilai yang ditulis ulang di komponen tampilan. Dihitung
  // hanya saat kategori atau laporan berubah, bukan setiap render.
  const detailIsi = React.useMemo(() => {
    if (!detailCategory) return null
    return buildCategoryDetail(detailCategory, report, kpiMap, kunjunganTidakLengkap, tersediaSejak)
  }, [detailCategory, report, kpiMap, kunjunganTidakLengkap, tersediaSejak])

  const bukaKategori = (kategori: DetailCategory) => setDetailCategory(kategori)

  const [chartTab, setChartTab] = React.useState(0)
  // Tab kartu analisis produk: Terlaris, Paling Dilihat, Paling Diklik.
  const [tabProduk, setTabProduk] = React.useState<"terlaris" | "viewed" | "clicked">("terlaris")

  function buildExportUrl(): string {
    try {
      const url = new URL(exportUrl, window.location.origin)
      if (exportRange === "screen") {
        url.searchParams.set("period", period)
        if (period === "custom") {
          if (from) url.searchParams.set("from", from)
          if (to) url.searchParams.set("to", to)
        }
      } else if (exportRange === "custom") {
        url.searchParams.set("period", "custom")
        if (exportFrom) url.searchParams.set("export_from", exportFrom)
        if (exportTo) url.searchParams.set("export_to", exportTo)
      }
      url.searchParams.set("export_granularity", exportGranularity)
      return url.toString()
    } catch {
      return exportUrl
    }
  }

  const [prevFilters, setPrevFilters] = React.useState(filters)
  if (prevFilters.period !== filters.period || prevFilters.granularity !== filters.granularity || prevFilters.from !== filters.from || prevFilters.to !== filters.to) {
    setPrevFilters(filters)
    setPeriod(filters.period)
    setGranularity(filters.granularity)
    setFrom(filters.from)
    setTo(filters.to)
  }

  function apply(next?: Partial<{ period: string; from: string; to: string; granularity?: string }>) {
    const nextPeriod = next?.period ?? period
    const isPeriodChanged = next?.period !== undefined && next.period !== period

    const payload: Record<string, string> = {
      period: nextPeriod,
    }

    // Tanggal hanya dikirim untuk periode kustom. Kalau ikut dikirim pada
    // periode lain, URL membawa tanggal basi dari pilihan sebelumnya (mis.
    // period=last_7 dengan tanggal milik last_30) dan menyesatkan kalau dibagikan.
    if (nextPeriod === "custom") {
      const nextFrom = next?.from ?? from
      const nextTo = next?.to ?? to
      if (nextFrom) payload.from = nextFrom
      if (nextTo) payload.to = nextTo
    }

    // Jika ganti periode, jangan bawa granularitas lama agar backend memilihkan granularitas kanonik
    if (next?.granularity !== undefined) {
      payload.granularity = next.granularity
    } else if (!isPeriodChanged && granularity) {
      payload.granularity = granularity
    }

    router.get(routeUrl("admin.analytics.store-performance"), payload, {
      preserveState: true,
      preserveScroll: true,
    })
  }


  // Filter list untuk modal Top Products
  const filteredTopProductsModal = React.useMemo(() => {
    const q = searchQueryTop.trim().toLowerCase()
    if (!q) return report.top_products
    return report.top_products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.parent_sku.toLowerCase().includes(q),
    )
  }, [report.top_products, searchQueryTop])

  // Filter list untuk modal Interaksi
  const interactionModalData = React.useMemo(() => {
    const list =
      modalInteractionTab === "viewed"
        ? report.product_breakdowns.most_viewed
        : report.product_breakdowns.most_clicked
    const q = searchQueryInteraction.trim().toLowerCase()
    if (!q) return list
    return list.filter((p) => p.name.toLowerCase().includes(q) || p.parent_sku.toLowerCase().includes(q))
  }, [report.product_breakdowns, modalInteractionTab, searchQueryInteraction])

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setRefreshing(true)
              setRefreshError(false)
              router.reload({
                only: ["report", "filters"],
                onError: () => setRefreshError(true),
                onFinish: () => setRefreshing(false),
              })
            }}
            disabled={refreshing}
          >
            <Icon name="refresh" className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            {refreshing ? "Memuat..." : "Muat ulang"}
          </Button>
          <div className="relative" ref={exportRef}>
            <Button variant="secondary" onClick={() => setExportOpen((v) => !v)}>
              <Icon name="download" className="size-4" aria-hidden="true" />
              Unduh Laporan
            </Button>
            {exportOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-border bg-card p-3 shadow-lg">
                <p className="text-xs font-bold text-foreground">Rentang waktu export</p>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" name="export_range" checked={exportRange === "screen"} onChange={() => setExportRange("screen")} />
                  Ikuti periode di layar
                </label>
                <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <input type="radio" name="export_range" checked={exportRange === "custom"} onChange={() => setExportRange("custom")} />
                  Kustom
                </label>
                {exportRange === "custom" ? (
                  <div className="mt-2 flex items-center gap-1.5">
                    <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="h-8 w-32 text-xs" aria-label="Dari tanggal" />
                    <span className="text-xs text-muted-foreground">s/d</span>
                    <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="h-8 w-32 text-xs" aria-label="Sampai tanggal" />
                  </div>
                ) : null}
                <p className="mt-3 text-xs font-bold text-foreground">Granularitas data</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Rentang &gt; 1 bulan otomatis dipecah: satu file, sheet per bulan.
                </p>
                <select
                  value={exportGranularity}
                  onChange={(e) => setExportGranularity(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  aria-label="Granularitas export"
                >
                  {granularityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <a
                  href={buildExportUrl()}
                  onClick={() => setExportOpen(false)}
                  className="mt-3 flex h-9 w-full items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Ekspor
                </a>
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      {/* FILTER PERIODE & BANNER KONTROL */}
      <section className="mb-5 rounded-xl border border-border bg-card p-4 shadow-soft">
        {/* Identitas periode di kiri, kontrol di kanan (owner 2026-09-18). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <HoverHint
              label="Periode Analisis:"
              hint={kontrakTanggalHint || undefined}
              className="text-xs font-semibold text-foreground"
            />
            <span className="text-xs font-semibold text-primary">{report.range.label}</span>
            <span className="text-xs text-muted-foreground">({report.range.from_date} - {report.range.to_date})</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {refreshing ? "Memperbarui data..." : `Pembanding: ${report.range.compare_label.replace(/^vs\s+/, "")}`}
            </span>
            <span className="text-xs text-muted-foreground" title="Waktu laporan dibangun (WIB)">
              · Diperbarui {formatJamIso(report.generated_at)}
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Select
                value={period}
                onChange={(event) => {
                  const value = event.target.value
                  setPeriod(value)
                  if (value !== "custom") {
                    apply({ period: value })
                  }
                }}
                className="h-8 w-36 text-xs font-medium bg-surface"
                id="period-select" aria-label="Filter periode analisis"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <Select
                value={granularity}
                onChange={(event) => {
                  const value = event.target.value
                  setGranularity(value)
                  apply({ granularity: value })
                }}
                className="h-8 w-28 text-xs font-medium bg-surface"
                id="granularity-select" aria-label="Filter skala grafik"
              >
                {granularityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Detail: memilih kategori rincian yang dibuka di drawer. Nilainya
                state lokal, bukan parameter URL, karena berpindah kategori tidak
                boleh memicu permintaan ke server (membangun laporan 418 ms, 177
                query). */}
            <div className="flex items-center gap-1.5">
              <Select
                value={detailCategory ?? ""}
                onChange={(event) => {
                  const value = event.target.value
                  if (!value) {
                    setDetailCategory(null)
                    return
                  }
                  bukaKategori(value as DetailCategory)
                }}
                className="h-8 w-44 text-xs font-medium bg-surface"
                id="detail-category-select"
                aria-label="Pilih kategori rincian"
              >
                <option value="">Pilih kategori</option>
                {DETAIL_CATEGORIES.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {refreshError ? (
          <p className="mt-2 text-xs font-medium text-destructive" role="status">
            Gagal memuat pembaruan data. Coba refresh lagi.
          </p>
        ) : null}

        {peringatanRentang ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground" role="status">
            {peringatanRentang}
          </p>
        ) : null}

        {period === "custom" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs font-medium text-muted-foreground">Rentang tanggal:</span>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-8 w-36 text-xs bg-surface" />
            <span className="text-xs text-muted-foreground">s/d</span>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-8 w-36 text-xs bg-surface" />
            <Button size="sm" type="button" onClick={() => apply({ period: "custom", from, to })} className="h-8 text-xs">
              Terapkan
            </Button>
          </div>
        ) : null}
      </section>

      {/* HERO: enam KPI utama dalam satu baris, dan keenamnya sekaligus menjadi
          tab grafik tepat di bawahnya. Jadi setiap angka ringkasan punya tren
          yang bisa dibuka tanpa pindah halaman. Rincian rumus tiap metrik tetap
          lewat tombol info di tiap kartu. Tata letak mengikuti prototype
          ui-lab/performa-toko.html. */}
      <section
        aria-label="Ringkasan utama"
        className="mb-5 overflow-hidden rounded-xl border border-border bg-card shadow-soft"
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {(() => {
            const heroDefs: Array<{
              metric: string
              kpi: string
              chart: string | null
              label: string
              hint: string
              value: React.ReactNode
              delta: number | null | undefined
            }> = [
              {
                metric: "gross-revenue",
                kpi: "omzet",
                chart: "revenue",
                label: kpiMap["omzet"]?.label,
                hint: kpiHint("omzet"),
                value: nilaiKpi("omzet"),
                delta: kpiMap["omzet"]?.change_percent,
              },
              {
                metric: "orders-count",
                kpi: "orders",
                chart: "orders",
                label: kpiMap["orders"]?.label,
                hint: kpiHint("orders"),
                value: nilaiKpi("orders"),
                delta: kpiMap["orders"]?.change_percent,
              },
              {
                metric: "products-sold",
                kpi: "products",
                chart: "products",
                label: kpiMap["products"]?.label,
                hint: kpiHint("products"),
                value: nilaiKpi("products"),
                delta: kpiMap["products"]?.change_percent,
              },
              {
                metric: "units-sold",
                kpi: "units",
                chart: "units",
                label: kpiMap["units"]?.label,
                hint: kpiHint("units"),
                value: nilaiKpi("units"),
                delta: kpiMap["units"]?.change_percent,
              },
              {
                metric: "visitors",
                kpi: "visitors",
                chart: "visitors",
                label: kpiMap["visitors"]?.label,
                hint: "Jumlah pengunjung unik berdasarkan id sesi per hari yang membuka halaman toko.",
                value: kunjunganTidakLengkap ? (
                  <span className="text-sm font-medium text-muted-foreground">Belum tersedia</span>
                ) : (
                  nilaiKpi("visitors")
                ),
                delta: kunjunganTidakLengkap ? undefined : kpiMap["visitors"]?.change_percent,
              },
              {
                metric: "conversion",
                kpi: "conversion",
                chart: "conversion_rate",
                label: kpiMap["conversion"]?.label,
                hint: "Jumlah pembeli unik dibanding pengunjung unik pada periode ini. Angka ini rasio, bukan penautan sesi ke pesanan: sistem tidak melacak pengunjung mana yang membeli.",
                value: kunjunganTidakLengkap ? (
                  <span className="text-sm font-medium text-muted-foreground">Belum tersedia</span>
                ) : (
                  nilaiKpi("conversion")
                ),
                delta: kunjunganTidakLengkap ? undefined : kpiMap["conversion"]?.change_percent,
              },
            ]

            return heroDefs.filter((def) => kpiMap[def.kpi]).map((def) => {
              const chartIdx = def.chart
                ? report.charts.findIndex((c) => c.key === def.chart)
                : -1
              const isActive = chartIdx >= 0 && chartTab === chartIdx
              // Kartu ini tetap satu elemen klik untuk memilih tab grafik, karena
              // itulah cara berpindah grafik di halaman ini. Yang dihapus hanya
              // tombol rincian per KPI: detailnya kini lewat filter kategori.
              const activate = () => setChartTab(chartIdx)
              return (
                <div
                  key={def.metric}
                  data-metric-key={def.kpi}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={def.label + (isActive ? ", grafik sedang tampil" : ", tampilkan grafik")}
                  onClick={activate}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      activate()
                    }
                  }}
                  className={cn(
                    "flex min-w-0 cursor-pointer flex-col justify-between p-4 transition focus-visible:ring-2 focus-visible:ring-ring/40",
                    // Pemisah grid: garis kanan antar kolom, garis bawah antar
                    // baris. Grid boleh membungkus di lebar menengah, jadi
                    // keduanya dibiarkan aktif.
                    "border-b border-r border-border last:border-b-0",
                    isActive ? "bg-accent" : "hover:bg-muted/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <HoverHint
                        label={def.label}
                        hint={def.hint}
                        className={cn(
                          "min-w-0 text-xs font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                      {def.value}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-1 border-t border-border/60 pt-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {isActive ? "Grafik aktif" : null}
                    </span>
                    {def.delta === undefined ? null : (
                      <DeltaBadge percent={def.delta} comparison={kpiMap[def.kpi]?.comparison} />
                    )}
                  </div>
                </div>
              )
            })
          })()}
        </div>

        {/* Grafik menyatu tepat di bawah baris KPI: satu grafik per tab, dengan
            legend periode pembanding dan pemilih model garis atau batang. */}
        {(() => {
          const chart = report.charts[chartTab] ?? report.charts[0]
          if (!chart) return null

          // Dua grafik ini memakai data kunjungan, jadi ikut memakai penjaga
          // yang sama dengan kartu. Tanpa penjaga, angka Total di sini dihitung
          // dari dua jendela waktu berbeda: pembilangnya sepanjang periode,
          // penyebutnya hanya sejak kunjungan mulai dicatat, sehingga rasionya
          // jauh lebih besar daripada kenyataan.
          const grafikKunjungan = chart.key === "visitors" || chart.key === "conversion_rate"
          const totalTidakLayak = kunjunganTidakLengkap && grafikKunjungan

          const prev = chart.previous_series ?? []
          const combinedSeries = chart.series.map((item, idx) => ({
            ...item,
            previous_value: prev[idx]?.value,
            previous_label: prev[idx]?.label,
          }))
          return (
            <div className="border-t border-border p-5" data-metric-key={chart.key}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    {chart.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Total:{" "}
                    {totalTidakLayak ? (
                      // Sama seperti kartu: angkanya ditahan dan alasannya
                      // disebutkan, bukan ditampilkan sebagai hasil pengukuran.
                      <span className="font-medium text-muted-foreground">
                        Belum tersedia, kunjungan dicatat sejak {formatDate(tersediaSejak)}
                      </span>
                    ) : (
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatChartValue(chart.total, chart.total_format)}
                      </span>
                    )}
                  </span>
                  {/* Pembanding berdampingan dengan nilai periode terpilih,
                      supaya kedua angka yang dibandingkan terbaca berurutan. */}
                  <span className="text-xs text-muted-foreground">
                    Pembanding:{" "}
                    {chart.previous_measured === false ? (
                      <span className="font-medium text-muted-foreground">
                        tidak diukur pada periode itu
                      </span>
                    ) : (
                      <span className="font-semibold tabular-nums text-muted-foreground">
                        {formatChartValue(chart.previous_total, chart.total_format)}
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: "hsl(var(--sale))" }}
                      />
                      Periode Ini
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-0.5 w-3 border-t-2 border-dashed border-muted-foreground/60" />
                      Periode Lalu
                    </span>
                  </div>

                </div>
              </div>

              {combinedSeries.length ? (
                <React.Suspense
                  fallback={<div className="mt-3 h-[200px] w-full animate-pulse rounded-md bg-muted/40" />}
                >
                  <TrendChart
                    series={combinedSeries}
                    format={
                      chart.total_format === "currency"
                        ? "currency"
                        : chart.total_format === "percent"
                          ? "percent"
                          : "number"
                    }
                    showChartTypeToggle={false}
                    height={200}
                  />
                </React.Suspense>
              ) : (
                <p className="py-12 text-center text-xs text-muted-foreground">
                  Data belum cukup untuk menampilkan tren periode ini.
                </p>
              )}
            </div>
          )
        })()}
      </section>

      {/* RINGKASAN KEUANGAN: empat angka uang yang paling sering ditanya, satu
          baris, masing-masing dengan catatan asal angkanya. Rincian penuh tetap
          di drawer Rekonsiliasi dan di ekspor XLSX. */}
      <SectionCard
        title="Ringkasan Keuangan"
        icon="money"
        description="Dari nilai transaksi pembeli sampai uang yang benar-benar masuk kas."
        className="mb-5"
        contentClassName="p-0"
        action={
          <Button variant="outline" size="sm" type="button" onClick={() => bukaKategori("arus-kas")}>
            Detail perhitungan <Icon name="arrow-right" className="ml-1 size-3.5" aria-hidden="true" />
          </Button>
        }
      >
        <div className="grid divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div className="p-6" data-metric-key="net_revenue">
            <HoverHint
              label={kpiMap["net_revenue"]?.label}
              hint={kpiHint("net_revenue")}
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-primary">
              {formatCurrency(report.financial.net_revenue)}
            </p>
            <div className="mt-3">
              <DeltaBadge
                percent={kpiMap["net_revenue"]?.change_percent}
                comparison={kpiMap["net_revenue"]?.comparison}
              />
            </div>
          </div>

          <div className="p-6" data-metric-key="payments_received">
            <HoverHint
              label={kpiMap["payments_received"]?.label}
              hint={kpiHint("payments_received")}
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {nilaiKpi("payments_received")}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              <HoverHint
                label={"COD Selesai " + nilaiKpi("cod_paid")}
                hint={kpiHint("cod_paid")}
                className="text-xs text-muted-foreground"
              />
            </p>
          </div>

          <div className="p-6" data-metric-key="cod_pending_amount">
            <HoverHint
              // Penanda cakupannya diambil dari kontrak metric_basis, bukan
              // ditulis tetap, supaya tidak bisa berbeda dari tabel Referensi.
              label={"Belum Masuk (" + (report.metric_basis?.["cod_pending_amount"]?.marker ?? "semua waktu") + ")"}
              hint={kpiHint("cod_pending_amount")}
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-warning">
              {formatCurrency(codPendingAmount)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              <HoverHint
                label={formatNumber(codPendingCount) + " pesanan COD aktif"}
                hint={kpiHint("cod_pending_count")}
                className="text-xs text-muted-foreground"
              />
              {kpiMap["payment_pending_count"]?.value ? (
                <>
                  {" · "}
                  <HoverHint
                    label={formatNumber(kpiMap["payment_pending_count"]?.value ?? 0) + " transfer belum lunas"}
                    hint={kpiHint("payment_pending_count")}
                    className="text-xs text-muted-foreground"
                  />
                </>
              ) : null}
            </p>
          </div>

        </div>
      </SectionCard>

      {/* ANTREAN OPERASIONAL DAN KECEPATAN LAYANAN. Empat kartu pertama adalah
          kondisi saat laporan dibangun (antrean dan kas yang belum selesai),
          ditandai "Kondisi saat ini" supaya tidak dibaca sebagai perbandingan
          periode; dua kartu terakhir kecepatan layanan pada periode terpilih. */}
      <SectionCard
        title="Antrean Operasional dan Kecepatan Layanan"
        icon="truck"
        description={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            {codPendingAmount > 0 && codPendingCount > 0 ? (
              <span>
                Dana COD di kurir:{" "}
                <span className="font-mono font-semibold tabular-nums text-foreground">
                  {formatCurrency(codPendingAmount)}
                </span>{" "}
                ({formatNumber(codPendingCount)} pesanan)
              </span>
            ) : null}
          </span>
        }
        className="mb-5"
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={routeUrl("admin.orders.index")}>
              Ke Daftar Pesanan <Icon name="arrow-right" className="ml-1 size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <Link
            href={routeUrl("admin.orders.index")}
            data-metric-key="open_orders"
            className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["open_orders"]?.label}
                hint={kpiHint("open_orders")}
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="clock" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["open_orders"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{kpiUnit("open_orders")}</span>
            </p>

          </Link>

          <Link
            href={routeUrl("admin.orders.index") + "?order_status=shipped"}
            data-metric-key="dispatched_orders"
            className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["dispatched_orders"]?.label}
                hint={kpiHint("dispatched_orders")}
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="truck" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["dispatched_orders"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{kpiUnit("dispatched_orders")}</span>
            </p>

          </Link>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4" data-metric-key="returns_open">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["returns_open"]?.label}
                hint={kpiHint("returns_open")}
                className="text-xs font-semibold text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["returns_open"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{kpiUnit("returns_open")}</span>
            </p>

          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4" data-metric-key="payment_pending_count">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["payment_pending_count"]?.label}
                hint={kpiHint("payment_pending_count")}
                className="text-xs font-semibold text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["payment_pending_count"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{kpiUnit("payment_pending_count")}</span>
            </p>

          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4" data-metric-key="avg_confirm_hours">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_confirm_hours"]?.label}
                hint={kpiHint("avg_confirm_hours")}
                className="text-xs font-semibold text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatDuration(kpiMap["avg_confirm_hours"]?.value ?? 0)}
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={kpiMap["avg_confirm_hours"]?.change_percent}
                comparison={kpiMap["avg_confirm_hours"]?.comparison}
                upIsBad
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4" data-metric-key="avg_process_days">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_process_days"]?.label}
                hint={kpiHint("avg_process_days")}
                className="text-xs font-semibold text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatDuration(kpiMap["avg_process_days"]?.value ?? 0, true)}
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={kpiMap["avg_process_days"]?.change_percent}
                comparison={kpiMap["avg_process_days"]?.comparison}
                upIsBad
              />
            </div>
          </div>
        </div>

        {/* Baris pendukung periode: hasil akhir fulfillment yang tidak masuk
            enam kartu di atas tetapi tetap perlu terlihat. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
          <span className="flex items-center gap-1.5" data-metric-key="completed_orders">
            <Icon name="check-circle" className="size-4 text-muted-foreground" aria-hidden="true" />
            <HoverHint
              label={kpiMap["completed_orders"]?.label}
              hint={kpiHint("completed_orders")}
              className="font-medium text-muted-foreground"
            />
          </span>
          <span className="flex items-center gap-2">
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(kpiMap["completed_orders"]?.value ?? 0)}
            </span>
            <DeltaBadge
          percent={kpiMap["completed_orders"]?.change_percent}
          comparison={kpiMap["completed_orders"]?.comparison}
        />
          </span>
        </div>

      </SectionCard>

      {/* PELANGGAN DAN KUALITAS PENJUALAN: siapa yang membeli, berapa yang baru,
          dan seberapa besar nilai transaksinya. Metrik kunjungan dan konversi
          sudah berada di baris KPI utama, jadi tidak diulang di sini. */}
      <SectionCard
        title="Pelanggan dan Kualitas Penjualan"
        icon="users"
        description="Siapa yang membeli, berapa yang baru, dan seberapa besar nilai tiap transaksi."
        className="mb-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div
            className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4"
            data-metric-key="new_customers"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["new_customers"]?.label}
                hint={kpiHint("new_customers")}
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["new_customers"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{kpiUnit("new_customers")}</span>
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={kpiMap["new_customers"]?.change_percent}
                comparison={kpiMap["new_customers"]?.comparison}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4" data-metric-key="repeat_customers">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["repeat_customers"]?.label}
                hint={kpiHint("repeat_customers")}
                className="text-xs font-medium text-muted-foreground"
              />
              <HoverHint
                label={"Rasio " + nilaiKpi("repeat_order_rate")}
                hint={kpiHint("repeat_order_rate")}
                className="text-xs font-medium tabular-nums text-muted-foreground"
              />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["repeat_customers"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">{kpiUnit("repeat_customers")}</span>
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={kpiMap["repeat_customers"]?.change_percent}
                comparison={kpiMap["repeat_customers"]?.comparison}
              />
            </div>
          </div>

          <div
            className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4"
            data-metric-key="aov"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["aov"]?.label}
                hint={kpiHint("aov")}
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">
              {nilaiKpi("aov")}
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={kpiMap["aov"]?.change_percent}
                comparison={kpiMap["aov"]?.comparison}
              />
            </div>
          </div>

          <div
            className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4"
            data-metric-key="avg_unit_price"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_unit_price"]?.label}
                hint={kpiHint("avg_unit_price")}
                className="text-xs font-medium text-muted-foreground"
              />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(kpiMap["avg_unit_price"]?.value ?? 0)}
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={kpiMap["avg_unit_price"]?.change_percent}
                comparison={kpiMap["avg_unit_price"]?.comparison}
              />
            </div>
          </div>
        </div>

        {report.payment_mix.length ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2.5 text-xs font-semibold text-foreground">Metode Pembayaran</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {report.payment_mix.map((row) => {
                const methodLabel = row.method.toLowerCase() === "cod" ? "COD (nilai pesanan)" : "Transfer Bank"
                return (
                  <div key={row.method} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{methodLabel}</span>
                    </div>
                    <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                      {formatNumber(row.count)} pesanan
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </SectionCard>

      {/* LAYER 5: ANALISIS KATALOG PRODUK. Satu kartu, TIGA tab di header:
          Terlaris, Paling Dilihat, Paling Diklik. Konten berganti mengikuti
          tab, bukan dua baris bertumpuk. */}
      <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <React.Fragment>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5 pb-3">
            <div className="flex flex-wrap gap-1">
              {([
                { key: "terlaris" as const, label: "Terlaris" },
                { key: "viewed" as const, label: "Paling Dilihat" },
                { key: "clicked" as const, label: "Paling Diklik" },
              ]).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTabProduk(t.key)}
                  aria-pressed={tabProduk === t.key}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition",
                    tabProduk === t.key
                      ? "bg-foreground text-background shadow-xs font-semibold"
                      : "bg-surface text-muted-foreground hover:text-foreground border border-border",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {tabProduk === "terlaris"
                ? Math.min(6, report.top_products.length) + " teratas"
                : (tabProduk === "viewed"
                    ? report.product_breakdowns.most_viewed.length
                    : report.product_breakdowns.most_clicked.length) + " produk"}
            </span>
          </header>

          {tabProduk === "terlaris" ? (
        <div>
          <div>
            {report.top_products.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-left text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 w-12 text-center">Foto</th>
                      <th className="px-4 py-2">Nama Produk</th>
                      <th className="px-3 py-2 text-right">Unit</th>
                      <th className="px-3 py-2 text-right">Pesanan</th>
                      <th className="px-4 py-2 text-right">Nilai Produk Terjual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {report.top_products.slice(0, 6).map((product) => (
                      <tr key={`${product.parent_sku}-${product.name}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-8 mx-auto rounded object-cover border border-border" />
                          ) : (
                            <div className="size-8 mx-auto flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-[200px]">
                          <p className="truncate font-normal text-foreground" title={product.name}>{product.name}</p>
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground">{product.parent_sku}</span>
                            <CopyButton text={product.parent_sku} label="Salin SKU" compact showTextInTitle />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-foreground">{formatNumber(product.units)}</td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">{formatNumber(product.order_count)}</td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">{formatCurrency(product.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                className="min-h-40 border-0 bg-transparent"
                title="Belum ada penjualan produk"
                description="Nilai produk terjual muncul setelah ada pesanan fulfillment pada periode ini."
              />
            )}
          </div>

          {report.top_products.length > 0 ? (
            <div className="border-t border-border p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTopProductsModal(true)}
                className="w-full text-xs font-semibold"
              >
                Lihat semua {report.top_products.length} produk terlaris
                <Icon name="arrow-right" className="ml-1.5 size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
          ) : (
            <ProductBreakdownGrid
              breakdowns={report.product_breakdowns}
              onViewAll={() => setShowInteractionModal(true)}
              tab={tabProduk}
            />
          )}
        </React.Fragment>
      </div>

      {/* ========================================================================= */}
      {/* POPUP MODAL 1: RINCIAN PENJUALAN SELURUH PRODUK (TOP SELLERS FULL LIST)  */}
      {/* ========================================================================= */}
      <Dialog open={showTopProductsModal} onOpenChange={setShowTopProductsModal}>
        <DialogContent className="!w-[min(96vw,68rem)] !max-w-5xl flex max-h-[88vh] flex-col gap-0 p-0 overflow-hidden">
          <div className="border-b border-border p-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Rincian Penjualan Produk Terlaris
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Peringkat produk berdasarkan nilai produk terjual dan unit fisik dari pesanan fulfillment periode {report.range.label}.
                </DialogDescription>
              </div>
            </div>

            {/* Input Pencarian Cepat di dalam Modal */}
            <div className="mt-3">
              <Input
                type="search"
                placeholder="Cari nama produk atau SKU..."
                value={searchQueryTop}
                onChange={(e) => setSearchQueryTop(e.target.value)}
                className="h-8 text-xs max-w-md"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {filteredTopProductsModal.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs text-left text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center">No</th>
                    <th className="px-4 py-2.5 w-14 text-center">Foto</th>
                    <th className="px-4 py-2.5">Produk & SKU</th>
                    <th className="px-4 py-2.5 text-right">Unit Terjual</th>
                    <th className="px-4 py-2.5 text-right">Pesanan</th>
                    <th className="px-4 py-2.5 text-right">Nilai Produk Terjual</th>
                    <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTopProductsModal.map((product, idx) => {
                    return (
                      <tr key={`${product.parent_sku}-${product.name}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-center text-muted-foreground tabular-nums font-semibold">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-8 mx-auto rounded object-cover border border-border" />
                          ) : (
                            <div className="size-8 mx-auto flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-md">
                          <Link
                            href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                            className="font-normal text-foreground hover:text-primary hover:underline leading-snug block"
                            title={`Kelola ${product.name} di admin`}
                          >
                            {product.name}
                          </Link>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{product.parent_sku}</span>
                            <CopyButton text={product.parent_sku} label="Salin SKU" compact showTextInTitle />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-foreground">
                          {formatNumber(product.units)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                          {formatNumber(product.order_count)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">
                          {formatCurrency(product.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              title="Kelola produk di panel admin"
                            >
                              Kelola
                            </Link>
                            <span className="text-muted-foreground/40">·</span>
                            <a
                              href={`/product/${product.parent_sku}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              title="Buka tampilan etalase toko"
                            >
                              <Icon name="arrow-up-right" className="size-3" aria-hidden="true" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Tidak ada produk yang cocok dengan pencarian "{searchQueryTop}".
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs">
            <span className="text-muted-foreground">
              Menampilkan {filteredTopProductsModal.length} dari {report.top_products.length} produk
            </span>
            <Button size="sm" variant="secondary" onClick={() => setShowTopProductsModal(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* POPUP MODAL 2: RINCIAN INTERAKSI PRODUK (PALING DILIHAT & PALING DIKLIK) */}
      {/* ========================================================================= */}
      <Dialog open={showInteractionModal} onOpenChange={setShowInteractionModal}>
        <DialogContent className="!w-[min(96vw,68rem)] !max-w-5xl flex max-h-[88vh] flex-col gap-0 p-0 overflow-hidden">
          <div className="border-b border-border p-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  Rincian Interaksi & Minat Produk
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Halaman produk yang paling banyak dilihat dan diklik pengunjung.
                </DialogDescription>
              </div>

              {/* Tab Selector di dalam Modal */}
              <div className="flex gap-1">
                {([
                  ["viewed", "Paling Dilihat"],
                  ["clicked", "Paling Diklik"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModalInteractionTab(key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition",
                      modalInteractionTab === key
                        ? "bg-foreground text-background shadow-xs font-semibold"
                        : "bg-surface text-muted-foreground hover:text-foreground border border-border",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Pencarian Cepat di dalam Modal */}
            <div className="mt-3">
              <Input
                type="search"
                placeholder="Cari nama produk atau SKU..."
                value={searchQueryInteraction}
                onChange={(e) => setSearchQueryInteraction(e.target.value)}
                className="h-8 text-xs max-w-md"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-0">
            {interactionModalData.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs text-left text-xs font-semibold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 w-12 text-center">No</th>
                    <th className="px-4 py-2.5 w-14 text-center">Foto</th>
                    <th className="px-4 py-2.5">Produk & SKU</th>
                    <th className="px-4 py-2.5 text-right">Dilihat</th>
                    <th className="px-4 py-2.5 text-right">Diklik</th>
                    <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {interactionModalData.map((item, idx) => {
                    const product = item as ProductBreakdown
                    const views = product.views ?? 0
                    const clicks = product.clicks ?? 0
                    return (
                      <tr key={`${product.parent_sku}-${product.product_id}`} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-center text-muted-foreground tabular-nums font-semibold">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {product.image ? (
                            <img src={product.image} alt="" className="size-8 mx-auto rounded object-cover border border-border" />
                          ) : (
                            <div className="size-8 mx-auto flex items-center justify-center rounded bg-muted text-[11px] font-bold text-muted-foreground">
                              {product.name.charAt(0)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 max-w-md">
                          <Link
                            href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                            className="font-normal text-foreground hover:text-primary hover:underline leading-snug block"
                            title={`Kelola ${product.name} di admin`}
                          >
                            {product.name}
                          </Link>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{product.parent_sku}</span>
                            <CopyButton text={product.parent_sku} label="Salin SKU" compact showTextInTitle />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                          {formatNumber(views)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-muted-foreground">
                          {formatNumber(clicks)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`${routeUrl("admin.products.index")}?search=${encodeURIComponent(product.parent_sku)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              title="Kelola produk di panel admin"
                            >
                              Kelola
                            </Link>
                            <span className="text-muted-foreground/40">·</span>
                            <a
                              href={`/product/${product.parent_sku}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-muted-foreground hover:text-foreground"
                              title="Buka tampilan etalase toko"
                            >
                              <Icon name="arrow-up-right" className="size-3" aria-hidden="true" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Tidak ada data yang cocok dengan pencarian "{searchQueryInteraction}".
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs">
            <span className="text-muted-foreground">
              Menampilkan {interactionModalData.length} data produk
            </span>
            <Button size="sm" variant="secondary" onClick={() => setShowInteractionModal(false)}>
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Satu drawer untuk seluruh detail. Lebarnya tetap supaya berpindah
          kategori tidak menggeser tata letak, dan cukup lega untuk tabel
          rekonsiliasi arus kas. */}
      <Sheet
        open={detailCategory !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCategory(null)
        }}
      >
        <SheetContent
          side="right"
          title="Detail kategori performa toko"
          className="w-[min(94vw,44rem)] sm:max-w-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {detailCategory && detailIsi ? (
            <CategoryDetailPanel
              category={detailCategory}
              detail={detailIsi}
              onSelectCategory={bukaKategori}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  )
}
