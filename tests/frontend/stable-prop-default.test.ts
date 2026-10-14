import { readdirSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Penjaga default prop yang TIDAK stabil (insiden 14 Oktober 2026).
 *
 * Latar: halaman Tambah Produk menampilkan layar "Terjadi gangguan sementara"
 * begitu admin menekan tombol apa pun. Akarnya bukan server, melainkan React
 * error "Too many re-renders": prop opsional diberi default array literal
 * (`installationMedia = []`) sehingga referensinya BARU setiap render, padahal
 * komponen membandingkan referensi itu saat render:
 *
 *     const [synced, setSynced] = React.useState(installationMedia)
 *     if (synced !== installationMedia) { setSynced(installationMedia); ... }
 *
 * Render pertama lolos (referensinya sama), lalu setiap perubahan state memicu
 * setState baru tanpa henti. Gejalanya menipu: halaman tampak normal sampai
 * disentuh, dan hanya halaman yang TIDAK mengirim prop itu dari server yang
 * kena (halaman create), sedangkan halaman edit aman karena referensinya stabil
 * dari props.
 *
 * Aturan yang ditegakkan: bila sebuah prop dibandingkan referensinya saat render
 * (pola `synced* !== <prop>`), prop itu TIDAK boleh punya default literal
 * (`[]`, `{}`) di daftar parameter. Default-nya harus konstanta tingkat modul.
 */

const akar = fileURLToPath(new URL("../../", import.meta.url))

/** Semua berkas .tsx di bawah resources/js. */
function kumpulkanTsx(dir: string, keluar: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const penuh = join(dir, nama)
    if (statSync(penuh).isDirectory()) {
      kumpulkanTsx(penuh, keluar)
    } else if (nama.endsWith(".tsx")) {
      keluar.push(penuh)
    }
  }
  return keluar
}

/**
 * Buang komentar agar penjaga hanya membaca KODE, bukan naskah penjelas.
 *
 * Tanpa ini, komentar yang menjelaskan pola terlarang (mis. contoh
 * `installationMedia = []` di dalam dokumentasi perbaikan) ikut tertangkap
 * sebagai pelanggaran, sehingga penjaganya menuduh berkas yang justru sudah
 * benar.
 */
function tanpaKomentar(sumber: string): string {
  return sumber
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
}

/**
 * Cari nama prop yang dibandingkan referensinya saat render.
 *
 * Pola yang dikenali: `if (<apa> !== <prop>)` atau `if (<prop> !== <apa>)`,
 * dengan nama pembanding berawalan `synced` (konvensi repo untuk menyalin props
 * ke state saat render).
 */
function propDibandingkanReferensi(sumber: string): string[] {
  const hasil = new Set<string>()
  const pola = /if\s*\(\s*(synced\w*)\s*!==\s*([A-Za-z_$][\w$]*)\s*\)/g
  let m: RegExpExecArray | null
  while ((m = pola.exec(sumber)) !== null) {
    hasil.add(m[2])
  }
  return [...hasil]
}

/** Apakah prop ini punya default literal di daftar parameter komponen. */
function punyaDefaultLiteral(sumber: string, prop: string): boolean {
  const lolos = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  // `prop = []` atau `prop = {}` (dengan spasi bebas) di dalam daftar parameter.
  const pola = new RegExp(`\\b${lolos}\\s*=\\s*(\\[\\s*\\]|\\{\\s*\\})`)
  return pola.test(sumber)
}

describe("default prop stabil (penjaga Too many re-renders)", () => {
  const berkas = kumpulkanTsx(join(akar, "resources/js"))

  it("tidak ada prop yang dibandingkan referensinya tapi berdefault array/objek literal", () => {
    const pelanggaran: string[] = []

    for (const penuh of berkas) {
      const sumber = tanpaKomentar(readFileSync(penuh, "utf8"))
      const relatif = penuh.replace(akar, "").replace(/\\/g, "/")

      for (const prop of propDibandingkanReferensi(sumber)) {
        if (punyaDefaultLiteral(sumber, prop)) {
          pelanggaran.push(`${relatif}: prop "${prop}" berdefault literal padahal dibandingkan referensinya`)
        }
      }
    }

    expect(
      pelanggaran,
      `Default literal membuat referensi baru tiap render sehingga memicu re-render tanpa henti.\n` +
        `Pindahkan default-nya ke konstanta tingkat modul, mis.\n` +
        `  const TANPA_X: Tipe[] = []\n` +
        `  export default function Komponen({ x = TANPA_X }) { ... }`,
    ).toEqual([])
  })

  it("penjaga benar-benar mengenali pola berbahaya (bukti test tidak kosong)", () => {
    const contoh = `
      const TANPA: Baris[] = []
      export default function Contoh({ daftar = [], aman = TANPA }: Props) {
        const [syncedDaftar, setSyncedDaftar] = React.useState(daftar)
        if (syncedDaftar !== daftar) { setSyncedDaftar(daftar) }
        const [syncedAman, setSyncedAman] = React.useState(aman)
        if (syncedAman !== aman) { setSyncedAman(aman) }
      }
    `
    const dibandingkan = propDibandingkanReferensi(contoh)
    expect(dibandingkan.sort()).toEqual(["aman", "daftar"])
    // `daftar` berdefault literal -> harus tertangkap; `aman` memakai konstanta -> aman.
    expect(punyaDefaultLiteral(contoh, "daftar")).toBe(true)
    expect(punyaDefaultLiteral(contoh, "aman")).toBe(false)
  })

  it("komentar yang menyebut pola terlarang tidak dihitung pelanggaran", () => {
    const contoh = `
      // Contoh salah: installationMedia = []
      /* Dan ini juga: items = {} */
      const TANPA: Baris[] = []
      export default function Contoh({ installationMedia = TANPA, items = TANPA }: Props) {
        const [syncedA, setA] = React.useState(installationMedia)
        if (syncedA !== installationMedia) { setA(installationMedia) }
        const [syncedB, setB] = React.useState(items)
        if (syncedB !== items) { setB(items) }
      }
    `
    const kode = tanpaKomentar(contoh)
    expect(punyaDefaultLiteral(kode, "installationMedia")).toBe(false)
    expect(punyaDefaultLiteral(kode, "items")).toBe(false)
    // Naskah aslinya memang memuat pola itu, jadi pembanding ini yang membuktikan
    // pembersihan komentar benar-benar bekerja.
    expect(punyaDefaultLiteral(contoh, "installationMedia")).toBe(true)
  })
})
