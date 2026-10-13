import { describe, expect, it } from "vitest"

import { backFallbackHref, shouldUseHistoryBack } from "@/lib/breadcrumb-back"

/**
 * Kontrak 2026-09-18: tombol kembali di breadcrumb SELALU tampil.
 *
 * Sebelumnya tombol disembunyikan saat `window.history.length <= 1`, sehingga di
 * desktop tombol kembali bisa hilang sama sekali (mulai 768px tombol di samping
 * judul memang sengaja disembunyikan). Nilai riwayat itu tidak bisa dipercaya:
 * tab baru, alamat yang diketik langsung, dan browser dalam aplikasi bisa
 * melaporkannya sebagai 1 walau pembeli datang dari halaman lain.
 */
describe("shouldUseHistoryBack", () => {
  it("memakai riwayat saat memang ada halaman sebelumnya", () => {
    expect(shouldUseHistoryBack(2)).toBe(true)
    expect(shouldUseHistoryBack(5)).toBe(true)
  })

  it("tidak memakai riwayat saat hanya halaman ini saja", () => {
    expect(shouldUseHistoryBack(1)).toBe(false)
    expect(shouldUseHistoryBack(0)).toBe(false)
  })

  it("nilai tidak wajar dianggap tidak ada riwayat", () => {
    expect(shouldUseHistoryBack(Number.NaN)).toBe(false)
  })
})

describe("backFallbackHref", () => {
  it("memakai href induk terdekat sebelum halaman aktif", () => {
    expect(
      backFallbackHref(
        [
          { label: "Beranda", href: "/" },
          { label: "Jendela Swing", href: "/products/jendela/swing" },
          { label: "Tinggi 80cm x Panjang 80cm", href: null },
        ],
        "/",
      ),
    ).toBe("/products/jendela/swing")
  })

  it("melewati href halaman aktif sendiri", () => {
    expect(
      backFallbackHref(
        [
          { label: "Beranda", href: "/" },
          { label: "Produk", href: "/products/all" },
        ],
        "/",
      ),
    ).toBe("/")
  })

  it("melewati item yang tidak punya href", () => {
    expect(
      backFallbackHref(
        [
          { label: "Beranda", href: "/" },
          { label: "Keranjang", href: null },
          { label: "Proses pesanan", href: null },
        ],
        "/",
      ),
    ).toBe("/")
  })

  it("jatuh ke beranda saat breadcrumb hanya satu item", () => {
    expect(backFallbackHref([{ label: "Keranjang", href: null }], "/")).toBe("/")
  })

  it("jatuh ke beranda saat daftar kosong", () => {
    expect(backFallbackHref([], "/")).toBe("/")
  })

  it("tidak pernah mengembalikan nilai kosong", () => {
    expect(backFallbackHref([], "/beranda")).toBe("/beranda")
  })
})
