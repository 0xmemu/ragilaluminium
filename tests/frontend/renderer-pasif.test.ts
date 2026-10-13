import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Guard renderer pasif (ADR-026): halaman Performa Toko tidak boleh menjadi
 * sumber formula kedua. Semua perhitungan bisnis hidup di server, semua
 * pemformatan visual hidup di util terpusat lib/format.ts.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const halaman = readFileSync(
  join(akar, "resources/js/pages/Admin/Analytics/StorePerformance.tsx"),
  "utf8",
)
const util = readFileSync(join(akar, "resources/js/lib/format.ts"), "utf8")

/** Pola yang dilarang pada halaman, beserta alasan larangannya. */
const POLA_DILARANG: Array<{ pola: RegExp; alasan: string }> = [
  { pola: /\.reduce\(/, alasan: "penjumlahan koleksi payload adalah hitungan bisnis" },
  { pola: /Math\.(round|floor|ceil|abs|pow|sqrt)\(/, alasan: "pembulatan memakai Math adalah hitungan, bukan format" },
  { pola: / \* 100\b/, alasan: "rasio persen dihitung server" },
  { pola: /\/ 100\b/, alasan: "rasio persen dihitung server" },
  { pola: /\.toFixed\(/, alasan: "pemformatan manual menyalin util formatter" },
  { pola: /new Date\(/, alasan: "mengurai tanggal di halaman membuka jalur membentuk rentang sendiri" },
  { pola: /Date\.now\(/, alasan: "waktu laporan berasal dari payload, bukan jam browser" },
  { pola: /toLocaleDateString|toLocaleTimeString/, alasan: "format tanggal lewat util formatter terpusat" },
  { pola: /from "(dayjs|date-fns|moment|luxon)"/, alasan: "pustaka tanggal di halaman membuka jalur menghitung rentang" },
  { pola: /\?\.label \?\? "/, alasan: "fallback label berarti ada daftar KPI kedua yang di-hardcode" },
]

describe("guard renderer pasif Performa Toko", () => {
  it("tidak menghitung atau mengurai apa pun di halaman", () => {
    const temuan: string[] = []
    for (const { pola, alasan } of POLA_DILARANG) {
      const cocok = halaman.match(new RegExp(pola.source, "g")) ?? []
      if (cocok.length) temuan.push(pola.source + " x" + cocok.length + " (" + alasan + ")")
    }
    expect(temuan).toEqual([])
  })

  it("formatter visual hidup di util terpusat lib/format.ts", () => {
    for (const nama of ["formatPercent", "formatDurationVis", "formatKontrak", "formatKontrakChart", "formatWaktuIso", "formatJamIso"]) {
      expect(util).toContain("export function " + nama)
    }
    expect(halaman).toContain('from "@/lib/format"')
  })

  it("traceability terpasang: kartu, drawer, dan referensi membawa data-metric-key", () => {
    // Enam kartu hero, enam kartu operasional, tiga kotak keuangan, satu
    // grafik, baris drawer, baris referensi, dan footer pesanan selesai.
    const jumlah = (halaman.match(/data-metric-key=/g) ?? []).length
    expect(jumlah).toBeGreaterThanOrEqual(13)
  })
})
