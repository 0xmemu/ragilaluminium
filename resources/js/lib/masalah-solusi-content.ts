import { whatsappUrl } from "@/lib/format"

/**
 * Aturan isi teks tiap item Masalah & Solusi di halaman publik.
 *
 * Kontrak owner 2026-10-01, dua bagian sekaligus:
 *
 * 1. Teks solusi SELALU tampil, termasuk saat item juga memakai daftar opsi
 *    solusi. Sebelumnya keduanya saling meniadakan: begitu centang "Gunakan
 *    daftar opsi solusi" aktif, "Teks solusi" hilang di halaman publik padahal
 *    tersimpan di database dan tampil di kolom Solusi pada daftar admin.
 *
 * 2. Nomor WhatsApp yang ditulis di keterangan opsi menjadi tautan bergaya
 *    tombol CTA. Nomor yang tercetak tanpa tautan membuat pelanggan menyalin
 *    manual, dan pada item yang nomornya berbeda dari nomor konsultasi toko,
 *    tautan "WhatsApp" yang tersedia justru menuju nomor lain.
 */

/** Satu potongan keterangan opsi: teks biasa atau nomor WhatsApp bertautan. */
export type MasalahSolusiOptionSegment =
  | { kind: "text"; text: string }
  | { kind: "phone"; display: string; href: string }

/**
 * Calon nomor: awalan 0 (lokal) atau 62 (internasional), diikuti deretan digit
 * yang boleh bersisip spasi, titik, tanda hubung, atau tanda kurung.
 *
 * Polanya berakhir pada digit supaya pemisah di ujung seperti "0857... (WA)"
 * tidak ikut terbawa menjadi bagian nomor.
 */
const CALON_NOMOR = /(?:\+?62|0)[\d\s().-]{0,18}\d/g

/**
 * Normalkan calon nomor menjadi format internasional tanpa tanda plus.
 * Mengembalikan null bila bukan nomor SELULER Indonesia.
 *
 * Sengaja hanya seluler, yaitu awalan 8 setelah 0 atau 62, karena tautannya
 * menuju WhatsApp. Nomor rumah atau kantor (021, 0271, dan sejenisnya) tidak
 * akan salah dibuahkan tautan.
 */
export function normalizeWhatsappNumber(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  const lokal = digits.startsWith("62") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : null

  if (lokal === null) return null
  if (!/^8\d{7,11}$/.test(lokal)) return null

  return `62${lokal}`
}

/**
 * Apakah bagian contoh punya isi sama sekali: ada media, atau ada teks
 * pengganti. Dipakai memutuskan judul bagian contoh perlu dirender atau tidak,
 * karena judul itu punya nilai bawaan di form admin sehingga bisa muncul
 * menggantung tanpa apa pun di bawahnya.
 */
export function hasExampleContent(content?: {
  media?: unknown[] | null
  examples_hint?: string | null
}): boolean {
  const adaMedia = Array.isArray(content?.media) && content.media.length > 0
  const adaPengganti = (content?.examples_hint ?? "").trim() !== ""

  return adaMedia || adaPengganti
}

/**
 * Pecah keterangan opsi menjadi potongan teks dan nomor WhatsApp.
 *
 * Satu keterangan bisa berisi keduanya, misalnya "Hubungi 0812... untuk klaim",
 * sehingga penggantinya berupa daftar potongan, bukan satu nilai. Kalau tidak
 * ada nomor sama sekali, hasilnya satu potongan teks apa adanya.
 */
export function splitOptionDescription(description: string): MasalahSolusiOptionSegment[] {
  const teks = (description ?? "").trim()
  if (teks === "") return []

  const pola = new RegExp(CALON_NOMOR.source, "g")
  const potongan: MasalahSolusiOptionSegment[] = []
  let posisi = 0

  for (const cocok of teks.matchAll(pola)) {
    const tampil = cocok[0].trim()
    const nomor = normalizeWhatsappNumber(tampil)
    if (nomor === null) continue

    const href = whatsappUrl(nomor)
    if (href === null) continue

    const sebelum = teks.slice(posisi, cocok.index ?? 0).trim()
    if (sebelum !== "") potongan.push({ kind: "text", text: sebelum })

    potongan.push({ kind: "phone", display: tampil, href })
    posisi = (cocok.index ?? 0) + cocok[0].length
  }

  const sesudah = teks.slice(posisi).trim()
  if (sesudah !== "") potongan.push({ kind: "text", text: sesudah })

  return potongan
}
