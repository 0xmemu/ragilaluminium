import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga popover agar tidak terpotong wadah ber-overflow.
 *
 * Aturan yang dijaga (kontrak owner 2026-10-16): setiap elemen melayang
 * (petunjuk saat kursor diarahkan dan menu tarik-turun) WAJIB dirender lewat
 * portal ke document.body dan memakai batas aman layar, supaya tidak ada teks
 * yang teriris tepian card (overflow-hidden) atau tabel bergeser
 * (overflow-x-auto).
 *
 * Bahayanya bukan kerusakan hari ini, melainkan pengulangan pola lama saat
 * seseorang menyunting tampilan: menaruh kotak hint kembali sebagai elemen
 * berposisi absolut di dalam kartu. Penjaga ini membaca sumber, bukan DOM,
 * karena yang paling mudah terulang adalah bentuk kode seperti itu.
 */

const root = fileURLToPath(new URL("../../", import.meta.url))
const baca = (relatif: string) => readFileSync(join(root, relatif), "utf8")

const popoverWajibPortal = [
  ["Petunjuk kursor", "resources/js/components/admin/ui/hint-tip.tsx"],
  ["Menu tarik-turun admin", "resources/js/components/admin/ui/dropdown-menu.tsx"],
  ["Menu tarik-turun bersama", "resources/js/components/ui/dropdown-menu.tsx"],
  ["Kotak pilihan admin", "resources/js/components/admin/ui/select.tsx"],
  ["Kotak pilihan bercari", "resources/js/components/admin/ui/search-select.tsx"],
  ["Menu pilihan beranda", "resources/js/components/admin/option-menu.tsx"],
  ["Pemilih media", "resources/js/components/admin/media-picker.tsx"],
] as const

describe("popover tidak terpotong wadah", () => {
  it.each(popoverWajibPortal)("%s dirender lewat portal", (_nama, relatif) => {
    const isi = baca(relatif)
    const lewatPortal = isi.includes("createPortal") || isi.includes("Primitive.Portal")
    expect(lewatPortal, relatif + " harus merender lapisannya lewat portal").toBe(true)
  })

  it.each(popoverWajibPortal.filter(([, r]) => r.includes("dropdown-menu")) as ReadonlyArray<
    readonly [string, string]
  >)("%s punya batas aman layar dan batas tinggi adaptif", (_nama, relatif) => {
    const isi = baca(relatif)
    expect(isi).toContain("collisionPadding")
    expect(isi).toContain("avoidCollisions")
    expect(isi).toContain("--radix-dropdown-menu-content-available-height")
  })

  it.each([
    ["Petunjuk kursor", "resources/js/components/admin/ui/hint-tip.tsx"],
    ["Tooltip admin", "resources/js/components/admin/ui/tooltip.tsx"],
    ["Tooltip bersama", "resources/js/components/ui/tooltip.tsx"],
  ] as const)("%s memakai batas aman layar dan gaya popover yang sama", (_nama, relatif) => {
    const isi = baca(relatif)
    expect(isi).toContain("collisionPadding")
    expect(isi).toContain("avoidCollisions")
    // Satu bahasa desain: permukaan popover, bukan lagi latar primary pekat.
    expect(isi).toContain("bg-popover")
  })

  it("petunjuk kursor tidak lagi memakai kotak absolut di dalam kartu", () => {
    const isi = baca("resources/js/components/admin/ui/hint-tip.tsx")
    expect(isi).not.toContain('className="relative inline-block"')
    expect(isi).not.toContain('"absolute z-50 block w-max')
  })
})
