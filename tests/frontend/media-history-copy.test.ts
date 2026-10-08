import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga salinan dan penerapan filter halaman Riwayat Media.
 *
 * Dibuat setelah pemeriksaan 7 Okt 2026 menemukan dua hal: label tab unduhan
 * ditulis "Terunduk" padahal badge status di tabel yang sama menulis "Terunduh",
 * dan filter tanggal dikirim saat fokus berpindah sehingga muat ulang terpicu di
 * tengah pengisian tanpa penanda kapan filternya berlaku.
 *
 * Penjaga membaca sumber, bukan DOM, karena dua hal ini keputusan tetap: satu
 * sumber label untuk badge dan tab, dan penerapan rentang tanggal yang eksplisit.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

function sumber(): string {
  return readFileSync(join(akar, "resources/js/pages/Admin/Media/History.tsx"), "utf8")
}

describe("label status Riwayat Media", () => {
  it("unduhan dieja Terunduh, tidak ada ejaan Terunduk", () => {
    expect(sumber()).toContain('label: "Terunduh"')
    expect(sumber()).not.toContain("Terunduk")
  })

  it("tab filter membaca label dari EVENT_META, bukan daftar terpisah", () => {
    expect(sumber()).toContain("...EVENT_TABS.map((key) => ({ key, label: EVENT_META[key].label }))")
    expect(sumber()).toContain("const EVENT_TABS = [")
  })

  it("urutan tab menaruh Gagal lebih dulu karena itu yang perlu ditindak", () => {
    const baris = sumber()
      .split(String.fromCharCode(10))
      .find((b) => b.includes("const EVENT_TABS"))

    expect(baris).toBeDefined()
    expect(baris).toContain('"failed", "success"')
  })

  it("lima jenis event punya tab", () => {
    const baris = sumber()
      .split(String.fromCharCode(10))
      .find((b) => b.includes("const EVENT_TABS")) as string

    for (const event of ["failed", "success", "processing", "queued", "downloaded"]) {
      expect(baris).toContain(`"${event}"`)
    }
  })

  it("Duplikat tidak lagi punya tab, tetapi labelnya tetap terpetakan", () => {
    // Keputusan owner 2026-10-08: penjagaan berkas kembar sudah berjalan di
    // halaman Media Library sebelum berkas dikirim, jadi tidak perlu tab.
    // Labelnya WAJIB tetap ada supaya baris dedup lama atau baris yang lolos
    // lewat jalur server tetap tampil sebagai Duplikat, bukan mentah.
    const teks = sumber()
    const barisTab = teks
      .split(String.fromCharCode(10))
      .find((b) => b.includes("const EVENT_TABS")) as string

    expect(barisTab).not.toContain("dedup")
    expect(teks).toContain('dedup: { label: "Duplikat"')
  })
})

describe("filter tanggal Riwayat Media", () => {
  it("diterapkan lewat tombol, bukan saat fokus berpindah", () => {
    const teks = sumber()

    expect(teks).not.toContain("onBlur={() => apply(")
    expect(teks).toContain('<Button type="submit" variant="secondary" size="sm">')
  })

  it("memakai isian bersama, bukan input tanggal mentah", () => {
    // Input mentah tidak punya penanda bersama sehingga gayanya menyimpang dari
    // isian lain di panel admin.
    expect(sumber()).not.toMatch(/<input[^>]*type="date"/)
    expect(sumber()).toContain('import { Input } from "@/components/admin/ui/input"')
  })
})
