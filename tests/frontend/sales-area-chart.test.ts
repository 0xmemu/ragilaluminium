import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

/**
 * Guard komposisi grafik penjualan.
 *
 * Recharts membatasi anak yang dirender lewat `GraphicalChild`, dan tiap tipe
 * chart punya daftar berbeda:
 *   AreaChart     -> hanya Area
 *   LineChart     -> hanya Line
 *   ComposedChart -> Line, Area, Bar, Scatter
 *
 * Karena itu <Line dataKey="previous_value"> di dalam <AreaChart> DIBUANG
 * diam-diam tanpa error: garis pembanding periode lalu tidak pernah muncul
 * walau propertinya terisi. Kejadian nyata 2026-09-18 di dashboard admin.
 *
 * Render test tidak dipakai karena ResponsiveContainer butuh dimensi layout
 * yang tidak tersedia di jsdom, sehingga hasilnya tidak dapat dipercaya.
 */
const source = readFileSync(
  fileURLToPath(new URL("../../resources/js/components/admin/charts/sales-area-chart.tsx", import.meta.url)),
  "utf8",
)

describe("SalesAreaChart", () => {
  it("memakai ComposedChart, bukan AreaChart", () => {
    // AreaChart akan membuang <Line> secara diam-diam.
    expect(source).toMatch(/<ComposedChart\b/)
    expect(source).not.toMatch(/<AreaChart\b/)
    expect(source).not.toMatch(/^\s*AreaChart,\s*$/m)
  })

  it("merender seri pembanding periode lalu", () => {
    expect(source).toMatch(/dataKey="previous_value"/)
  })

  it("mendukung Line dan Area sekaligus", () => {
    expect(source).toMatch(/^\s*Line,\s*$/m)
    expect(source).toMatch(/^\s*Area,\s*$/m)
  })
})
