import { describe, expect, it } from "vitest"

import {
  berkasMediaDiterima,
  berkasSistem,
  ekstensiBerkas,
  saringBerkasMedia,
} from "@/lib/media-upload-filter"

/**
 * Penjaga penyaring berkas Media Library (insiden 14 Oktober 2026).
 *
 * Owner memilih folder berisi 8 berkas lewat tombol "Unggah Folder", dan
 * `Thumbs.db` ikut muncul di daftar. Penyebabnya: pemilih folder peramban
 * (`webkitdirectory`) mengabaikan `accept`, jadi berkas sistem ikut terpilih.
 * Bila dibiarkan, server menolaknya dengan "tipe file tidak diizinkan" sehingga
 * admin hanya melihat kegagalan tanpa tahu berkas mana biangnya.
 */

const berkas = (name: string, type = "") => ({ name, type })

describe("penyaring berkas Media Library", () => {
  it("mengenali berkas sistem Windows dan macOS", () => {
    expect(berkasSistem("Thumbs.db")).toBe(true)
    expect(berkasSistem("thumbs.db")).toBe(true)
    expect(berkasSistem("THUMBS.DB")).toBe(true)
    expect(berkasSistem("desktop.ini")).toBe(true)
    expect(berkasSistem("Desktop.ini")).toBe(true)
    expect(berkasSistem(".DS_Store")).toBe(true)
    expect(berkasSistem("._Pilihan Kaca.jpg")).toBe(true)
    expect(berkasSistem("")).toBe(true)
    expect(berkasSistem("   ")).toBe(true)
  })

  it("tidak membuang berkas media yang sah", () => {
    expect(berkasSistem("1.png")).toBe(false)
    expect(berkasSistem("Pilihan Kaca.png")).toBe(false)
    expect(berkasSistem("JSW1D01 P Utama.jpg")).toBe(false)
    expect(berkasSistem("video-pemasangan.mp4")).toBe(false)
    // Nama yang memuat "desktop" tapi bukan berkas sistem tetap lolos.
    expect(berkasSistem("desktop-jendela.png")).toBe(false)
  })

  it("membaca ekstensi dengan benar", () => {
    expect(ekstensiBerkas("foto.PNG")).toBe("png")
    expect(ekstensiBerkas("arsip.tar.gz")).toBe("gz")
    expect(ekstensiBerkas("tanpa-ekstensi")).toBe("")
    expect(ekstensiBerkas("diakhiri-titik.")).toBe("")
  })

  it("menerima media berdasarkan jenis yang dilaporkan peramban", () => {
    expect(berkasMediaDiterima(berkas("foto.jpg", "image/jpeg"))).toBe(true)
    expect(berkasMediaDiterima(berkas("klip.mp4", "video/mp4"))).toBe(true)
    // Jenis yang jelas bukan media langsung ditolak.
    expect(berkasMediaDiterima(berkas("dokumen.pdf", "application/pdf"))).toBe(false)
    expect(berkasMediaDiterima(berkas("thumbs.db", "application/octet-stream"))).toBe(false)
  })

  it("memakai ekstensi saat peramban tidak melaporkan jenis", () => {
    // Windows kadang mengirim jenis kosong untuk berkas yang ekstensinya jelas.
    expect(berkasMediaDiterima(berkas("foto.JPG"))).toBe(true)
    expect(berkasMediaDiterima(berkas("foto.webp"))).toBe(true)
    expect(berkasMediaDiterima(berkas("klip.mov"))).toBe(true)
    // Ekstensi tak dikenal dan bukan media tetap ditolak.
    expect(berkasMediaDiterima(berkas("catatan.txt"))).toBe(false)
    expect(berkasMediaDiterima(berkas("skrip.php"))).toBe(false)
  })

  it("menyaring folder berisi berkas sistem seperti pada laporan owner", () => {
    // Persis isi tangkapan layar: 7 gambar ditambah Thumbs.db.
    const isiFolder = [
      berkas("1.png", "image/png"),
      berkas("2.png", "image/png"),
      berkas("3.png", "image/png"),
      berkas("4.png", "image/png"),
      berkas("5.png", "image/png"),
      berkas("6.png", "image/png"),
      berkas("Pilihan Kaca.png", "image/png"),
      berkas("Thumbs.db", "application/octet-stream"),
    ]

    const { diterima, dilewati } = saringBerkasMedia(isiFolder)

    expect(diterima.map((f) => f.name)).toEqual([
      "1.png",
      "2.png",
      "3.png",
      "4.png",
      "5.png",
      "6.png",
      "Pilihan Kaca.png",
    ])
    expect(dilewati.map((f) => f.name)).toEqual(["Thumbs.db"])
  })

  it("membuang berkas sistem walau jenisnya dilaporkan sebagai gambar", () => {
    // Sebagian peramban menebak jenis dari ekstensi; nama sistem tetap menang.
    const { diterima, dilewati } = saringBerkasMedia([
      berkas("Thumbs.db", "image/png"),
      berkas(".DS_Store", "image/png"),
      berkas("foto.png", "image/png"),
    ])

    expect(diterima.map((f) => f.name)).toEqual(["foto.png"])
    expect(dilewati.map((f) => f.name)).toEqual(["Thumbs.db", ".DS_Store"])
  })

  it("mengembalikan daftar kosong tanpa melempar error", () => {
    expect(saringBerkasMedia([])).toEqual({ diterima: [], dilewati: [] })
  })
})
