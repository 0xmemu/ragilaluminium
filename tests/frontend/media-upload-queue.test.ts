import { describe, expect, it } from "vitest"

import { adaUnggahanBerjalan, jalankanDenganSlot, type UploadItem } from "@/lib/media-upload-queue"

/**
 * Penjaga antrean unggah media (owner 2026-10-15).
 *
 * Latar masalahnya: unggahan dulu berjalan satu berkas pada satu waktu, padahal
 * satu koneksi hanya sanggup sekitar 0,6 MB/detik sementara kapasitas admin
 * sekitar 1,4 MB/detik. Pembatas slot menaikkan berkas yang naik bersamaan
 * tanpa melewati batas beban server.
 *
 * Yang dijaga di sini:
 * 1. Batas slot tidak pernah terlampaui, dihitung menurut BOBOT (video dua slot).
 * 2. Semua tugas tetap dikerjakan, urutannya mengikuti urutan pilihan admin.
 * 3. Antrean tidak bisa buntu saat bobot sebuah tugas sama dengan kapasitas.
 */

const SLOT_TOTAL = 4
const SLOT_VIDEO = 2

type Tugas = { nama: string; bobot: number }

function pekerjaanBerbobot(daftar: Tugas[], kapasitas: number, catat: {
  puncak: { nilai: number }
  urutanMulai: string[]
  urutanSelesai: string[]
}): Promise<void> {
  return jalankanDenganSlot(
    daftar,
    (t) => t.bobot,
    kapasitas,
    async (t) => {
      catat.urutanMulai.push(t.nama)
      await new Promise((r) => setTimeout(r, 5))
      catat.urutanSelesai.push(t.nama)
    },
  )
}

describe("jalankanDenganSlot", () => {
  it("tidak pernah melewati kapasitas slot", async () => {
    const daftar: Tugas[] = [
      { nama: "a", bobot: 1 },
      { nama: "b", bobot: 1 },
      { nama: "c", bobot: 1 },
      { nama: "d", bobot: 1 },
      { nama: "e", bobot: 1 },
      { nama: "f", bobot: 1 },
    ]
    let terpakai = 0
    const catat = { puncak: { nilai: 0 }, urutanMulai: [] as string[], urutanSelesai: [] as string[] }

    await jalankanDenganSlot(
      daftar,
      (t) => t.bobot,
      SLOT_TOTAL,
      async (t) => {
        terpakai += t.bobot
        catat.puncak.nilai = Math.max(catat.puncak.nilai, terpakai)
        catat.urutanMulai.push(t.nama)
        await new Promise((r) => setTimeout(r, 5))
        terpakai -= t.bobot
        catat.urutanSelesai.push(t.nama)
      },
    )

    expect(catat.puncak.nilai).toBeLessThanOrEqual(SLOT_TOTAL)
    expect(catat.puncak.nilai).toBe(SLOT_TOTAL)
    expect(catat.urutanSelesai).toHaveLength(daftar.length)
  })

  it("menghitung video sebagai dua slot", async () => {
    // Dua video (2 + 2) sudah memenuhi empat slot, jadi video ketiga harus
    // menunggu walau masih ada "ruang" menurut hitungan jumlah tugas.
    const daftar: Tugas[] = [
      { nama: "v1", bobot: SLOT_VIDEO },
      { nama: "v2", bobot: SLOT_VIDEO },
      { nama: "v3", bobot: SLOT_VIDEO },
    ]
    let terpakai = 0
    let puncak = 0

    await jalankanDenganSlot(
      daftar,
      (t) => t.bobot,
      SLOT_TOTAL,
      async (t) => {
        terpakai += t.bobot
        puncak = Math.max(puncak, terpakai)
        await new Promise((r) => setTimeout(r, 5))
        terpakai -= t.bobot
      },
    )

    expect(puncak).toBe(SLOT_TOTAL)
  })

  it("mengerjakan tugas mengikuti urutan pilihan admin", async () => {
    const daftar: Tugas[] = [
      { nama: "satu", bobot: 1 },
      { nama: "dua", bobot: 1 },
      { nama: "tiga", bobot: 1 },
      { nama: "empat", bobot: 1 },
      { nama: "lima", bobot: 1 },
    ]
    const catat = { puncak: { nilai: 0 }, urutanMulai: [] as string[], urutanSelesai: [] as string[] }

    await pekerjaanBerbobot(daftar, SLOT_TOTAL, catat)

    // Empat pertama langsung jalan, yang kelima menyusul setelah satu slot bebas.
    expect(catat.urutanMulai.slice(0, 4)).toEqual(["satu", "dua", "tiga", "empat"])
    expect(catat.urutanMulai[4]).toBe("lima")
  })

  it("tidak buntu saat bobot tugas sama dengan kapasitas", async () => {
    const daftar: Tugas[] = [
      { nama: "besar1", bobot: SLOT_TOTAL },
      { nama: "besar2", bobot: SLOT_TOTAL },
    ]
    const catat = { puncak: { nilai: 0 }, urutanMulai: [] as string[], urutanSelesai: [] as string[] }

    await pekerjaanBerbobot(daftar, SLOT_TOTAL, catat)

    expect(catat.urutanSelesai).toEqual(["besar1", "besar2"])
  })

  it("selesai walau daftarnya kosong", async () => {
    const catat = { puncak: { nilai: 0 }, urutanMulai: [] as string[], urutanSelesai: [] as string[] }

    await pekerjaanBerbobot([], SLOT_TOTAL, catat)

    expect(catat.urutanSelesai).toEqual([])
  })
})

describe("adaUnggahanBerjalan", () => {
  const item = (status: UploadItem["status"]): UploadItem => ({
    id: 1,
    name: "berkas.jpg",
    status,
    progress: 0,
  })

  it("menghitung memeriksa, mengantre, dan uploading sebagai berjalan", () => {
    expect(adaUnggahanBerjalan([item("memeriksa")])).toBe(true)
    expect(adaUnggahanBerjalan([item("mengantre")])).toBe(true)
    expect(adaUnggahanBerjalan([item("uploading")])).toBe(true)
  })

  it("tidak menganggap status akhir sebagai berjalan", () => {
    expect(adaUnggahanBerjalan([item("sukses"), item("gagal"), item("ditolak")])).toBe(false)
    expect(adaUnggahanBerjalan([])).toBe(false)
  })
})
