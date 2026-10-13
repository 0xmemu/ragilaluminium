import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga kontrak MODE TERKUNCI halaman pengaturan (ADR-023, kontrak global
 * AGENTS.md).
 *
 * Aturannya: halaman atau bagian yang tugasnya MENGUBAH NILAI YANG SUDAH ADA
 * dibuka terkunci. Isian dan kotak centang `disabled`, yang tampil hanya tombol
 * Edit di kanan header; setelah Edit ditekan barulah isian bisa diubah. Kontrak
 * ini sudah ditegaskan owner berkali-kali (lihat tabel bukti di ADR-023) tetapi
 * selalu terulang karena tidak punya tempat tetap. Penjaga ini yang menutup
 * pengulangannya: halaman baru yang lupa terkunci gagal di sini.
 *
 *
 * Catatan 13 Oktober 2026: halaman Admin/Beranda/KontakForm.tsx sudah
 * DIARSIPKAN (tidak dirender rute mana pun) ke folder
 * _archive/halaman-yatim-20261013, jadi keluar dari daftar wajib ini.
 * Penjaga membaca SUMBER, bukan DOM, karena yang mudah terlupa adalah halaman
 * baru yang dibuat tanpa memikirkan kontrak ini.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

/** Halaman atau bagian pengaturan yang sudah menerapkan mode terkunci. */
const WAJIB_TERKUNCI = [
  "resources/js/pages/Admin/TentangKami/Edit.tsx",
  "resources/js/pages/Admin/StorefrontPlatforms/Edit.tsx",
  "resources/js/pages/Admin/CodSettings/Edit.tsx",
  "resources/js/pages/Admin/ShippingSubsidy/Edit.tsx",
  // Bagian "Slide bar promo": setelan di dalam halaman daftar Bar Promo.
  "resources/js/pages/Admin/Announcements/Index.tsx",
  // Halaman pengaturan murni yang wajib terkunci bawaan.
  "resources/js/pages/Admin/Profile/Edit.tsx",
  "resources/js/pages/Admin/WhatsApp/Edit.tsx",
  "resources/js/pages/Admin/Beranda/HowToOrderForm.tsx",
]

/**
 * Utang ADR-023: halaman pengaturan yang BELUM terkunci. Daftar ini harus
 * MENYUSUT. Begitu satu halaman diperbaiki, pindahkan berkasnya ke
 * WAJIB_TERKUNCI di atas, karena test ketiga menolak halaman utang yang
 * ternyata sudah terkunci.
 */
const UTANG: string[] = [
  // Kosong sejak 13 Oktober 2026: tujuh halaman utang sudah dipindahkan ke
  // WAJIB_TERKUNCI di atas. Isi lagi HANYA kalau ada halaman pengaturan baru
  // yang belum sempat dikunci, supaya utangnya terlihat dan tidak diam-diam.
]

/**
 * Ciri mode terkunci, sengaja longgar supaya tidak bergantung nama variabel:
 * ada state mode yang berdefault "view", ada jalur untuk masuk ke "edit", dan
 * ada penguncian nyata pada salah satu dari dua varian ADR-023:
 *
 * - Varian B (`p-5 sm:p-6`, setelan ringkas): form tetap dirender, kontrolnya
 *   dimatikan lewat atribut `disabled`.
 * - Varian A (form panjang): mode ringkasan merender tampilan bacaan, kontrol
 *   input-nya hanya ada di cabang `mode === "edit"`, jadi tidak perlu `disabled`.
 *
 * Keduanya sah. Yang dijamin penjaga ini adalah halaman tidak pernah membuka
 * form yang langsung bisa disunting.
 */
function terkunci(teks: string): boolean {
  const adaStateView = /useState<[^>\n]*>\(\s*"view"\s*\)/.test(teks)
  const adaJalurEdit = /set[A-Za-z]*Mode\(\s*"edit"\s*\)/.test(teks)
  const adaKunci = teks.includes("disabled=") || /mode === "view"/.test(teks)
  return adaStateView && adaJalurEdit && adaKunci
}

describe("kontrak mode terkunci halaman pengaturan", () => {
  it("kontraknya tercatat di AGENTS.md sebagai non-negotiable", () => {
    const agents = baca("AGENTS.md")
    expect(agents).toContain("MODE TERKUNCI HALAMAN PENGATURAN")
    expect(agents).toContain("ADR-023")
  })

  it("setiap halaman pengaturan yang sudah diperbaiki tetap terkunci", () => {
    for (const rel of WAJIB_TERKUNCI) {
      expect(existsSync(join(akar, rel)), `${rel} tidak ditemukan`).toBe(true)
      expect(terkunci(baca(rel)), `${rel} kehilangan mode terkunci (lihat ADR-023)`).toBe(true)
    }
  })

  it("daftar utang tetap jujur: halaman di dalamnya memang belum terkunci", () => {
    for (const rel of UTANG) {
      expect(existsSync(join(akar, rel)), `${rel} tidak ditemukan`).toBe(true)
      expect(
        terkunci(baca(rel)),
        `${rel} sudah terkunci, pindahkan berkasnya ke WAJIB_TERKUNCI di test ini`,
      ).toBe(false)
    }
  })

  it("daftar wajib dan daftar utang tidak tumpang tindih", () => {
    const tumpang = WAJIB_TERKUNCI.filter((rel) => UTANG.includes(rel))
    expect(tumpang).toEqual([])
  })
})
