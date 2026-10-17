import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga kolom Nama Varian di form produk.
 *
 * Cacat nyata 17 Oktober 2026 (laporan owner): "saat di klik satu huruf
 * langsung menyimpan". Kolom nama varian terkunci bukan karena admin menekan
 * Enter atau tombol Selesai, melainkan karena isinya tidak kosong lagi.
 * Akibatnya ketukan pertama langsung mengganti baris ke tampilan baca saja,
 * huruf berikutnya tidak pernah masuk, dan kolom tampak tersimpan sendiri.
 *
 * Aturannya: kunci hanya menyala dari tindakan eksplisit (Enter / Selesai).
 *
 * Penjaga membaca SUMBER, bukan DOM, karena yang mudah terlupa adalah
 * mengembalikan pola "nama terisi berarti terkunci" saat form disunting lagi.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))
const baca = (rel: string) => readFileSync(join(akar, rel), "utf8")

describe("form produk: nama varian terkunci hanya lewat Enter atau Selesai", () => {
  const sumber = baca("resources/js/pages/Admin/ProductForm.tsx")

  it("status terkunci dibaca dari penanda eksplisit, bukan dari isi nama", () => {
    expect(sumber).toContain("const isLocked = def.locked === true")
  })

  it("tidak menyimpulkan kunci dari nama yang tidak kosong", () => {
    // Pola lama: def.locked !== false && Boolean(def.name && def.name.trim() !== "")
    expect(sumber).not.toMatch(/isLocked\s*=\s*def\.locked\s*!==\s*false/)
    expect(sumber).not.toMatch(/isLocked[^\n]*def\.name\.trim\(\)/)
  })

  it("Enter, tombol Selesai, dan tombol Edit tetap jadi satu-satunya pemicu", () => {
    // Enter dan Selesai menyetel locked true (dua tempat), Edit membukanya.
    const kunci = sumber.match(/locked:\s*true/g) ?? []
    const buka = sumber.match(/locked:\s*false/g) ?? []
    expect(kunci.length).toBeGreaterThanOrEqual(2)
    expect(buka.length).toBeGreaterThanOrEqual(1)

    // Enter tidak boleh meneruskan submit form induk.
    expect(sumber).toMatch(/event\.key === "Enter"[\s\S]{0,160}event\.preventDefault\(\)/)
  })
})
