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
 * Penjaga membaca sumber, bukan DOM, karena hal-hal ini keputusan tetap: satu
 * sumber label untuk badge dan tab, daftar event bertab yang sinkron antara klien
 * dan server, dan penerapan rentang tanggal yang eksplisit.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

function sumber(): string {
  return readFileSync(join(akar, "resources/js/pages/Admin/Media/History.tsx"), "utf8")
}

/** Daftar event yang punya tab menurut sisi klien (EVENT_TABS). */
function daftarEventKlien(): string[] {
  const baris = sumber()
    .split(String.fromCharCode(10))
    .find((b) => b.includes("const EVENT_TABS")) as string

  return (baris.match(/"([a-z_]+)"/g) ?? []).map((s) => s.replace(/"/g, ""))
}

/** Daftar event yang dianggap punya tab oleh server (HISTORY_EVENT_TABS). */
function daftarEventServer(): string[] {
  const teks = readFileSync(
    join(akar, "app/Http/Controllers/Admin/ProductMediaController.php"),
    "utf8",
  )
  const blok = teks.split("HISTORY_EVENT_TABS = [")[1]?.split("];")[0] ?? ""

  return (blok.match(/'([a-z_]+)'/g) ?? []).map((s) => s.replace(/'/g, ""))
}

describe("label status Riwayat Media", () => {
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

  it("empat jenis event punya tab", () => {
    expect(daftarEventKlien()).toEqual(["failed", "success", "processing", "queued"])
  })

  it("daftar event bertab sinkron antara klien dan server", () => {
    // Kalau salah satu sisi berubah tanpa yang lain, filter ?event=<x> dari sisi
    // yang tertinggal akan diabaikan server sementara tombolnya masih ditawarkan
    // klien, atau sebaliknya. Itu tepat masalah yang dulu terjadi pada ?event=dedup.
    expect(daftarEventKlien()).toEqual(daftarEventServer())
  })

  it("Terunduh dibuang seluruhnya, bukan hanya tabnya", () => {
    // "downloaded" adalah STATUS lampiran media, bukan event riwayat: tidak ada
    // kode yang pernah menuliskannya sebagai event. Karena itu labelnya pun tidak
    // disisakan, supaya tidak ada pemetaan yang tidak mungkin terpakai.
    //
    // Yang diperiksa adalah PEMETAAN-nya, bukan katanya: komentar di berkas itu
    // menjelaskan kenapa "downloaded" dibuang, dan penjelasan itu memang perlu ada.
    const teks = sumber()

    expect(teks).not.toContain('label: "Terunduh"')
    expect(teks).not.toMatch(/^s*downloaded:s*{/m)
    expect(daftarEventServer()).not.toContain("downloaded")
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

describe("filter periode Riwayat Media", () => {
  it("memakai pola yang sama dengan halaman daftar admin lain", () => {
    // Standar di halaman lain: SATU pilihan periode, dan rentang tanggal baru
    // muncul setelah "Rentang tanggal" dipilih. Halaman ini dulu menampilkan dua
    // kolom tanggal terus-menerus, sehingga baris kontrolnya berbeda dari halaman
    // lain dan terlihat seperti filter yang sedang berlaku padahal belum tentu.
    const teks = sumber()

    expect(teks).toContain('<option value="range">Rentang tanggal</option>')
    expect(teks).toContain('<option value="7d">7 hari terakhir</option>')
    expect(teks).toContain('<option value="all">Semua waktu</option>')
    expect(teks).toContain('import { Select } from "@/components/admin/ui/select"')
  })

  it("rentang tanggal hanya dirender saat periode rentang dipilih", () => {
    expect(sumber()).toContain('{activeDatePreset === "range" ? (')
  })

  it("diterapkan lewat tombol, bukan saat fokus berpindah", () => {
    const teks = sumber()

    expect(teks).not.toContain("onBlur={() => apply(")
    expect(teks).toContain("onSubmit={applyDateRange}")
    expect(teks).toContain("applyDateRange(event: React.FormEvent)")
  })

  it("memakai isian bersama, bukan input tanggal mentah", () => {
    // Input mentah tidak punya penanda bersama sehingga gayanya menyimpang dari
    // isian lain di panel admin.
    expect(sumber()).not.toMatch(/<input[^>]*type="date"/)
    expect(sumber()).toContain('import { Input } from "@/components/admin/ui/input"')
  })

  it("periode aktif ditandai chip beserta jalan melepasnya", () => {
    const teks = sumber()

    expect(teks).toContain("{periodLabel}")
    expect(teks).toContain('aria-label="Hapus filter periode"')
  })

  it("rentang tanggal tidak ikut ke URL saat periode bukan rentang", () => {
    // Kalau tanggal sisa pilihan lama ikut terbawa, daftar akan tersaring
    // tanpa terlihat di kontrol mana pun.
    expect(sumber()).toContain('merged.date_preset !== "range"')
  })
})
