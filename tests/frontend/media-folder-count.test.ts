import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga angka folder di Media Library dan pemilih media.
 *
 * Aturan yang dijaga (temuan owner 2026-10-15): satu folder bermakna folder itu
 * plus seluruh subfolder di bawahnya. Angka itu dihitung SEKALI di server
 * (MediaFolder::deepAssetCounts) dan dikirim apa adanya.
 *
 * Bahayanya bukan angka yang salah pada awalnya, melainkan penjumlahan ulang di
 * peramban. Sebelum ini, kedua berkas klien menghitung sendiri total subtree
 * (field `assets_total` = angka folder + angka anak-anaknya). Begitu server ikut
 * mengirim angka yang sudah memuat subfolder, penjumlahan itu menghitung isi
 * subfolder dua kali: folder induk yang isinya 66 tampil 72.
 *
 * Penjaga ini membaca sumber, bukan DOM, karena yang mudah terulang adalah
 * seseorang menambahkan kembali penjumlahan di klien saat menyunting tampilan.
 */

const root = fileURLToPath(new URL("../../", import.meta.url))
const berkasKlien = [
  ["Media Library", "resources/js/pages/Admin/Media/Library.tsx"],
  ["Pemilih media", "resources/js/components/admin/media-picker.tsx"],
] as const

describe("angka folder Media Library", () => {
  it.each(berkasKlien)("%s memakai angka dari server tanpa menjumlah ulang", (_nama, relatif) => {
    const isi = readFileSync(join(root, relatif), "utf8")

    expect(isi).not.toContain("assets_total")
    expect(isi).not.toMatch(/subtreeTotal/)
  })
})
