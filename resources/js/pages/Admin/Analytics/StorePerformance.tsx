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
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/admin/ui/tooltip"

interface Kpi {
  key: string
  label: string
  value: number
  previous: number
  change_percent: number | null
  format: "currency" | "number" | "percent" | "hours" | "days"
  detail?: string | null
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
  /** Dasar hitungan angka Total: jumlah titik seri, unik, atau rasio. */
  total_basis?: "sum" | "unique_period" | "unique_daily" | "ratio"
  series: SeriesPoint[]
  previous_series?: SeriesPoint[]
}

interface Report {
  range: {
    period: string
    label: string
    from_date: string
    to_date: string
    granularity: string
    compare_label: string
    compare_from_date: string
    compare_to_date: string
    is_running: boolean
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
    visitors?: number
    /** Tanggal paling awal data kunjungan yang layak dipercaya. */
    visitors_available_from?: string | null
    payments_received?: number
    cod_paid?: number
    cod_pending_amount?: number
    cod_pending_count?: number
    payment_pending_count?: number
    refused_goods_value?: number
    refused_borne_count?: number
    refused_shipping_cost?: number
    refused_cod_fee?: number
    refused_borne_cost?: number
    definition: string
  }
  sections: Section[]
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
 * Keterangan dasar hitungan angka Total pada header grafik.
 *
 * Beberapa metrik memang tidak bisa dijumlahkan dari titik serinya:
 * produk dan pengunjung dihitung unik, sedangkan konversi adalah rasio.
 * Untuk metrik itu angka Total dihitung atas seluruh periode, sehingga
 * jumlah batangnya tidak akan sama. Keterangan ini membuat perbedaan itu
 * terbaca sebagai penjelasan, bukan sebagai angka yang salah.
 */
function totalBasisNote(basis: string | undefined): string | null {
  if (basis === "unique_period" || basis === "unique_daily") {
    return "dihitung unik sepanjang periode, jadi bukan jumlah titik grafik"
  }
  if (basis === "ratio") return "rasio periode, bukan jumlah titik grafik"
  return null
}

/**
 * Format nilai total dan pembanding pada grafik tren. Satu tempat saja supaya
 * rupiah, persen, dan angka polos tidak berbeda antar chart.
 */
function formatChartValue(value: number | undefined, totalFormat: string): string {
  const angka = value ?? 0
  if (totalFormat === "currency") return formatCurrency(angka)
  if (totalFormat === "percent") return formatNumber(angka) + "%"
  return formatNumber(angka)
}

function formatDuration(value: number, isDays = false): string {
  if (!Number.isFinite(value) || value <= 0) return "0 menit"
  const base = isDays ? value * 24 : value
  const totalMinutes = Math.round(base * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const jam = hours.toString() + " jam"
  const menit = minutes.toString() + " menit"
  if (isDays) {
    return minutes === 0 ? jam : jam + " " + menit
  }
  if (hours === 0) return menit
  return minutes === 0 ? jam : jam + " " + menit
}

const TrendChart = React.lazy(() => import("@/components/admin/charts/trend-chart"))



function HoverHint({
  label,
  hint,
  className,
}: {
  label: React.ReactNode
  hint?: string
  className?: string
}) {
  if (!hint) return <span className={className}>{label}</span>
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className={cn(
              "cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-[3px] transition hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
              className,
            )}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs font-normal">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CopySkuButton({ sku }: { sku: string }) {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(sku)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground transition hover:text-foreground hover:bg-muted"
      title={copied ? "Tersalin!" : "Salin SKU " + sku}
      aria-label={"Salin SKU " + sku}
    >
      <Icon
        name={copied ? "check" : "copy"}
        className={cn("size-3", copied ? "text-success" : "text-muted-foreground")}
        aria-hidden="true"
      />
    </button>
  )
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

function ProductBreakdownGrid({ breakdowns, onViewAll }: ProductBreakdownGridProps) {
  // Hanya interaksi. Peringkat penjualan sudah ada di tabel Produk Terlaris di
  // sebelah kiri, jadi tidak dibuat ulang di sini.
  const [tab, setTab] = React.useState<"viewed" | "clicked">("viewed")

  const tabs = [
    { key: "viewed" as const, label: "Paling Dilihat" },
    { key: "clicked" as const, label: "Paling Diklik" },
  ]

  const data = tab === "viewed" ? breakdowns.most_viewed : breakdowns.most_clicked

  // Batasi persis 6 produk di kartu ringkas
  const previewRows = data.slice(0, 6)

  return (
    <section className="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="p-5 pb-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <HoverHint
            label="Produk Berdasarkan Interaksi"
            hint="Peminat katalog (dilihat & diklik) dibanding produk yang dikonversi menjadi penjualan."
            className="text-sm font-semibold tracking-tight text-foreground"
          />
          <div className="flex flex-wrap gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  tab === t.key
                    ? "bg-foreground text-background shadow-xs font-semibold"
                    : "bg-surface text-muted-foreground hover:text-foreground border border-border",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

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
            Lihat semua {data.length} produk ({tabs.find((t) => t.key === tab)?.label})
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
              <CopySkuButton sku={p.parent_sku} />
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

type DrawerSign = "+" | "−" | "=" | "÷" | "·"

type DrawerRow = {
  label: string
  value: string
  sign: DrawerSign
  sub?: string
  note?: string
  tone?: "default" | "muted" | "primary" | "destructive"
}

type DrawerBlock =
  | { kind: "rows"; title?: string; rows: DrawerRow[] }
  | { kind: "items"; title?: string; items: Array<{ title: string; value: string; desc: string }> }

type MetricDetail = {
  title: string
  /** "Kondisi Saat Ini" khusus metrik snapshot: angkanya tidak terikat rentang tanggal. */
  badge: "Periode Terpilih" | "Semua Waktu" | "Kondisi Saat Ini"
  wide?: boolean
  value?: string
  kpiKey?: string
  formula?: string
  blocks: DrawerBlock[]
  source?: string
  notes: string[]
}

/**
 * Satu-satunya sumber angka drawer adalah props `report` dari controller.
 * Tidak ada angka contoh yang ditulis di komponen ini: semua nilai dibaca dari
 * report.financial, report.sections[].kpis[], atau report.charts[].series.
 * Bila sebuah bagian tidak punya sumber data, bagian itu tidak dirender.
 */
function buildMetricDetail(
  key: string,
  report: Report,
  kpiMap: Record<string, Kpi>,
  kunjunganTidakLengkap: boolean,
  tersediaSejak: string | null,
): MetricDetail | null {
  const fin = report.financial
  const kpiValue = (kpiKey: string) => kpiMap[kpiKey]?.value ?? 0
  const rp = formatCurrency
  const ang = formatNumber
  const badgePeriode = "Periode Terpilih" as const

  // Catatan batas data diturunkan dari fakta payload, bukan daftar statis.
  const catatanKunjungan: string[] = kunjunganTidakLengkap && tersediaSejak
    ? ["Data kunjungan baru andal sejak " + tersediaSejak + ". Rentang yang mulai sebelum tanggal itu tidak menampilkan angka kunjungan dan konversi."]
    : []

  const barisPembentukanGross: DrawerRow[] = [
    { label: "Nilai Produk Terjual", value: rp(fin.items_before_discount ?? 0), sign: "+" },
    { label: "Voucher Toko", value: rp(fin.voucher_discount ?? 0), sign: "−" },
    { label: "Ongkir Dibayar Pembeli", value: rp(fin.shipping_paid_by_customer ?? 0), sign: "+" },
    { label: "Asuransi Pengiriman", value: rp(fin.insurance ?? 0), sign: "+" },
    { label: "Biaya COD Dibayar Pembeli", value: rp(fin.cod_fee ?? 0), sign: "+" },
    { label: "Total Penjualan Gross", value: rp(fin.gross_revenue), sign: "=", tone: "primary" },
  ]

  switch (key) {
    case "gross-revenue":
      return {
        title: "Detail Penjualan Gross",
        badge: badgePeriode,
        value: rp(fin.gross_revenue),
        kpiKey: "omzet",
        formula: "Penjualan Gross = Nilai Produk − Voucher Toko + Ongkir Dibayar Pembeli + Asuransi + Biaya COD Dibayar Pembeli",
        blocks: [{ kind: "rows", rows: barisPembentukanGross }],
        source: "orders.total_amount pada pesanan yang sudah masuk alur fulfillment",
        notes: (fin.product_discount ?? 0) !== 0
          ? ["Diskon produk / flash sale " + rp(fin.product_discount ?? 0) + " bukan pengurang kas: nilai produk sudah memakai harga jual riil setelah promo, sehingga potongan harga coret tidak mengurangi penjualan."]
          : [],
      }

    case "net-revenue":
      return {
        title: "Detail Penjualan Bersih",
        badge: badgePeriode,
        value: rp(fin.net_revenue),
        kpiKey: "net_revenue",
        formula: "Penjualan Bersih = Penjualan Gross − Tagihan J&T − Biaya COD ke J&T − Refund − Ongkir Retur Toko − Nilai Barang Retur Paket",
        blocks: [
          {
            kind: "rows",
            rows: [
              { label: "Penjualan Gross", value: rp(fin.gross_revenue), sign: "+" },
              { label: "Tagihan J&T Cargo", value: rp(fin.shipping_raw ?? 0), sign: "−" },
              { label: "Biaya COD ke J&T", value: rp(fin.cod_fee ?? 0), sign: "−" },
              { label: "Refund Diberikan", value: rp(fin.refund_adjustments ?? 0), sign: "−" },
              { label: "Ongkir Retur Ditanggung Toko", value: rp(fin.return_shipping_store ?? 0), sign: "−" },
              { label: "Nilai Barang Retur Paket", value: rp(fin.refused_goods_value ?? 0), sign: "−" },
              { label: "Penjualan Bersih", value: rp(fin.net_revenue), sign: "=", tone: "primary" },
            ],
          },
        ],
        source: "orders dan order_return_cases",
        notes: [],
      }

    case "alur-uang": {
      const potonganRetur =
        (fin.refund_adjustments ?? 0) + (fin.return_shipping_store ?? 0) + (fin.refused_goods_value ?? 0)
      const blocks: DrawerBlock[] = [
        { kind: "rows", title: "A. Pembentukan Penjualan Gross", rows: barisPembentukanGross },
        {
          kind: "rows",
          title: "B. Pengurang setelah Penjualan Gross",
          rows: [
            {
              label: "Tagihan J&T Cargo",
              value: rp(fin.shipping_raw ?? 0),
              sign: "−",
              sub: "Ongkir dibayar pembeli " + rp(fin.shipping_paid_by_customer ?? 0) + " · Asuransi dibayar pembeli " + rp(fin.insurance ?? 0) + " · Subsidi ongkir ditanggung toko " + rp(fin.shipping_subsidy ?? 0),
              note: "Tagihan J&T adalah satu-satunya pengurang ongkir. Baris rincian di atas menjelaskan komposisinya, bukan pengurang tambahan.",
            },
            { label: "Biaya COD ke J&T", value: rp(fin.cod_fee ?? 0), sign: "−" },
            {
              label: "Retur & Biaya Retur",
              value: rp(potonganRetur),
              sign: "−",
              sub: "Refund diberikan " + rp(fin.refund_adjustments ?? 0) + " · Ongkir retur toko " + rp(fin.return_shipping_store ?? 0) + " · Nilai barang retur paket " + rp(fin.refused_goods_value ?? 0),
            },
            { label: "Penjualan Bersih", value: rp(fin.net_revenue), sign: "=", tone: "primary" },
          ],
        },
      ]

      if ((fin.product_discount ?? 0) !== 0) {
        blocks.push({
          kind: "items",
          title: "C. Catatan di Luar Kas",
          items: [
            {
              title: "Diskon Produk / Flash Sale",
              value: rp(fin.product_discount ?? 0),
              desc: "Selisih harga coret terhadap harga jual. Tidak ada uang yang bergerak, hanya potensi harga yang tidak diambil. Harga jual yang dibayar pembeli sudah tercatat pada Nilai Produk di bagian A.",
            },
          ],
        })
      }

      blocks.push({
        kind: "rows",
        title: "D. Posisi Kas",
        rows: [
          {
            label: "Kas Diterima",
            value: rp(fin.payments_received ?? 0),
            sign: "+",
            sub: "Transfer bank lunas " + rp(Math.max(0, (fin.payments_received ?? 0) - (fin.cod_paid ?? 0))) + " · COD Selesai " + rp(fin.cod_paid ?? 0),
          },
          {
            label: "Belum Masuk (semua waktu)",
            value: rp(fin.cod_pending_amount ?? 0),
            sign: "·",
            sub: ang(fin.cod_pending_count ?? 0) + " pesanan COD aktif, dihitung dari kondisi saat ini tanpa batas periode.",
          },
          {
            label: "Retur Paket Ditanggung Toko",
            value: rp(fin.refused_borne_cost ?? 0),
            sign: "·",
            sub: ang(fin.refused_borne_count ?? 0) + " pesanan, ongkir kirim dan biaya layanan COD paket yang kembali sebelum diterima pembeli.",
          },
        ],
      })

      return {
        title: "Rincian Rekonsiliasi Penjualan",
        badge: badgePeriode,
        wide: true,
        value: rp(fin.net_revenue),
        kpiKey: "net_revenue",
        formula: "Penjualan Bersih = Penjualan Gross − Potongan J&T − Retur & Biaya Retur",
        blocks,
        source: "orders, order_return_cases, payments, shipping_records",
        notes: ["Kas Diterima memakai basis waktu dana benar-benar lunas (paid_at), berbeda dari hak penjualan barang. Baris Belum Masuk adalah kondisi saat ini, bukan angka periode."],
      }
    }

    case "orders-count":
      return {
        title: "Detail Jumlah Pesanan",
        badge: badgePeriode,
        value: ang(kpiValue("orders")) + " pesanan",
        kpiKey: "orders",
        formula: "Jumlah Pesanan = COUNT(orders.id) pada status processing, shipped, delivered, completed, return_in_process, return_completed",
        blocks: [],
        source: "orders.order_status",
        notes: ["Pesanan yang belum dikonfirmasi, menunggu pembayaran, atau dibatalkan tidak dihitung."],
      }

    case "units-sold":
      return {
        title: "Detail Jumlah Unit Terjual",
        badge: badgePeriode,
        value: ang(kpiValue("units")) + " unit",
        kpiKey: "units",
        formula: "Jumlah Unit Terjual = SUM(order_items.quantity)",
        blocks: [],
        source: "order_items.quantity",
        notes: ["Diambil dari snapshot pesanan saat checkout, bukan dari stok katalog aktif."],
      }

    case "products-sold":
      return {
        title: "Detail Produk Terjual",
        badge: badgePeriode,
        value: ang(kpiValue("products")) + " produk",
        kpiKey: "products",
        formula: "Produk Terjual = COUNT(DISTINCT order_items.variant_sku)",
        blocks: [
          {
            kind: "rows",
            rows: [
              {
                label: "Produk Terjual",
                value: ang(kpiValue("products")) + " produk",
                sign: "=",
                tone: "primary",
                sub: "Terdiri dari " + ang(kpiValue("models")) + " model produk dan " + ang(kpiValue("products")) + " SKU varian berbeda.",
              },
            ],
          },
        ],
        source: "order_items.variant_sku (snapshot saat checkout)",
        notes: ["Satu produk dengan dua ukuran dihitung dua produk karena identitasnya adalah SKU varian."],
      }

    case "visitors": {
      const visitorChart = report.charts.find((chart) => chart.key === "visitors")
      const rows: DrawerRow[] = (visitorChart?.series ?? [])
        .filter((point) => point.value > 0)
        .map((point) => ({ label: "Kunjungan " + point.label, value: ang(point.value) + " sesi", sign: "+" as const }))
      if (rows.length > 0) {
        rows.push({ label: "Total Periode", value: ang(fin.visitors ?? 0) + " sesi", sign: "=", tone: "primary" })
      }

      return {
        title: "Detail Pengunjung Unik",
        badge: badgePeriode,
        value: kunjunganTidakLengkap ? "Belum tersedia" : ang(fin.visitors ?? 0) + " sesi",
        kpiKey: "visitors",
        formula: "Pengunjung Unik = SUM per hari COUNT(DISTINCT visitor_hash), hanya kunjungan yang lolos penyaring bot",
        blocks: rows.length > 0 && !kunjunganTidakLengkap
          ? [{ kind: "rows", title: "Rincian Kunjungan per Bucket Grafik", rows }]
          : [],
        source: "performance_visitor_events dan performance_metrics",
        notes: catatanKunjungan,
      }
    }

    case "conversion": {
      const visitors = fin.visitors ?? 0
      const rate = kpiValue("conversion")
      const pembeli = visitors > 0 ? Math.round((rate / 100) * visitors) : 0

      return {
        title: "Detail Pengunjung yang Membeli",
        badge: badgePeriode,
        value: kunjunganTidakLengkap ? "Belum tersedia" : ang(rate) + "%",
        kpiKey: "conversion",
        formula: "Pengunjung yang Membeli = (Pembeli Unik ÷ Pengunjung Unik) × 100%",
        blocks: [
          {
            kind: "rows",
            rows: [
              { label: "Pembeli Unik (nomor telepon)", value: ang(pembeli) + " pembeli", sign: "+" },
              {
                label: "Pengunjung Unik",
                value: kunjunganTidakLengkap ? "Belum tersedia" : ang(visitors) + " sesi",
                sign: "÷",
              },
              {
                label: "Pengunjung yang Membeli",
                value: kunjunganTidakLengkap ? "Belum tersedia" : ang(rate) + "%",
                sign: "=",
                tone: "primary",
              },
            ],
          },
        ],
        source: "orders (distinct customer_phone) dan performance_visitor_events",
        notes: [
          "Angka ini rasio, bukan penautan sesi ke pesanan: sistem tidak menyimpan relasi antara sesi kunjungan dan pesanan, sehingga tidak berarti orang yang mengunjungi lalu membeli.",
          ...catatanKunjungan,
        ],
      }
    }

    case "aov":
      return {
        title: "Detail Rata-rata Nilai Pesanan",
        badge: badgePeriode,
        value: rp(kpiValue("aov")),
        kpiKey: "aov",
        formula: "Rata-rata Nilai Pesanan = Penjualan Gross ÷ Jumlah Pesanan",
        blocks: [
          {
            kind: "rows",
            rows: [
              { label: "Penjualan Gross", value: rp(fin.gross_revenue), sign: "+" },
              { label: "Jumlah Pesanan", value: ang(kpiValue("orders")) + " pesanan", sign: "÷" },
              { label: "Rata-rata Nilai Pesanan", value: rp(kpiValue("aov")), sign: "=", tone: "primary" },
            ],
          },
        ],
        source: "orders",
        notes: ["Pembagi memakai pesanan yang masuk alur fulfillment, bukan seluruh pesanan termasuk yang dibatalkan."],
      }

    case "avg-unit-price":
      return {
        title: "Detail Harga Rata-rata per Unit",
        badge: badgePeriode,
        value: rp(kpiValue("avg_unit_price")),
        kpiKey: "avg_unit_price",
        formula: "Harga Rata-rata per Unit = Nilai Produk ÷ Jumlah Unit Terjual",
        blocks: [
          {
            kind: "rows",
            rows: [
              {
                label: "Nilai Produk",
                value: rp(fin.items_before_discount ?? 0),
                sign: "+",
                sub: "Subtotal produk pada pesanan, dihitung sebelum ongkir dan biaya layanan COD.",
              },
              { label: "Jumlah Unit Terjual", value: ang(kpiValue("units")) + " unit", sign: "÷" },
              { label: "Harga Rata-rata per Unit", value: rp(kpiValue("avg_unit_price")), sign: "=", tone: "primary" },
            ],
          },
        ],
        source: "order_items",
        notes: ["Memakai nilai produk, bukan Penjualan Gross, supaya ongkir dan biaya COD tidak ikut terbagi ke harga satuan produk."],
      }

    case "new-customers":
      return {
        title: "Detail Pelanggan Baru",
        badge: badgePeriode,
        value: ang(kpiValue("new_customers")) + " pelanggan",
        kpiKey: "new_customers",
        formula: "Pelanggan Baru = Nomor HP unik yang bertransaksi pada periode ini, dikurangi nomor HP yang sudah pernah bertransaksi sebelum periode ini",
        blocks: [
          {
            kind: "rows",
            rows: [
              { label: "Pelanggan Unik Periode Ini", value: ang(kpiValue("new_customers") + kpiValue("repeat_customers")) + " pelanggan", sign: "+" },
              { label: "Sudah Pernah Memesan", value: ang(kpiValue("repeat_customers")) + " pelanggan", sign: "−" },
              { label: "Pelanggan Baru", value: ang(kpiValue("new_customers")) + " pelanggan", sign: "=", tone: "primary" },
            ],
          },
        ],
        source: "orders.customer_phone pada pesanan yang masuk alur fulfillment, dipisahkan riwayat pesanan sebelum periode",
        notes: ["Nomor HP yang hanya muncul di pesanan batal tidak dihitung, baik sebagai pelanggan baru maupun pelanggan ulang."],
      }

    case "returns-open":
      return {
        title: "Detail Retur Aktif",
        badge: "Kondisi Saat Ini",
        value: ang(kpiValue("returns_open")) + " kasus",
        kpiKey: "returns_open",
        formula: "Retur Aktif = jumlah kasus retur berstatus terbuka pada saat laporan dibangun",
        blocks: [
          {
            kind: "rows",
            rows: [
              { label: "Retur Diajukan (periode ini)", value: ang(kpiValue("returns_created")) + " kasus", sign: "+" },
              { label: "Retur Selesai (periode ini)", value: ang(kpiValue("returns_completed")) + " kasus", sign: "−" },
              { label: "Retur Aktif Saat Ini", value: ang(kpiValue("returns_open")) + " kasus", sign: "=", tone: "primary" },
            ],
          },
        ],
        source: "order_return_cases WHERE status = 'open', tanpa filter tanggal",
        notes: ["Metrik ini snapshot: angkanya dihitung saat laporan dibangun dan tidak dibandingkan dengan periode sebelumnya, karena selisihnya akan selalu nol dan menyesatkan."],
      }

    case "payment-pending":
      return {
        title: "Detail Pembayaran Transfer Pending",
        badge: "Kondisi Saat Ini",
        value: ang(kpiValue("payment_pending_count")) + " pembayaran",
        kpiKey: "payment_pending_count",
        formula: "Pembayaran Transfer Pending = jumlah pembayaran non-COD yang belum lunas pada pesanan aktif saat laporan dibangun",
        blocks: [
          {
            kind: "rows",
            rows: [
              { label: "Pembayaran Diterima (periode ini)", value: rp(fin.payments_received ?? 0), sign: "+" },
              { label: "Pesanan COD (mengikuti barang sampai)", value: rp(fin.cod_paid ?? 0), sign: "·" },
              { label: "Pembayaran Transfer Pending Saat Ini", value: ang(kpiValue("payment_pending_count")) + " pembayaran", sign: "=", tone: "primary" },
            ],
          },
        ],
        source: "payments WHERE method != cod AND paid_at IS NULL pada pesanan aktif, tanpa filter tanggal",
        notes: [
          "Metrik ini snapshot: angkanya dihitung saat laporan dibangun dan tidak dibandingkan dengan periode sebelumnya, karena selisihnya akan selalu nol dan menyesatkan.",
          "COD tidak dihitung di sini karena statusnya mengikuti kejadian barang sampai, bukan konfirmasi pembayaran.",
        ],
      }

    default:
      return null
  }
}

function MetricDetailPanel({
  detail,
  kpiMap,
  range,
}: {
  detail: MetricDetail
  kpiMap: Record<string, Kpi>
  range: Report["range"]
}) {
  return (
    <div className="pb-6">
      <header className="border-b border-border px-5 py-4 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{detail.title}</h3>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {detail.badge}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Konteks laporan: {range.from_date} - {range.to_date} (WIB)
        </p>
      </header>

      <div className="space-y-4 p-5">
        {detail.value ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Nilai</p>
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {detail.value}
              </span>
              {detail.kpiKey ? <DeltaBadge percent={kpiMap[detail.kpiKey]?.change_percent} /> : null}
            </div>
          </div>
        ) : null}

        {detail.formula ? (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Rumus</p>
            <div className="mt-1.5 rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
              {detail.formula}
            </div>
          </div>
        ) : null}

        {detail.blocks.map((block, blockIndex) => (
          <div key={"blok-" + blockIndex} className="overflow-hidden rounded-xl border border-border">
            {block.title ? (
              <p className="border-b border-border bg-muted/20 px-4 py-2 text-xs font-semibold text-foreground">
                {block.title}
              </p>
            ) : null}

            {block.kind === "rows" ? (
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/60">
                  {block.rows.map((row, rowIndex) => (
                    <React.Fragment key={"baris-" + blockIndex + "-" + rowIndex}>
                      <tr
                        className={cn(
                          "align-top",
                          row.sign === "=" ? "bg-muted/20 font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        <td className="px-4 py-2">{row.label}</td>
                        <td className="w-8 py-2 text-right font-mono font-bold tabular-nums text-foreground">
                          {row.sign}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-4 py-2 text-right font-mono tabular-nums",
                            row.sign === "="
                              ? "font-semibold text-primary"
                              : row.tone === "destructive"
                                ? "text-destructive"
                                : "text-foreground",
                          )}
                        >
                          {row.value}
                        </td>
                      </tr>
                      {row.sub ? (
                        <tr>
                          <td colSpan={3} className="px-4 pb-2 text-[11px] leading-relaxed text-muted-foreground">
                            {row.sub}
                          </td>
                        </tr>
                      ) : null}
                      {row.note ? (
                        <tr>
                          <td colSpan={3} className="px-4 pb-2 text-[11px] leading-relaxed text-muted-foreground">
                            {row.note}
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="space-y-2 p-4">
                {block.items.map((item, itemIndex) => (
                  <div
                    key={"item-" + blockIndex + "-" + itemIndex}
                    className="rounded-lg border border-border bg-muted/20 p-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-foreground">
                      <span>{item.title}</span>
                      <span className="font-mono tabular-nums">{item.value}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {detail.source ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sumber Data</p>
            <p className="mt-1 font-mono text-[11px] text-foreground">{detail.source}</p>
          </div>
        ) : null}

        {detail.notes.length > 0 ? (
          <div className="rounded-lg border border-info/30 bg-info/10 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-semibold text-foreground">Catatan Batas Data</p>
            <ul className="mt-1.5 space-y-1">
              {detail.notes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Tombol info kecil pada kartu metrik. Ini jalur aksesibel untuk membuka
 * drawer (Enter / Spasi), karena kartunya sendiri adalah div ber-onClick yang
 * tidak bisa menerima fokus papan tombol.
 */
function MetricInfoButton({
  metric,
  label,
  onOpen,
  className,
}: {
  metric: string
  label: string
  onOpen: (metric: string) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onOpen(metric)
      }}
      title={"Lihat rumus dan rincian " + label}
      aria-label={"Lihat rumus dan rincian " + label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      <Icon name="info" className="size-3.5" aria-hidden="true" />
    </button>
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
  // Detail metrik pada Sheet samping. null berarti panel tertutup.
  const [activeMetric, setActiveMetric] = React.useState<string | null>(null)
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
    for (const sec of report.sections) for (const k of sec.kpis) {
      map[k.key] = k
    }
    return map
  }, [report])

  // Tampilkan "vs <rentang>" utuh sesuai owner 2026-09-15 (jangan buang prefiks "vs").
  const compareLabel = report.range.compare_label || "vs periode lalu"

  // Retur dan biaya retur yang sudah dikurangkan server pada Penjualan Bersih:
  // refund pembeli, ongkir retur yang ditanggung toko, dan nilai barang yang
  // kembali. Dipakai sel "Retur dan Biaya Retur" di Ringkasan Keuangan.
  const potonganRetur =
    (report.financial.refund_adjustments ?? 0) +
    (report.financial.return_shipping_store ?? 0) +
    (report.financial.refused_goods_value ?? 0)

  // Dana COD yang sudah dikirim tapi belum cair. Dipakai di header section
  // operasional sebagai ringkasan kas yang masih di jalan.
  const codPendingAmount = report.financial.cod_pending_amount ?? 0
  const codPendingCount = report.financial.cod_pending_count ?? 0

  // Data kunjungan hanya layak sejak penyaring bot aktif. Periode yang mulai
  // sebelum tanggal itu mencampur data tercemar, jadi angka kunjungan dan
  // konversinya tidak ditampilkan: 7 pembeli dibagi 7 pengunjung akan terbaca
  // konversi 100%, padahal artinya bukan begitu.
  const tersediaSejak = report.financial.visitors_available_from ?? null
  const kunjunganTidakLengkap = Boolean(tersediaSejak) && report.range.from_date < tersediaSejak!

  // Angka drawer dibangun dari props report yang sama dengan kartu di halaman,
  // jadi tidak ada nilai yang ditulis ulang di komponen tampilan.
  const activeDetail = React.useMemo(() => {
    if (!activeMetric) return null
    return buildMetricDetail(activeMetric, report, kpiMap, kunjunganTidakLengkap, tersediaSejak)
  }, [activeMetric, report, kpiMap, kunjunganTidakLengkap, tersediaSejak])

  // Kartu KPI dan baris Alur Uang membuka drawer yang sama. Kartu memakai
  // onClick untuk kenyamanan tetikus; jalur aksesibelnya adalah tombol info di
  // dalam kartu, jadi div ini tidak diberi peran tombol supaya tidak ada
  // kontrol interaktif bersarang.
  const openMetric = (metric: string) => setActiveMetric(metric)
  const metricCardProps = (metric: string) => ({
    onClick: () => openMetric(metric)
  })

  // Selisih durasi ditampilkan dalam satuannya sendiri (jam / hari) supaya
  // pembaca tidak perlu menafsirkan persen dari basis yang nyaris nol.
  const durasi = (key: string, suffix: string) => {
    const k = kpiMap[key]
    return { delta: (k?.value ?? 0) - (k?.previous ?? 0), suffix }
  }
  const durasiConfirm = durasi("avg_confirm_hours", "jam")
  const durasiProcess = durasi("avg_process_days", "hari")
  const [chartTab, setChartTab] = React.useState(0)
  const [chartModel, setChartModel] = React.useState<"line" | "bar">("line")

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

  const returnsSection = report.sections.find((s) => s.key === "returns_cancellations")

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
            {refreshing ? "Memuat..." : "Refresh data"}
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
                  Unduh XLSX
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
            <span className="text-xs font-semibold text-foreground">Periode Analisis:</span>
            <span className="text-xs font-semibold text-primary">{report.range.label}</span>
            <span className="text-xs text-muted-foreground">({report.range.from_date} - {report.range.to_date})</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {refreshing ? "Memperbarui data..." : `Pembanding: ${report.range.compare_label.replace(/^vs\s+/, "")}`}
            </span>
            <span className="text-xs text-muted-foreground" title="Waktu laporan dibangun (WIB)">
              · Diperbarui {new Date(report.generated_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Periode:</span>
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
              <span className="text-xs font-medium text-muted-foreground">Granularitas:</span>
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
          </div>
        </div>

        {refreshError ? (
          <p className="mt-2 text-xs font-medium text-destructive" role="status">
            Gagal memuat pembaruan data. Coba refresh lagi.
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
                label: kpiMap["omzet"]?.label ?? "Penjualan Gross",
                hint: "Total nilai transaksi pembeli pada periode, sebelum dikurangi ongkir J&T, biaya COD, subsidi, dan retur.",
                value: formatCurrency(report.financial.gross_revenue),
                delta: kpiMap["omzet"]?.change_percent,
              },
              {
                metric: "orders-count",
                kpi: "orders",
                chart: "orders",
                label: kpiMap["orders"]?.label ?? "Jumlah Pesanan",
                hint: "Pesanan yang sudah masuk alur fulfillment. Pesanan yang baru masuk dan belum dikonfirmasi belum ikut dihitung.",
                value: formatNumber(kpiMap["orders"]?.value ?? 0),
                delta: kpiMap["orders"]?.change_percent,
              },
              {
                metric: "products-sold",
                kpi: "products",
                chart: "products",
                label: kpiMap["products"]?.label ?? "Produk Terjual",
                hint: "Jumlah produk unik yang terjual pada periode.",
                value: formatNumber(kpiMap["products"]?.value ?? 0),
                delta: kpiMap["products"]?.change_percent,
              },
              {
                metric: "units-sold",
                kpi: "units",
                chart: "units",
                label: kpiMap["units"]?.label ?? "Jumlah Unit Terjual",
                hint: "Total unit fisik terjual pada periode, dihitung dari pesanan fulfillment.",
                value: formatNumber(kpiMap["units"]?.value ?? 0),
                delta: kpiMap["units"]?.change_percent,
              },
              {
                metric: "visitors",
                kpi: "visitors",
                chart: "visitors",
                label: kpiMap["visitors"]?.label ?? "Pengunjung Unik",
                hint: "Jumlah pengunjung unik berdasarkan id sesi per hari yang membuka halaman toko.",
                value: kunjunganTidakLengkap ? (
                  <span className="text-sm font-medium text-muted-foreground">Belum tersedia</span>
                ) : (
                  formatNumber(kpiMap["visitors"]?.value ?? 0)
                ),
                delta: kunjunganTidakLengkap ? undefined : kpiMap["visitors"]?.change_percent,
              },
              {
                metric: "conversion",
                kpi: "conversion",
                chart: "conversion_rate",
                label: kpiMap["conversion"]?.label ?? "Pengunjung yang Membeli",
                hint: "Jumlah pembeli unik dibanding pengunjung unik pada periode ini. Angka ini rasio, bukan penautan sesi ke pesanan: sistem tidak melacak pengunjung mana yang membeli.",
                value: kunjunganTidakLengkap ? (
                  <span className="text-sm font-medium text-muted-foreground">Belum tersedia</span>
                ) : (
                  formatNumber(kpiMap["conversion"]?.value ?? 0) + "%"
                ),
                delta: kunjunganTidakLengkap ? undefined : kpiMap["conversion"]?.change_percent,
              },
            ]

            return heroDefs.map((def) => {
              const chartIdx = def.chart
                ? report.charts.findIndex((c) => c.key === def.chart)
                : -1
              const isActive = chartIdx >= 0 && chartTab === chartIdx
              // Kartu ini satu elemen klik untuk memilih tab grafik. Tombol
              // rincian berada di dalamnya, jadi wadahnya div ber-peran button,
              // bukan <button>: tombol bersarang tidak sah dan merusak fokus.
              const activate = () => {
                if (chartIdx >= 0) setChartTab(chartIdx)
                else openMetric(def.metric)
              }
              return (
                <div
                  key={def.metric}
                  role="button"
                  tabIndex={0}
                  aria-pressed={chartIdx >= 0 ? isActive : undefined}
                  aria-label={
                    chartIdx >= 0
                      ? def.label + (isActive ? ", grafik sedang tampil" : ", tampilkan grafik")
                      : def.label + ", buka rincian"
                  }
                  onClick={activate}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      activate()
                    }
                  }}
                  className={cn(
                    "group flex min-w-0 cursor-pointer flex-col justify-between p-4 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40",
                    // Pemisah grid: garis kanan antar kolom, garis bawah antar
                    // baris. Grid boleh membungkus di lebar menengah, jadi
                    // keduanya dibiarkan aktif.
                    "border-b border-r border-border last:border-b-0",
                    isActive ? "bg-accent" : "hover:bg-muted/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span
                        className={cn(
                          "min-w-0 text-xs font-medium",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {def.label}
                      </span>
                      <MetricInfoButton metric={def.metric} label={def.label} onOpen={openMetric} />
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                      {def.value}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-1 border-t border-border/60 pt-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {chartIdx >= 0 ? (isActive ? "Grafik aktif" : compareLabel) : compareLabel}
                    </span>
                    {def.delta === undefined ? null : <DeltaBadge percent={def.delta} />}
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
          const prev = chart.previous_series ?? []
          const combinedSeries = chart.series.map((item, idx) => ({
            ...item,
            previous_value: prev[idx]?.value,
            previous_label: prev[idx]?.label,
          }))
          return (
            <div className="border-t border-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold tracking-tight text-foreground">
                    {chart.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Total:{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatChartValue(chart.total, chart.total_format)}
                    </span>
                    {totalBasisNote(chart.total_basis) ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({totalBasisNote(chart.total_basis)})
                      </span>
                    ) : null}
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
                    <span>
                      Pembanding:{" "}
                      <span className="font-semibold tabular-nums text-muted-foreground">
                        {formatChartValue(chart.previous_total, chart.total_format)}
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
                    {([
                      { key: "line", label: "Line Chart" },
                      { key: "bar", label: "Bar Chart" },
                    ] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setChartModel(key)}
                        className={cn(
                          "rounded px-2.5 py-1 text-xs font-medium transition",
                          chartModel === key
                            ? "bg-foreground font-semibold text-background shadow-xs"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        title={label}
                      >
                        {label}
                      </button>
                    ))}
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
                    chartType={chartModel}
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
          <Button variant="outline" size="sm" onClick={() => openMetric("alur-uang")}>
            Detail Rekonsiliasi
          </Button>
        }
      >
        <div className="grid divide-y divide-border lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          <div className="p-6">
            <HoverHint
              label={kpiMap["net_revenue"]?.label ?? "Penjualan Bersih"}
              hint="Penjualan Gross dikurangi tagihan J&T Cargo, biaya COD ke J&T, refund pembeli, ongkir retur, dan nilai barang retur."
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Setelah potongan kurir dan retur
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-primary">
              {formatCurrency(report.financial.net_revenue)}
            </p>
            <div className="mt-3">
              <DeltaBadge percent={kpiMap["net_revenue"]?.change_percent} />
            </div>
          </div>

          <div className="p-6">
            <HoverHint
              label={kpiMap["payments_received"]?.label ?? "Pembayaran Diterima"}
              hint="Pembayaran yang tercatat selesai pada periode. Transfer dan COD dipisah di bawahnya."
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Transfer lunas dan COD yang barangnya sudah sampai
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(kpiMap["payments_received"]?.value ?? 0)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Transfer{" "}
              {formatCurrency(
                (kpiMap["payments_received"]?.value ?? 0) - (kpiMap["cod_paid"]?.value ?? 0),
              )}{" "}
              · COD Selesai {formatCurrency(kpiMap["cod_paid"]?.value ?? 0)}
            </p>
          </div>

          <div className="p-6">
            <HoverHint
              label="Belum Masuk"
              hint="Dana COD yang barangnya sudah dikirim tetapi uangnya belum cair ke toko. Angka ini kondisi semua waktu, bukan terikat periode."
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              COD dalam perjalanan, uang belum cair ke toko
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-warning">
              {formatCurrency(codPendingAmount)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatNumber(codPendingCount)} pesanan COD aktif
              {kpiMap["payment_pending_count"]?.value ? (
                <>
                  {" "}
                  · {formatNumber(kpiMap["payment_pending_count"]?.value ?? 0)} transfer belum lunas
                </>
              ) : null}
            </p>
          </div>

          <div className="p-6">
            <HoverHint
              label="Retur dan Biaya Retur"
              hint="Refund pembeli, ongkir retur yang ditanggung toko, dan nilai barang yang kembali. Ketiganya sudah dikurangkan pada Penjualan Bersih."
              className="text-xs font-medium text-muted-foreground"
            />
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Refund, ongkir retur, dan nilai barang kembali
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrency(potonganRetur)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatNumber(kpiMap["returns"]?.value ?? 0)} kasus retur
              {kpiMap["return_shipping_cost_total"]?.value ? (
                <>
                  {" "}
                  · ongkir toko {formatCurrency(kpiMap["return_shipping_cost_total"]?.value ?? 0)}
                </>
              ) : null}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ANTREAN OPERASIONAL DAN KECEPATAN LAYANAN. Tiga kartu pertama antrean
          (dua di antaranya snapshot, ditandai "Kondisi saat ini" supaya tidak
          dibaca sebagai perbandingan periode), tiga berikutnya kecepatan
          layanan pada periode terpilih. */}
      <SectionCard
        title="Antrean Operasional dan Kecepatan Layanan"
        icon="truck"
        description={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span>Antrean fulfillment dan kecepatan layanan pada periode terpilih.</span>
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
            className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["open_orders"]?.label ?? "Pesanan Belum Selesai"}
                hint="Pesanan yang belum selesai: menunggu konfirmasi, sedang diproses, atau sudah dikirim. Ketiganya dihitung, jadi daftar yang terbuka menampilkan seluruh antrean."
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="clock" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["open_orders"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">pesanan</span>
            </p>
            <div className="mt-2">
              <DeltaBadge percent={kpiMap["open_orders"]?.change_percent} upIsBad />
            </div>
          </Link>

          <Link
            href={routeUrl("admin.orders.index") + "?order_status=shipped"}
            className="group flex flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["dispatched_orders"]?.label ?? "Dalam Pengiriman"}
                hint="Pesanan sedang dalam pengiriman ekspedisi kurir pada periode terpilih."
                className="text-xs font-semibold text-muted-foreground group-hover:text-primary"
              />
              <Icon name="truck" className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["dispatched_orders"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">pesanan</span>
            </p>
            <div className="mt-2">
              <DeltaBadge percent={kpiMap["dispatched_orders"]?.change_percent} />
            </div>
          </Link>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label="Retur Aktif"
                hint="Kasus retur yang masih terbuka saat laporan dibuat. Angka ini kondisi saat ini, jadi tidak dibandingkan dengan periode sebelumnya."
                className="text-xs font-semibold text-muted-foreground"
              />
              <MetricInfoButton metric="returns-open" label="Retur Aktif" onOpen={openMetric} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["returns_open"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">kasus</span>
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Kondisi saat ini
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label="Pembayaran Transfer Pending"
                hint={kpiMap["payment_pending_count"]?.detail ?? "Pembayaran non-COD yang belum lunas pada order aktif saat laporan dibuat."}
                className="text-xs font-semibold text-muted-foreground"
              />
              <MetricInfoButton metric="payment-pending" label="Pembayaran Transfer Pending" onOpen={openMetric} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["payment_pending_count"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">pembayaran</span>
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Kondisi saat ini
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_confirm_hours"]?.label ?? "Rata-rata Waktu Konfirmasi"}
                hint={kpiMap["avg_confirm_hours"]?.detail ?? "Rata-rata waktu respon sejak pesanan masuk hingga dikonfirmasi admin."}
                className="text-xs font-semibold text-muted-foreground"
              />
              <MetricInfoButton metric="avg-confirm-hours" label="Rata-rata Waktu Konfirmasi" onOpen={openMetric} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatDuration(kpiMap["avg_confirm_hours"]?.value ?? 0)}
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={null}
                absolute={durasiConfirm.delta}
                absoluteSuffix={durasiConfirm.suffix}
                upIsBad
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_process_days"]?.label ?? "Rata-rata Waktu Proses"}
                hint={kpiMap["avg_process_days"]?.detail ?? "Rata-rata waktu sejak pesanan dikonfirmasi hingga siap diserahkan ke kurir."}
                className="text-xs font-semibold text-muted-foreground"
              />
              <MetricInfoButton metric="avg-process-days" label="Rata-rata Waktu Proses" onOpen={openMetric} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatDuration(kpiMap["avg_process_days"]?.value ?? 0, true)}
            </p>
            <div className="mt-2">
              <DeltaBadge
                percent={null}
                absolute={durasiProcess.delta}
                absoluteSuffix={durasiProcess.suffix}
                upIsBad
              />
            </div>
          </div>
        </div>

        {/* Baris pendukung periode: hasil akhir fulfillment yang tidak masuk
            enam kartu di atas tetapi tetap perlu terlihat. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4 text-xs">
          <span className="flex items-center gap-1.5">
            <Icon name="check-circle" className="size-4 text-muted-foreground" aria-hidden="true" />
            <HoverHint
              label={kpiMap["completed_orders"]?.label ?? "Pesanan Selesai"}
              hint="Pesanan yang telah sampai di tujuan dan diterima pembeli pada periode terpilih."
              className="font-medium text-muted-foreground"
            />
          </span>
          <span className="flex items-center gap-2">
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(kpiMap["completed_orders"]?.value ?? 0)}
            </span>
            <DeltaBadge percent={kpiMap["completed_orders"]?.change_percent} />
          </span>
        </div>

        {/* Rincian retur dan pembatalan dilipat: sering ditanya tetapi tidak
            selalu perlu dilihat, jadi jangan mengambil ruang baris utama. */}
        {returnsSection ? (
          <details className="group mt-4 rounded-md border border-border bg-muted/20">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              <span className="inline-flex items-center gap-2">
                <Icon name="caret-down" className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                Rincian Kasus Retur dan Pembatalan ({returnsSection.kpis.length} indikator)
              </span>
            </summary>
            <div className="grid gap-4 border-t border-border px-4 py-3 text-xs sm:grid-cols-3">
              <div>
                <p className="font-bold text-foreground">Retur Barang</p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>{kpiMap["returns_created"]?.label ?? "Retur Diajukan"}:</span>
                      <DeltaBadge percent={kpiMap["returns_created"]?.change_percent} upIsBad />
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["returns_created"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["returns_open"]?.label ?? "Retur Aktif"}:</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["returns_open"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["returns_completed"]?.label ?? "Retur Selesai"}:</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["returns_completed"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["return_rate_completed"]?.label ?? "Rasio Retur Selesai"}:</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["return_rate_completed"]?.value ?? 0)}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>{kpiMap["refused_orders"]?.label ?? "Pesanan Retur Paket"}:</span>
                      <DeltaBadge percent={kpiMap["refused_orders"]?.change_percent} upIsBad />
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["refused_orders"]?.value ?? 0)}</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-foreground">Pembatalan Pesanan</p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>{kpiMap["cancelled_orders"]?.label ?? "Pesanan Dibatalkan"}:</span>
                      <DeltaBadge percent={kpiMap["cancelled_orders"]?.change_percent} upIsBad />
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["cancelled_orders"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["cancelled_by_customer"]?.label ?? "Dibatalkan Pelanggan"}:</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["cancelled_by_customer"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["cancelled_by_store"]?.label ?? "Dibatalkan Toko"}:</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["cancelled_by_store"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>{kpiMap["cancellation_rate"]?.label ?? "Rasio Pembatalan"}:</span>
                      <DeltaBadge percent={kpiMap["cancellation_rate"]?.change_percent} upIsBad />
                    </span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["cancellation_rate"]?.value ?? 0)}%</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="font-bold text-foreground">Dampak Beban Biaya</p>
                <ul className="mt-2 space-y-1.5 text-muted-foreground">
                  <li className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>{kpiMap["refund_given"]?.label ?? "Refund Diberikan"}:</span>
                      <DeltaBadge percent={kpiMap["refund_given"]?.change_percent} upIsBad />
                    </span>
                    <span className="font-semibold tabular-nums text-destructive">{formatCurrency(kpiMap["refund_given"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["return_shipping_cost_total"]?.label ?? "Ongkir Retur (Toko)"}:</span>
                    <span className="font-semibold tabular-nums text-destructive">{formatCurrency(kpiMap["return_shipping_cost_total"]?.value ?? 0)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>{kpiMap["return_shipping_cost_cases"]?.label ?? "Kasus Retur (Ongkir Toko)"}:</span>
                    <span className="font-semibold tabular-nums text-foreground">{formatNumber(kpiMap["return_shipping_cost_cases"]?.value ?? 0)} kasus</span>
                  </li>
                </ul>
              </div>
            </div>
          </details>
        ) : null}
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
            {...metricCardProps("new-customers")}
            className="flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["new_customers"]?.label ?? "Pelanggan Baru"}
                hint="Pelanggan yang pesanan pertamanya jatuh di dalam rentang tanggal periode ini."
                className="text-xs font-medium text-muted-foreground"
              />
              <MetricInfoButton metric="new-customers" label="Pelanggan Baru" onOpen={openMetric} />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["new_customers"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">pelanggan</span>
            </p>
            <div className="mt-2">
              <DeltaBadge percent={kpiMap["new_customers"]?.change_percent} />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["repeat_customers"]?.label ?? "Pelanggan Ulang"}
                hint="Pelanggan yang sudah pernah memesan sebelum periode ini, dihitung per nomor telepon unik."
                className="text-xs font-medium text-muted-foreground"
              />
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                Rasio {formatNumber(kpiMap["repeat_order_rate"]?.value ?? 0)}%
              </span>
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">
              {formatNumber(kpiMap["repeat_customers"]?.value ?? 0)}{" "}
              <span className="text-xs font-normal text-muted-foreground">pelanggan</span>
            </p>
            <div className="mt-2">
              <DeltaBadge percent={kpiMap["repeat_customers"]?.change_percent} />
            </div>
          </div>

          <div
            {...metricCardProps("aov")}
            className="flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["aov"]?.label ?? "Rata-rata Nilai Pesanan"}
                hint="Penjualan Gross dibagi jumlah pesanan yang masuk alur fulfillment pada periode ini."
                className="text-xs font-medium text-muted-foreground"
              />
              <MetricInfoButton metric="aov" label="Rata-rata Nilai Pesanan" onOpen={openMetric} />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(kpiMap["aov"]?.value ?? 0)}
            </p>
            <div className="mt-2">
              <DeltaBadge percent={kpiMap["aov"]?.change_percent} />
            </div>
          </div>

          <div
            {...metricCardProps("avg-unit-price")}
            className="flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface p-4 transition hover:border-primary"
          >
            <div className="flex items-center justify-between">
              <HoverHint
                label={kpiMap["avg_unit_price"]?.label ?? "Harga Rata-rata per Unit"}
                hint="Nilai produk dibagi jumlah unit terjual. Memakai nilai produk saja, bukan penjualan gross yang memuat ongkir dan biaya COD."
                className="text-xs font-medium text-muted-foreground"
              />
              <MetricInfoButton metric="avg-unit-price" label="Harga Rata-rata per Unit" onOpen={openMetric} />
            </div>
            <p className="mt-2 font-mono text-xl font-bold tabular-nums text-foreground">
              {formatCurrency(kpiMap["avg_unit_price"]?.value ?? 0)}
            </p>
            <div className="mt-2">
              <DeltaBadge percent={kpiMap["avg_unit_price"]?.change_percent} />
            </div>
          </div>
        </div>

        {report.payment_mix.length ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2.5 text-xs font-semibold text-foreground">Metode Pembayaran</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {report.payment_mix.map((row) => {
                const gross = report.financial.gross_revenue
                const pct = gross > 0 ? Math.round((row.revenue / gross) * 1000) / 10 : 0
                const methodLabel = row.method.toLowerCase() === "cod" ? "COD (nilai pesanan)" : "Transfer Bank"
                return (
                  <div key={row.method} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{methodLabel}</span>
                      <span className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {pct}% dari {kpiMap["omzet"]?.label ?? "Penjualan Gross"}
                      </span>
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

      {/* LAYER 5: ANALISIS KATALOG PRODUK (PRODUK TERLARIS & INTERAKSI DI PALING BAWAH) */}
      <div className="mb-5 grid gap-6 xl:grid-cols-2">
        {/* Kolom Kiri: Produk Terlaris - TAMPIL 6 PRODUK */}
        <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5 pb-3">
              <HoverHint
                label="Produk Terlaris"
                hint="Peringkat produk berdasarkan nilai produk terjual dari pesanan fulfillment."
                className="text-sm font-semibold tracking-tight text-foreground"
              />
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {Math.min(6, report.top_products.length)} teratas
              </span>
            </header>
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
                            <CopySkuButton sku={product.parent_sku} />
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

        {/* Kolom Kanan: Produk Berdasarkan Interaksi - TAMPIL 6 PRODUK */}
        <ProductBreakdownGrid
          breakdowns={report.product_breakdowns}
          onViewAll={() => setShowInteractionModal(true)}
        />
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
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Total Nilai Produk Terjual</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(report.top_products.reduce((acc, p) => acc + p.revenue, 0))}
                  </p>
                </div>
                <div className="h-6 w-px bg-border" />
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Total Unit</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {formatNumber(report.top_products.reduce((acc, p) => acc + p.units, 0))} unit
                  </p>
                </div>
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
                    <th className="px-4 py-2.5 text-right">Porsi Penjualan Gross</th>
                    <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTopProductsModal.map((product, idx) => {
                    const gross = report.financial.gross_revenue
                    const pct = gross > 0 ? ((product.revenue / gross) * 100).toFixed(1) : "0.0"
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
                            <CopySkuButton sku={product.parent_sku} />
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
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                            {pct}%
                          </span>
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
                    <th className="px-4 py-2.5 text-right">Rasio Klik / Lihat</th>
                    <th className="px-4 py-2.5 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {interactionModalData.map((item, idx) => {
                    const product = item as ProductBreakdown
                    const views = product.views ?? 0
                    const clicks = product.clicks ?? 0
                    const ctr = views > 0 ? ((clicks / views) * 100).toFixed(1) + "%" : "-"
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
                            <CopySkuButton sku={product.parent_sku} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                          {formatNumber(views)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums text-muted-foreground">
                          {formatNumber(clicks)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">
                            {ctr}
                          </span>
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

      {/* Sheet detail metrik. Lebarnya mengikuti isi: rekonsiliasi alur uang
          butuh ruang lebih karena memuat empat blok tabel. */}
      <Sheet open={activeDetail !== null} onOpenChange={(open) => { if (!open) setActiveMetric(null) }}>
        <SheetContent
          side="right"
          className={cn(
            "sm:max-w-none",
            activeDetail?.wide ? "w-[min(94vw,42rem)]" : "w-[min(90vw,28rem)]",
          )}
        >
          {activeDetail ? (
            <MetricDetailPanel detail={activeDetail} kpiMap={kpiMap} range={report.range} />
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  )
}
