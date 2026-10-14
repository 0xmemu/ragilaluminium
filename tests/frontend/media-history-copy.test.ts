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

  it("urutan tab menaruh Berhasil lebih dulu", () => {
    // Keputusan owner 11 Okt 2026: hasil yang berhasil ditampilkan lebih dulu,
    // kegagalan menyusul. Angka tab Gagal tetap diberi penekanan saat isinya di
    // atas nol, jadi kegagalan tidak menjadi kurang terlihat hanya karena
    // urutannya di belakang.
    const baris = sumber()
      .split(String.fromCharCode(10))
      .find((b) => b.includes("const EVENT_TABS"))

    expect(baris).toBeDefined()
    expect(baris).toContain('"success", "failed"')
  })

  it("setiap jenis event yang masih ditulis aplikasi punya tab", () => {
    // Owner 14 Okt 2026: angka tab harus selalu bisa ditutup, dan itu hanya mungkin
    // kalau setiap jenis event punya tabnya sendiri. Sebelumnya hanya success dan
    // failed yang bertab, sehingga pada data nyata tab Semua menunjukkan 324
    // sementara Berhasil 156 dan Gagal 0, dan sisa 168 itu terbaca seperti kegagalan
    // yang tidak tercatat padahal isinya 162 baris Diproses dan 6 baris Duplikat.
    //
    // dedup DIBUANG dari daftar ini di hari yang sama, karena penggabungan otomatis
    // berkas kembar di server dihapus sehingga kejadian itu tidak pernah ditulis lagi.
    expect(daftarEventKlien()).toEqual(["success", "failed", "processing", "queued"])
  })

  it("kejadian berhasil dilabeli Berhasil, bukan Siap", () => {
    // "Siap" menjawab pertanyaan lain (keadaan barang) dan kata itu sudah dipakai
    // Media Library untuk keadaan aset. Pasangan seimbang untuk "Gagal" adalah
    // "Berhasil", dan kosakata bersama di lib/status.ts juga tidak memakai "Siap"
    // untuk kunci success.
    const teks = sumber()

    expect(teks).toContain('success: { label: "Berhasil"')
    expect(teks).not.toContain('success: { label: "Siap"')
  })

  it("deskripsi halaman menyebut jenis hasil yang benar-benar punya tab", () => {
    // Deskripsi pernah berbunyi "Antre, Diproses, lalu Siap atau Gagal" saat tab
    // Antre dan Diproses belum ada, sehingga pembaca mencari tab yang tidak pernah
    // ada. Sekarang keempat jenis hasil punya tab, jadi deskripsinya menyebut
    // keempatnya, dan tetap tidak memakai kata "Siap" (lihat alasannya di test
    // label di atas).
    const deskripsi = sumber()
      .split(String.fromCharCode(10))
      .find((b) => b.includes("description=\"Audit pemrosesan media"))

    expect(deskripsi).toBeDefined()
    expect(deskripsi).toContain("Berhasil")
    expect(deskripsi).toContain("Gagal")
    expect(deskripsi).toContain("Diproses")
    expect(deskripsi).not.toContain("Siap")
  })

  it("Antre dan Diproses tidak punya tab tetapi labelnya tetap terpetakan", () => {
    // Barisnya masih ditulis oleh job dan masih muncul di tab Semua, jadi label
    // dan nadanya wajib tetap ada supaya tidak tampil mentah.
    const teks = sumber()

    expect(teks).toContain('queued: { label: "Antre"')
    expect(teks).toContain('processing: { label: "Diproses"')
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

  it("Duplikat tidak punya tab, tetapi labelnya tetap terpetakan", () => {
    // Tab Duplikat ada sebentar lalu dibuang 14 Okt 2026, karena penggabungan
    // otomatis berkas kembar di server dihapus: kejadian dedup tidak pernah ditulis
    // lagi. Baris dedup LAMA tetap muncul di tab Semua, jadi label dan nadanya wajib
    // tetap terpetakan supaya baris itu tidak tampil mentah.
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

describe("tautan media dan catatan tujuan penggabungan", () => {
  it("label media menjadi tautan ke medianya bila media_href ada", () => {
    const teks = sumber()

    expect(teks).toContain("row.media_href ? (")
    expect(teks).toContain("<Link")
    expect(teks).toContain("href={row.media_href}")
  })

  it("penggabungan duplikat menampilkan aset tujuan lewat MergedIntoNote", () => {
    const teks = sumber()

    expect(teks).toContain("function MergedIntoNote(")
    expect(teks).toContain("Digabungkan ke")
    expect(teks).toContain("<MergedIntoNote merged={row.merged_into} />")
  })
})

describe("metrik media di tabel Riwayat Media", () => {
  it("menampilkan thumbnail media dari thumb_url", () => {
    // Tanpa thumbnail, admin harus membuka tiap baris ke Media Library hanya
    // untuk tahu gambar apa yang diproses.
    const teks = sumber()

    expect(teks).toContain("row.thumb_url ? (")
    expect(teks).toContain("<img src={row.thumb_url}")
  })

  it("menampilkan dimensi dan ukuran berkas dari data server", () => {
    // Ukuran dan dimensi adalah inti audit pemrosesan: membuktikan hasil
    // konversi WebP wajar, bukan berkas besar yang gagal dikompresi.
    const teks = sumber()

    expect(teks).toContain("{row.dimensions ?")
    expect(teks).toContain("formatBytes(row.size_bytes)")
  })

  it("memakai formatBytes dari lib/format, bukan hitungan sendiri", () => {
    // Satu formatter bersama supaya satuan tidak berbeda antar halaman.
    expect(sumber()).toContain('import { formatBytes } from "@/lib/format"')
  })

  it("menampilkan kolom No dengan nomor menerus antar halaman", () => {
    // Nomor harus melanjutkan dari halaman sebelumnya, bukan ulang dari 1.
    const teks = sumber()

    expect(teks).toContain(">No</th>")
    expect(teks).toContain("pagination.current_page - 1")
  })
})

describe("angka jumlah di tab Riwayat Media", () => {
  it("tab menampilkan jumlah kejadian dari tabCounts", () => {
    const teks = sumber()

    expect(teks).toContain("tabCounts?: Record<string, number>")
    expect(teks).toContain("tabCounts?.[tab.key]")
  })

  it("tab Gagal menonjol saat jumlahnya di atas nol", () => {
    // Kegagalan itu yang menuntut tindakan, jadi angkanya tidak boleh sama rata
    // dengan tab lain yang angkanya hanya informasi.
    const teks = sumber()

    expect(teks).toContain('tab.key === "failed" && count > 0')
  })
})

describe("urutan daftar Riwayat Media", () => {
  it("memakai pola yang sama dengan halaman Log Aktivitas", () => {
    // Standar halaman lain: SATU pilihan urutan di toolbar, nilai `newest` dan
    // `oldest`, dan server mengabaikan nilai asing dengan kembali ke bawaan
    // (bukan menolak dengan galat) supaya tautan lama tidak memantul.
    const teks = sumber()

    expect(teks).toContain('import { Select } from "@/components/admin/ui/select"')
    expect(teks).toContain("sort={")
    expect(teks).toContain('aria-label="Urutkan riwayat media"')
    expect(teks).toContain("{ value: \"newest\", label: \"Terbaru\" }")
    expect(teks).toContain("{ value: \"oldest\", label: \"Terlama\" }")
  })

  it("urutan ikut terbawa saat filter lain diubah", () => {
    // Kalau urutan tidak ikut dikirim, mengganti tab atau periode akan diam-diam
    // mengembalikan daftar ke urutan bawaan tanpa terlihat di kontrol mana pun.
    expect(sumber()).toContain("sort: filters.sort,")
  })

  it("kontrol urutan punya bawaan supaya tetap utuh bila server tidak mengirim", () => {
    expect(sumber()).toContain("const URUTAN_BAWAH")
    expect(sumber()).toContain("sortOptions = URUTAN_BAWAH")
  })
})

describe("penyegaran status baris tunggu", () => {
  it("hanya kegagalan yang menulis ulang tampilan baris", () => {
    // Sebelum 14 Okt 2026, setiap baris milik aset yang sudah siap diubah menjadi
    // "Berhasil", termasuk baris "Diproses". Akibatnya satu aset tampil dua baris
    // kembar berlabel sama, dan tab Diproses berisi baris berlabel Berhasil.
    // Sekarang hanya status failed yang boleh menulis ulang.
    const teks = sumber()

    expect(teks).toContain('if (info.status === "failed") {')
    expect(teks).not.toContain(`event: "success"`)
  })

  it("penyegaran berhenti setelah seluruh entitas tunggu diketahui hasilnya", () => {
    // Baris "Diproses" dan "Antre" tidak pernah berubah statusnya di database,
    // jadi tanpa penanda ini badge Live dan polling tidak akan pernah berhenti.
    const teks = sumber()

    expect(teks).toContain("const [settledEntities, setSettledEntities]")
    expect(teks).toContain("settledEntities[`${r.loggable_type}:${r.loggable_id}`]")
    expect(teks).toContain("pending.every((r) => settledEntities[")
  })
})

describe("baris dengan media yang sudah dihapus", () => {
  it("diberi keterangan apa adanya, bukan dibiarkan tampak biasa", () => {
    // Tanpa keterangan, barisnya tampak seperti media biasa yang kebetulan tanpa
    // pratinjau: thumbnail kosong dan tautan mati tanpa penjelasan. Barisnya sendiri
    // tidak dihapus karena tabel ini jejak audit.
    const teks = sumber()

    expect(teks).toContain("media_missing?: boolean")
    expect(teks).toContain("function MediaMissingNote()")
    expect(teks).toContain("Media sudah dihapus")
  })

  it("ditampilkan di tabel desktop maupun kartu mobile", () => {
    // Dua markup terpisah untuk hal yang sama gampang berbeda saat salah satunya
    // disunting, jadi keduanya diperiksa.
    const jumlah = sumber().split("<MediaMissingNote />").length - 1

    expect(jumlah).toBe(2)
  })
})
