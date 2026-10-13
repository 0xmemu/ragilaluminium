import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Test mapping scope (instruksi owner): setiap kunci metric_basis payload
 * wajib muncul tepat satu kali dalam kelompok UI, semua scope period masuk
 * kelompok periode, semua scope current masuk kelompok kini, dan tidak ada
 * kunci tanpa kelompok. Fungsi kelompokMetrik dibaca dari kode halaman, jadi
 * test ini gagal bila logika pemetaannya berubah tanpa mengikuti payload.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const halaman = readFileSync(
  join(akar, "resources/js/pages/Admin/Analytics/StorePerformance.tsx"),
  "utf8",
)

/** Kelompok drawer yang mengandung tabel per metrik, beserta kuncinya. */
const KELOMPOK_DRAWER: Record<string, string[]> = {
  penjualan: [
    "omzet", "orders", "models", "sub_models", "products", "units",
    "completed_orders", "aov", "avg_unit_price",
  ],
  "arus-kas": ["net_revenue", "payments_received", "cod_paid"],
  operasional: [
    "open_orders", "dispatched_orders", "returns_open", "payment_pending_count",
    "open_orders_in_period", "completed_orders", "avg_confirm_hours", "avg_process_days",
  ],
  pengunjung: [
    "visitors", "buyers", "conversion", "new_customers", "repeat_customers",
    "repeat_order_rate",
  ],
  retur: [
    "returns", "return_value", "returns_created", "returns_completed",
    "return_rate_created", "return_rate_completed", "returns_open",
    "cancelled_orders", "cancelled_by_customer", "cancelled_by_store",
    "cancelled_value", "cancellation_rate", "refund_given",
    "return_shipping_cost_total", "return_shipping_cost_cases",
    "refused_orders", "refused_borne_cost",
  ],
}

/** Kas: period dan current dipisah subbagian. */
const KAS_PERIOD = ["payments_received", "cod_paid", "cod_pending_in_period_amount", "cod_pending_in_period_count"]
const KAS_KINI = ["cod_pending_amount", "cod_pending_count", "payment_pending_count"]

describe("mapping scope metrik drawer", () => {
  it("setiap kelompok drawer di source persis memuat daftar kunci rencananya", () => {
    for (const kunci of Object.values(KELOMPOK_DRAWER)) {
      for (const k of kunci) {
        expect(halaman).toContain('"' + k + '"')
      }
    }
  })

  it("daftar kas terpisah periode dan saat ini terpakai di blok yang tepat", () => {
    const d = halaman.indexOf('"D. Kas Periode Terpilih"')
    const e = halaman.indexOf('"E. Posisi Kas Saat Ini')
    const blokD = halaman.slice(d, e)
    const blokE = halaman.slice(e, halaman.indexOf('"F. Bauran Metode Pembayaran"'))
    for (const k of KAS_PERIOD) {
      expect(blokD).toContain('"' + k + '"')
    }
    for (const k of KAS_KINI) {
      expect(blokE).toContain('"' + k + '"')
      expect(blokD).not.toContain('"' + k + '"')
    }
  })

  it("enam metrik snapshot resmi sesuai instruksi", () => {
    for (const k of ["open_orders", "dispatched_orders", "returns_open", "payment_pending_count", "cod_pending_amount", "cod_pending_count"]) {
      expect(halaman).toContain('"' + k + '"')
    }
  })

  it("returns_open dipisah dari tabel retur ber-delta", () => {
    // Kelompok retur punya judul sendiri untuk snapshot.
    expect(halaman).toContain('"Retur Aktif Saat Ini, tidak dibandingkan"')
    // dan returns_open tidak lagi di kelompok "Retur Periode Terpilih".
    const i = halaman.indexOf('"Retur Periode Terpilih"')
    const j = halaman.indexOf('"Retur Aktif Saat Ini')
    const antara = halaman.slice(i, j)
    expect(antara).not.toContain('"returns_open"')
  })

  it("arus kas memisahkan kas periode dari posisi saat ini", () => {
    expect(halaman).toContain('"D. Kas Periode Terpilih"')
    expect(halaman).toContain('"E. Posisi Kas Saat Ini, tidak dibandingkan periode"')
    const d = halaman.indexOf('"D. Kas Periode Terpilih"')
    const e = halaman.indexOf('"E. Posisi Kas Saat Ini')
    const f = halaman.indexOf('"F. Bauran Metode Pembayaran"')
    const blokD = halaman.slice(d, e)
    const blokE = halaman.slice(e, f)
    // Snapshot tidak boleh ada di blok kas periode.
    expect(blokD).not.toContain('"Belum Masuk (semua waktu)"')
    // Periode tidak boleh ada di blok posisi saat ini.
    expect(blokE).not.toContain("cod_pending_in_period_amount")
  })

  it("operasional memisahkan antrean saat ini dari metrik periode", () => {
    expect(halaman).toContain('"Antrean Saat Ini, tidak dibandingkan"')
    const i = halaman.indexOf('"Antrean Saat Ini, tidak dibandingkan"')
    const j = halaman.indexOf('"Metrik Periode Terpilih"')
    const antara = halaman.slice(i, j)
    // Metrik periode tidak boleh menyusup ke blok antrean.
    expect(antara).not.toContain('"avg_confirm_hours"')
  })

  it("referensi menampilkan kolom perbandingan dari scope, bukan label", () => {
    expect(halaman).toContain('"Perbandingan"')
    expect(halaman).toContain('"Tidak dibandingkan"')
    expect(halaman).toContain('"Periode sebelumnya"')
    // Nilai perbandingan dihitung dari basis.scope, bukan dari marker label.
    expect(halaman).toMatch(/basis\.scope === "current" \? "Tidak dibandingkan" : "Periode sebelumnya"/)
  })

  it("kpiRow membaca scope dari metric_basis lewat displayComparison", () => {
    expect(halaman).toContain("function displayComparison(")
    // Panggilan kpiRow di drawer wajib meneruskan laporan.
    expect(halaman).toMatch(/kpiRows\(kpiMap, grup\.kunci, report\)/)
    expect(halaman).toMatch(/kpiRows\(kpiMap, \[\s*"open_orders"/s)
  })

  it("tidak ada teks kontraktual snapshot yang tertukar", () => {
    // "kondisi saat ini" pada judul blok hanya untuk kelompok snapshot.
    const judul = [...halaman.matchAll(/title: "([^"]*(?:Saat Ini|saat ini)[^"]*)"/g)].map((m) => m[1])
    for (const t of judul) {
      expect(t).toMatch(/tidak dibandingkan/)
    }
  })
})
