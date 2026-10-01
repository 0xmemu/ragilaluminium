import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga kunci mode Urutkan (kontrak owner 2026-09-30): saat mode urut aktif,
 * seluruh kontrol di area halaman mati kecuali pegangan geser dan tombol
 * Urungkan/Simpan urutan. Kunci dipasang sekali di layout lewat kelas
 * `admin-reorder-lock`, dan halaman menyalakannya dengan prop `lockInteraction`.
 *
 * Penjaga ini membaca sumber, bukan DOM, karena yang mudah terlupa adalah
 * halaman baru yang memakai tombol Urutkan tanpa ikut menyalakan kuncinya.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

const layout = baca("resources/js/layouts/admin-layout.tsx")
const css = baca("resources/css/app.css")
const tombolUrut = baca("resources/js/components/admin/reorder-action-button.tsx")
const pegangan = baca("resources/js/components/admin/reorder-drag-handle.tsx")

/** Semua halaman admin yang memakai tombol Urutkan bersama. */
function halamanBerurut(): string[] {
  const dasar = join(akar, "resources/js/pages/Admin")
  const hasil: string[] = []

  const telusuri = (dir: string) => {
    for (const isi of readdirSync(dir, { withFileTypes: true })) {
      if (isi.name.endsWith(".bak-")) continue
      const penuh = join(dir, isi.name)
      if (isi.isDirectory()) {
        telusuri(penuh)
      } else if (isi.name.endsWith(".tsx")) {
        const teks = readFileSync(penuh, "utf8")
        if (teks.includes("<ReorderActionButton")) hasil.push(penuh)
      }
    }
  }

  telusuri(dasar)
  return hasil
}

describe("kunci mode Urutkan", () => {
  it("layout memasang kelas kunci dari prop lockInteraction", () => {
    expect(layout).toContain("lockInteraction")
    expect(layout).toContain('lockInteraction ? "admin-reorder-lock"')
  })

  it("css mematikan klik untuk kontrol halaman, bukan untuk pegangan dan tombol urut", () => {
    expect(css).toContain(".admin-reorder-lock")
    expect(css).toMatch(/\.admin-reorder-lock[^{]*\{[^}]*pointer-events:\s*none\s*!important/)
    expect(css).toMatch(/\[data-reorder-allow\][^{]*\{[^}]*pointer-events:\s*auto\s*!important/)
    expect(css).toMatch(/\[data-reorder-handle\][^{]*\{[^}]*pointer-events:\s*auto\s*!important/)
  })

  it("tombol Urutkan, Simpan urutan, dan Urungkan bertanda boleh tetap aktif", () => {
    // Komentar dokumen juga menyebut nama penanda ini, jadi baris komentar
    // dibuang lebih dulu supaya yang dihitung hanya atribut JSX.
    const pemisah = String.fromCharCode(10)
    const barisKode = tombolUrut
      .split(pemisah)
      .filter((baris) => {
        const bersih = baris.trim()
        return !bersih.startsWith("*") && !bersih.startsWith("//") && !bersih.startsWith("/*")
      })
      .join(pemisah)

    // Empat tombol bertanda: Urutkan, Simpan urutan, dan Urungkan dua keadaan
    // (mode aktif belum digeser, dan mode aktif sudah digeser).
    expect(barisKode.split("data-reorder-allow")).toHaveLength(5)
  })

  it("isian juga boleh ditandai agar tetap hidup saat mode urut", () => {
    // Penanda yang sama dipakai kotak cari halaman Paling Banyak Dipesan.
    // Tanpa isian di daftar selektor ini, penandanya tidak berpengaruh apa pun.
    const barisPengecualian = css
      .split(String.fromCharCode(10))
      .filter((baris) => baris.includes("[data-reorder-allow]"))
    expect(barisPengecualian.length).toBeGreaterThan(0)
    expect(barisPengecualian.some((baris) => baris.includes("input"))).toBe(true)
  })

  it("pegangan geser bertanda pegangan", () => {
    expect(pegangan).toContain("data-reorder-handle")
  })

  it("setiap halaman pemakai tombol Urutkan menyalakan kunci", () => {
    const halaman = halamanBerurut()
    expect(halaman.length).toBeGreaterThanOrEqual(9)

    const lupa = halaman
      .filter((berkas) => !readFileSync(berkas, "utf8").includes("lockInteraction={"))
      .map((berkas) => berkas.slice(akar.length))

    expect(lupa).toEqual([])
  })
})
