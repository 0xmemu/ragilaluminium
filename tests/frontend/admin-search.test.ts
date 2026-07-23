import { describe, expect, it } from "vitest"

import { filterAdminSearchHits, type AdminSearchHit } from "@/lib/admin-search"

const hits: AdminSearchHit[] = [
  {
    id: "core:admin.orders.index",
    label: "Pesanan",
    group: "Utama",
    href: "/admin/orders",
    route: "admin.orders.index",
    icon: "clipboard-list",
  },
  {
    id: "produk:admin.imports.index",
    label: "Import",
    group: "Produk",
    href: "/admin/imports",
    route: "admin.imports.index",
    icon: "upload",
  },
  {
    id: "harga_promo:admin.vouchers.index",
    label: "Voucher Toko",
    group: "Harga & Promo",
    href: "/admin/vouchers",
    route: "admin.vouchers.index",
    icon: "voucher",
  },
]

describe("filterAdminSearchHits", () => {
  it("returns all hits when query empty", () => {
    expect(filterAdminSearchHits(hits, "  ")).toHaveLength(3)
  })

  it("matches label case-insensitively", () => {
    expect(filterAdminSearchHits(hits, "pesanan").map((h) => h.label)).toEqual(["Pesanan"])
  })

  it("matches group name", () => {
    expect(filterAdminSearchHits(hits, "promo").map((h) => h.label)).toEqual(["Voucher Toko"])
  })

  it("matches route fragment", () => {
    expect(filterAdminSearchHits(hits, "imports").map((h) => h.label)).toEqual(["Import"])
  })
})
