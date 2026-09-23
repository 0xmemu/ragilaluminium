import * as React from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

/**
 * DOM test pemetaan scope (instruksi owner): dengan fixture payload,
 * membuktikan drawer memisahkan scope dan tidak ada delta pada metrik
 * current. Harapan dihitung dari fixture, bukan dari backend.
 */

vi.mock("@/layouts/admin-layout", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("div", null, (props as { children?: React.ReactNode }).children ?? null),
}))

vi.mock("@inertiajs/react", () => ({
  Head: () => React.createElement("title"),
  Link: (props: Record<string, unknown>) =>
    React.createElement("a", { ...props }, (props as { children?: React.ReactNode }).children ?? null),
  router: { get: () => undefined },
  usePage: () => ({ props: {}, url: "", component: "" }),
}))

vi.mock("@/lib/routes", () => ({
  routeUrl: (nama: string) => "/uji/" + String(nama),
}))

// Basis fixture yang sama dengan test DOM kontrak, diimpor ulang di sini agar
// tidak menyalin datanya. Kita bangun ulang versi minimal: cukup metric_basis,
// sections, dan financial untuk drawer.
const metricBasis = {
  omzet: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "rupiah" },
  orders: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "pesanan" },
  net_revenue: { scope: "period", anchor: "Tanggal pesanan dibuat dan tanggal retur selesai", marker: null, unit: "rupiah" },
  payments_received: { scope: "period", anchor: "Tanggal pembayaran lunas", marker: null, unit: "rupiah" },
  cod_paid: { scope: "period", anchor: "Tanggal pembayaran lunas", marker: null, unit: "rupiah" },
  cod_pending_in_period_amount: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "rupiah" },
  visitors: { scope: "period", anchor: "Tanggal kunjungan", marker: null, unit: "kunjungan" },
  buyers: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "orang" },
  conversion: { scope: "period", anchor: "Tanggal kunjungan", marker: null, unit: "persen" },
  open_orders: { scope: "current", anchor: null, marker: "kondisi saat ini", unit: "pesanan" },
  cod_pending_amount: { scope: "current", anchor: null, marker: "semua waktu", unit: "rupiah" },
  payment_pending_count: { scope: "current", anchor: null, marker: "kondisi saat ini", unit: "pembayaran" },
  returns_open: { scope: "current", anchor: null, marker: "kondisi saat ini", unit: "kasus" },
  avg_confirm_hours: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "jam" },
  completed_orders: { scope: "period", anchor: "Tanggal pesanan selesai", marker: null, unit: "pesanan" },
  new_customers: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "orang" },
} as const

function kpi(key: string, label: string, value: number, format: "currency" | "number" | "percent" | "hours" | "days", previous: number | null = null, change: number | null = null) {
  return { key, label, value, previous, change_percent: change, format, detail: null }
}

const fixture = {
  report: {
    range: {
      period: "custom", label: "Rentang kustom",
      from_date: "1 Agt 2026", to_date: "31 Agt 2026",
      from_date_iso: "2026-08-01", to_date_iso: "2026-08-31",
      granularity: "day", compare_label: "vs 1 Jul 2026 00:00 - 31 Jul 2026 23:59",
      compare_from_date: "1 Jul 2026", compare_to_date: "31 Jul 2026",
      is_running: false, input_diabaikan: [], rentang_dipotong: false,
    },
    generated_at: "2026-09-23T10:00:00+07:00",
    financial: {
      gross_revenue: 1000000, refund_adjustments: 0, return_shipping_store: 0,
      refused_goods_value: 0, net_revenue: 800000, payments_received: 700000,
      cod_paid: 300000, cod_pending_amount: 120000, cod_pending_count: 2,
      cod_pending_in_period_amount: 40000, cod_pending_in_period_count: 1,
      payment_pending_count: 3, visitors: 8, buyers: 5,
      visitors_available_from: null,
      definition: "Definisi.",
    },
    sections: [
      { key: "sales", title: "Penjualan", kpis: [
        kpi("omzet", "Penjualan Gross", 1000000, "currency", 500000, 100),
        kpi("orders", "Jumlah Pesanan", 6, "number", 3, 100),
      ] },
      { key: "traffic", title: "Kunjungan", kpis: [
        kpi("visitors", "Pengunjung Unik", 8, "number", 6, 33.3),
        kpi("buyers", "Pembeli Unik", 5, "number", 4, 25),
        kpi("conversion", "Pengunjung yang Membeli", 62.5, "percent", 66.7, -6.3),
        kpi("new_customers", "Pelanggan Baru", 4, "number", 2, 100),
      ] },
      { key: "operations", title: "Operasional", kpis: [
        kpi("open_orders", "Pesanan Belum Selesai (kondisi saat ini)", 7, "number"),
        kpi("returns_open", "Retur Aktif (kondisi saat ini)", 1, "number"),
        kpi("payment_pending_count", "Pembayaran Transfer Pending (kondisi saat ini)", 3, "number"),
        kpi("completed_orders", "Pesanan Selesai", 2, "number", 1, 100),
        kpi("avg_confirm_hours", "Rata-rata Waktu Konfirmasi", 2.5, "hours", 3, -16.7),
      ] },
      { key: "returns_cancellations", title: "Retur & Pembatalan", kpis: [
        kpi("returns", "Pesanan dengan Retur Barang Selesai", 1, "number", 0, 100),
        kpi("returns_open", "Retur Aktif (kondisi saat ini)", 1, "number"),
        kpi("returns_completed", "Kasus Retur Selesai", 2, "number", 1, 100),
        kpi("cancelled_orders", "Pesanan Dibatalkan", 1, "number", 0, 100),
      ] },
    ],
    previous_has_data: true,
    metric_basis: metricBasis,
    date_contract: { timezone: "Asia/Jakarta" },
    return_shipping_costs: [],
    charts: [],
    top_products: [],
    customers: [],
    payment_mix: [],
    product_breakdowns: { most_viewed: [], most_clicked: [], best_sellers: [] },
  },
}

function kpiMapDariFixture(): Record<string, never> {
  const peta: Record<string, never> = {}
  for (const bagian of fixture.report.sections) {
    for (const k of bagian.kpis) {
      peta[k.key] = k as never
    }
  }
  return peta
}

const modul = (await import("@/pages/Admin/Analytics/StorePerformance")) as {
  buildCategoryDetail: (typeof import("@/pages/Admin/Analytics/StorePerformance"))["buildCategoryDetail"]
  CategoryDetailPanel: (typeof import("@/pages/Admin/Analytics/StorePerformance"))["CategoryDetailPanel"]
}

describe("pemetaan scope pada DOM drawer", () => {
  const { buildCategoryDetail, CategoryDetailPanel } = modul

  function renderKategori(kategori: Parameters<typeof buildCategoryDetail>[0]): string {
    const detail = buildCategoryDetail(
      kategori,
      fixture.report,
      kpiMapDariFixture(),
      false,
      null,
    )
    return renderToString(
      React.createElement(CategoryDetailPanel, {
        category: kategori,
        detail,
        onSelectCategory: () => undefined,
      }),
    )
  }

  it("arus kas memisahkan kas periode dari posisi saat ini", () => {
    const html = renderKategori("arus-kas")
    expect(html).toContain("D. Kas Periode Terpilih")
    expect(html).toContain("E. Posisi Kas Saat Ini")
    const d = html.indexOf("D. Kas Periode Terpilih")
    const e = html.indexOf("E. Posisi Kas Saat Ini")
    const blokD = html.slice(d, e)
    const blokE = html.slice(e)
    expect(blokD).toContain('data-metric-key="payments_received"')
    expect(blokD).toContain('data-metric-key="cod_pending_in_period_amount"')
    expect(blokD).not.toContain('data-metric-key="cod_pending_amount"')
    expect(blokE).toContain('data-metric-key="cod_pending_amount"')
    // Snapshot tidak membawa badge perubahan (tanpa simbol persen).
    expect(blokE).not.toContain("%")
  })

  it("operasional memisahkan antrean saat ini dari metrik periode", () => {
    const html = renderKategori("operasional")
    const i = html.indexOf("Antrean Saat Ini")
    const j = html.indexOf("Metrik Periode Terpilih")
    const antara = html.slice(i, j)
    expect(antara).toContain('data-metric-key="open_orders"')
    expect(antara).not.toContain('data-metric-key="avg_confirm_hours"')
    expect(antara).not.toContain("%")
  })

  it("retur menempatkan returns_open di blok tersendiri tanpa delta", () => {
    const html = renderKategori("retur")
    expect(html).toContain("Retur Aktif Saat Ini")
    const i = html.indexOf("Retur Aktif Saat Ini")
    const j = html.indexOf("Pembatalan Periode Terpilih")
    const antara = html.slice(i, j)
    expect(antara).toContain('data-metric-key="returns_open"')
    expect(antara).not.toContain("%")
  })

  it("baris periode menampilkan delta dari payload", () => {
    const html = renderKategori("pengunjung")
    // visitors +33,3 dari payload.
    expect(html).toContain("33,3")
    expect(html).toContain('data-metric-key="visitors"')
  })
})
