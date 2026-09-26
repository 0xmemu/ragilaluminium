import * as React from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { OrderTrackingDetail } from "@/components/public/order-tracking-detail"
import type { PublicOrder } from "@/types"

/**
 * Kontrak ringkasan status halaman lacak pesanan milik pelanggan.
 *
 * Sumber langkah TUNGGAL: order.vm.summary.steps dari backend. Halaman hanya
 * merender. Yang dikunci di sini adalah dua hal yang pernah salah:
 * 1. Jumlah kolom stepper WAJIB mengikuti jumlah langkah. Alur retur hanya 3
 *    langkah, jadi memakai 4 kolom menyisakan satu kolom kosong dan label
 *    akses tetap menyebut 4 makro pengiriman.
 * 2. Tiga langkah retur TIDAK boleh dirender dua kali di satu halaman. Dulu
 *    stepper ringkasan dan kartu alur retur menampilkan daftar yang sama.
 */

vi.mock("@inertiajs/react", () => ({
  Link: (props: { href?: string; children?: React.ReactNode }) =>
    React.createElement("a", { href: props.href ?? "#" }, props.children),
  router: { get: () => undefined, post: () => undefined },
  usePage: () => ({ props: {} }),
}))

vi.mock("@/lib/routes", () => ({
  routeUrl: (nama: string) => "/uji/" + String(nama),
}))

function order(vm: PublicOrder["vm"], status: string): PublicOrder {
  return {
    id: 1,
    order_number: "RA-UJI-1",
    order_status: status,
    payment_method: "transfer",
    total_amount: 500000,
    created_at: "2026-09-20T10:00:00+07:00",
    items: [],
    billing: {},
    reviews: [],
    vm,
  } as unknown as PublicOrder
}

const langkahRetur = [
  { key: "return_recorded", label: "Pengembalian diterima", state: "completed", icon: "check-circle" },
  { key: "return_handling", label: "Sedang ditangani", state: "current", icon: "package" },
  { key: "return_finished", label: "Selesai", state: "upcoming", icon: "check-circle" },
] as never

const langkahKirim = [
  { key: "confirmation", label: "Dikonfirmasi", state: "completed", icon: "check-circle" },
  { key: "fulfillment", label: "Disiapkan", state: "completed", icon: "package" },
  { key: "shipping", label: "Dikirim", state: "current", icon: "truck" },
  { key: "completion", label: "Selesai", state: "upcoming", icon: "check-circle" },
] as never

describe("ringkasan status halaman lacak pesanan", () => {
  it("alur retur 3 langkah memakai tiga kolom dan label pengembalian", () => {
    const html = renderToString(
      React.createElement(
        OrderTrackingDetail,
        {
          order: order(
            {
              summary: { steps: langkahRetur },
              returnFlow: {
                title: "Pengembalian sedang ditangani",
                description: "Sedang diperiksa.",
                recordedAt: "2026-09-21T09:00:00+07:00",
                finishedAt: null,
                steps: langkahRetur,
              },
              primaryStatus: { key: "return_in_process", label: "Retur diproses", tone: "warning" },
            } as never,
            "return_in_process",
          ),
        },
        null,
      ),
    )

    expect(html).toContain("grid-cols-3")
    expect(html).not.toContain("grid-cols-4")
    expect(html).toContain("Progres pengembalian barang")
    expect(html).toContain("Pengembalian diterima")
    expect(html).toContain("Sedang ditangani")
  })

  it("pengiriman normal tetap empat kolom dan label progres pesanan", () => {
    const html = renderToString(
      React.createElement(
        OrderTrackingDetail,
        {
          order: order(
            {
              summary: { steps: langkahKirim },
              primaryStatus: { key: "shipped", label: "Dikirim", tone: "info" },
            } as never,
            "shipped",
          ),
        },
        null,
      ),
    )

    expect(html).toContain("grid-cols-4")
    expect(html).not.toContain("grid-cols-3")
    expect(html).toContain("Progres pesanan")
    expect(html).toContain("Dikonfirmasi")
    expect(html).toContain("Disiapkan")
  })

  it("tiga langkah retur tidak dirender dua kali di halaman yang sama", () => {
    const html = renderToString(
      React.createElement(
        OrderTrackingDetail,
        {
          order: order(
            {
              summary: { steps: langkahRetur },
              returnFlow: {
                title: "Pengembalian sedang ditangani",
                description: "Sedang diperiksa.",
                recordedAt: "2026-09-21T09:00:00+07:00",
                finishedAt: null,
                steps: langkahRetur,
              },
              primaryStatus: { key: "return_in_process", label: "Retur diproses", tone: "warning" },
            } as never,
            "return_in_process",
          ),
        },
        null,
      ),
    )

    // Kartu alur retur terpisah sudah dihapus karena menduplikasi stepper.
    expect(html).not.toContain("order-tracking__return-flow")
    // Label langkah retur muncul sekali saja, bukan dua kali.
    const jumlah = html.split("Pengembalian diterima").length - 1
    expect(jumlah).toBe(1)
  })

  it("tombol pengembalian barang tidak muncul saat pesanan sudah masuk retur", () => {
    const html = renderToString(
      React.createElement(
        OrderTrackingDetail,
        {
          order: order(
            {
              summary: { steps: langkahRetur },
              returnFlow: {
                title: "Pengembalian sedang ditangani",
                description: "Sedang diperiksa.",
                recordedAt: "2026-09-21T09:00:00+07:00",
                finishedAt: null,
                steps: langkahRetur,
              },
              primaryStatus: { key: "return_in_process", label: "Retur diproses", tone: "warning" },
            } as never,
            "return_in_process",
          ),
        },
        null,
      ),
    )

    expect(html).not.toContain("Pengembalian Barang")
    expect(html).not.toContain("Beri Ulasan")
  })
})
