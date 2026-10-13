import * as React from "react"
import { renderToString } from "react-dom/server"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { formatCurrency, formatDurationVis, formatNumber } from "@/lib/format"

/**
 * DOM contract test renderer pasif (ADR-026).
 *
 * Halaman dirender dari FIXTURE payload, bukan dari server. Setiap harapan
 * dihitung dari isi fixture memakai util formatter yang sama dengan halaman,
 * jadi bila isi fixture berubah, harapannya ikut berubah; renderer yang tidak
 * membawa payload ke DOM akan gagal.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

vi.mock("@/layouts/admin-layout", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("div", { "data-layout": "uji" }, [
      (props as { actions?: React.ReactNode }).actions ?? null,
      (props as { children?: React.ReactNode }).children ?? null,
    ]),
}))

vi.mock("@inertiajs/react", () => ({
  Head: (props: { title?: string }) => React.createElement("title", null, props.title ?? ""),
  Link: (props: { href?: string; children?: React.ReactNode }) =>
    React.createElement("a", { ...props, href: props.href ?? "#" }),
  router: { get: () => undefined },
  usePage: () => ({ props: {}, url: "", component: "" }),
}))

vi.mock("@/lib/routes", () => ({
  routeUrl: (nama: string) => "/uji/" + String(nama),
}))

// Fixture payload: satu metrik periode dengan delta, satu metrik snapshot
// dengan previous null, metric_basis, date_contract, financial, seri grafik,
// dan era kunjungan yang belum lengkap.
const fixture = {
  title: "Performa Toko",
  description: "Ringkasan uji.",
  filters: { period: "custom", from: "2026-08-01", to: "2026-08-31", granularity: "day" },
  periodOptions: [{ value: "custom", label: "Rentang kustom" }],
  granularityOptions: [{ value: "day", label: "Per Hari" }],
  report: {
    range: {
      period: "custom",
      label: "Rentang kustom",
      from_date: "1 Agt 2026",
      to_date: "31 Agt 2026",
      from_date_iso: "2026-08-01",
      to_date_iso: "2026-08-31",
      granularity: "day",
      compare_label: "vs 1 Jul 2026 00:00 - 31 Jul 2026 23:59",
      compare_from_date: "1 Jul 2026",
      compare_to_date: "31 Jul 2026",
      is_running: false,
      input_diabaikan: [],
      rentang_dipotong: false,
    },
    generated_at: "2026-09-23T10:00:00+07:00",
    financial: {
      gross_revenue: 1234500,
      refund_adjustments: 25000,
      return_shipping_store: 10000,
      refused_goods_value: 5000,
      net_revenue: 1100000,
      payments_received: 900000,
      cod_paid: 400000,
      cod_pending_amount: 150000,
      cod_pending_count: 2,
      visitors_available_from: "2026-08-10",
      definition: "Definisi keuangan dari payload.",
    },
    sections: [
      {
        key: "sales",
        title: "Penjualan",
        kpis: [
          {
            key: "omzet",
            label: "Penjualan Gross",
            value: 1234500,
            previous: 500000,
            change_percent: 146.9,
            format: "currency",
            detail: "Definisi omzet dari payload.",
          },
          {
            key: "orders",
            label: "Jumlah Pesanan",
            value: 6,
            previous: 3,
            change_percent: 100,
            format: "number",
            detail: "Definisi pesanan dari payload.",
          },
          {
            key: "products",
            label: "Produk Terjual",
            value: 9,
            previous: 4,
            change_percent: 125,
            format: "number",
            detail: null,
          },
          {
            key: "units",
            label: "Jumlah Unit Terjual",
            value: 11,
            previous: 3,
            change_percent: 266.7,
            format: "number",
            detail: null,
          },
        ],
      },
      {
        key: "traffic",
        title: "Kunjungan",
        kpis: [
          {
            key: "visitors",
            label: "Pengunjung Unik",
            value: 8,
            previous: null,
            change_percent: null,
            format: "number",
            detail: "Definisi pengunjung dari payload.",
          },
          {
            key: "conversion",
            label: "Pengunjung yang Membeli",
            value: 12.5,
            previous: null,
            change_percent: null,
            format: "percent",
            detail: "Definisi konversi dari payload.",
          },
        ],
      },
      {
        key: "operations",
        title: "Operasional",
        kpis: [
          {
            key: "open_orders",
            label: "Pesanan Belum Selesai (kondisi saat ini)",
            value: 7,
            previous: null,
            change_percent: null,
            format: "number",
            detail: "Definisi antrean dari payload.",
          },
          {
            key: "avg_confirm_hours",
            label: "Rata-rata Waktu Konfirmasi",
            value: 2.5,
            previous: 3,
            change_percent: -12.5,
            format: "hours",
            detail: "Definisi konfirmasi dari payload.",
          },
        ],
      },
    ],
    previous_has_data: true,
    metric_basis: {
      omzet: {
        scope: "period",
        anchor: "Tanggal pesanan dibuat; diakui bila mencapai Diproses paling lambat akhir periode",
        marker: null,
        unit: "rupiah",
      },
      orders: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "pesanan" },
      products: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "produk" },
      units: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "unit" },
      visitors: { scope: "period", anchor: "Tanggal kunjungan", marker: null, unit: "kunjungan" },
      conversion: { scope: "period", anchor: "Tanggal kunjungan", marker: null, unit: "persen" },
      open_orders: {
        scope: "current",
        anchor: null,
        marker: "kondisi saat ini",
        unit: "pesanan",
      },
      avg_confirm_hours: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "jam" },
      completed_orders: { scope: "period", anchor: "Tanggal pesanan selesai", marker: null, unit: "pesanan" },
      net_revenue: { scope: "period", anchor: "Tanggal pesanan dibuat dan tanggal retur selesai", marker: null, unit: "rupiah" },
      payments_received: { scope: "period", anchor: "Tanggal pembayaran lunas", marker: null, unit: "rupiah" },
      dispatched_orders: { scope: "current", anchor: null, marker: "kondisi saat ini", unit: "pesanan" },
      returns_open: { scope: "current", anchor: null, marker: "kondisi saat ini", unit: "kasus" },
      payment_pending_count: { scope: "current", anchor: null, marker: "kondisi saat ini", unit: "pembayaran" },
      avg_process_days: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "hari" },
      repeat_customers: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "orang" },
      new_customers: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "orang" },
      aov: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "rupiah" },
      avg_unit_price: { scope: "period", anchor: "Tanggal pesanan dibuat", marker: null, unit: "rupiah" },
      cod_pending_amount: {
        scope: "current",
        anchor: "Tanggal pesanan dibuat",
        marker: "semua waktu",
        unit: "rupiah",
      },
    },
    date_contract: {
      timezone: "Asia/Jakarta",
      start_boundary: "Inklusif: hari pertama dihitung sejak 00:00:00",
      end_boundary: "Inklusif: hari terakhir dihitung sampai 23:59:59.999999",
      running_period: "Periode berjalan dipotong ke waktu laporan dibangun",
      comparison: "Periode selesai dibandingkan penuh",
      recognition: "Pesanan dihitung bila dibuat dalam periode dan mencapai Diproses paling lambat akhir periode",
      per_metric: "Kolom tanggal tiap metrik tercantum di metric_basis.anchor",
    },
    return_shipping_costs: [],
    charts: [
      {
        key: "revenue",
        title: "Tren Penjualan Gross",
        total: 1234500,
        previous_total: 500000,
        total_format: "currency",
        series: [{ bucket: "2026-08-05", label: "5 Agt", value: 1234500 }],
        previous_series: [{ bucket: "2026-07-05", label: "5 Jul", value: 500000 }],
      },
    ],
    top_products: [],
    customers: [],
    payment_mix: [{ method: "transfer", count: 2, revenue: 900000 }],
    product_breakdowns: { most_viewed: [], most_clicked: [], best_sellers: [] },
  },
  exportUrl: "/uji/ekspor",
} as unknown as Parameters<(typeof import("@/pages/Admin/Analytics/StorePerformance"))["default"]>[0]

const { default: StorePerformance, buildCategoryDetail, CategoryDetailPanel } = await import(
  "@/pages/Admin/Analytics/StorePerformance"
)

function kpiMapDariFixture(): Record<string, { key: string; label: string; value: number; previous?: number | null; change_percent: number | null; format: string; detail?: string | null }> {
  const peta: Record<string, never> = {}
  for (const bagian of fixture.report.sections) {
    for (const k of bagian.kpis) {
      peta[k.key] = k as never
    }
  }
  return peta as never
}

describe("kontrak DOM renderer pasif Performa Toko", () => {
  const html = renderToString(React.createElement(StorePerformance, fixture))


  it("kartu omzet menampilkan label dan nilai dari payload", () => {
    expect(html).toContain('data-metric-key="omzet"')
    expect(html).toContain("Penjualan Gross")
    // Nilai dihitung dari fixture memakai formatter yang sama dengan halaman.
    expect(html).toContain(formatCurrency(fixture.report.financial.gross_revenue))
    // Hint kartu berasal dari payload: definisi KPI dan satuan metric_basis.
    expect(html).toContain("Definisi omzet dari payload.")
    expect(html).toContain("Satuan: rupiah")
  })

  it("metrik snapshot menampilkan nilai tanpa delta palsu", () => {
    expect(html).toContain('data-metric-key="open_orders"')
    expect(html).toContain("Pesanan Belum Selesai (kondisi saat ini)")
    expect(html).toContain(formatNumber(7))
    // Seluruh kartu open_orders tidak boleh memuat tanda persen: previous-nya
    // null, jadi tidak ada perubahan yang sah untuk ditampilkan.
    const awal = html.indexOf('data-metric-key="open_orders"')
    const akhir = html.indexOf('data-metric-key="avg_confirm_hours"')
    expect(akhir).toBeGreaterThan(awal)
    const potongan = html.slice(awal, akhir)
    expect(potongan).not.toContain("%")
  })

  it("delta periode berasal dari payload, bukan dihitung ulang", () => {
    // Rata-rata konfirmasi: nilai diformat dari payload, perubahan turun 12,5
    // persen dari payload tampil sebagai badge (arah lewat panah, bukan tanda).
    expect(html).toContain(formatDurationVis(2.5))
    expect(html).toContain("12,5")
  })

  it("era kunjungan yang belum lengkap menahan angka, bukan menampilkan nol", () => {
    expect(html).toContain("Belum tersedia")
  })

  it("tidak ada kartu dari key yang tidak ada di metric_basis payload", () => {
    const kunci = [...html.matchAll(/data-metric-key="([^"]+)"/g)].map((m) => m[1])
    expect(kunci.length).toBeGreaterThan(0)
    const basis = new Set([
      ...Object.keys(fixture.report.metric_basis ?? {}),
      ...fixture.report.charts.map((c) => c.key),
    ])
    for (const k of kunci) {
      expect([...basis]).toContain(k)
    }
  })

  it("drawer Referensi menampilkan kontrak tanggal dan satuan dari payload", () => {
    const detail = buildCategoryDetail(
      "referensi",
      fixture.report,
      kpiMapDariFixture() as never,
      true,
      "2026-08-10",
    )
    const htmlDrawer = renderToString(
      React.createElement(CategoryDetailPanel, {
        category: "referensi",
        detail,
        onSelectCategory: () => undefined,
      }),
    )

    // Kontrak Tanggal: nilai fixture tampil apa adanya.
    expect(htmlDrawer).toContain("Zona Waktu")
    expect(htmlDrawer).toContain("Asia/Jakarta")
    expect(htmlDrawer).toContain(fixture.report.date_contract!.end_boundary)
    // Dasar Setiap Metrik: satuan dari metric_basis.
    expect(htmlDrawer).toContain("Satuan")
    expect(htmlDrawer).toContain("rupiah")
    expect(htmlDrawer).toContain(fixture.report.metric_basis!.omzet.anchor)
    // Baris referensi membawa data-metric-key.
    expect(htmlDrawer).toContain('data-metric-key="omzet"')
  })

  it("teks kontrak tidak ada yang ditulis tetap di berkas halaman", () => {
    // Frasa dari fixture date_contract tidak boleh muncul sebagai teks tetap
    // di source: sumbernya payload.
    const sumber = readFileSync(
      join(akar, "resources/js/pages/Admin/Analytics/StorePerformance.tsx"),
      "utf8",
    )
    expect(sumber).not.toContain("23:59:59.999999")
    expect(sumber).not.toContain("mencapai Diproses paling lambat akhir periode")
  })
})
