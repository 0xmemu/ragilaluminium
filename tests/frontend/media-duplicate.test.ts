import { describe, expect, it } from "vitest"

import {
  MAX_CHECKSUMS_PER_REQUEST,
  collectChecksums,
  duplicateExplanation,
  duplicateHeadline,
  fileChecksum,
  isValidChecksum,
  partitionByDuplicate,
  type MediaDuplicate,
} from "@/lib/media-duplicate"

/**
 * Pemeriksaan duplikat berkas sebelum unggah (kontrak owner 2026-10-08).
 *
 * Yang dijaga di sini adalah aturan yang menentukan berkas mana yang DITAHAN:
 * berkas yang sidik jarinya sudah ada di Media Library tidak dikirim, dan
 * berkas yang sidik jarinya gagal dihitung tidak boleh ikut tertahan.
 */

const SIDIK_HELLO = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"

function duplikat(id: number): MediaDuplicate {
  return {
    id,
    label: `aset-${id}.png`,
    kind: "image",
    status: "ready",
    usage_count: 0,
    thumb_url: null,
  }
}

describe("isValidChecksum", () => {
  it("menerima sidik jari SHA-256 heksadesimal huruf kecil", () => {
    expect(isValidChecksum(SIDIK_HELLO)).toBe(true)
  })

  it("menolak panjang yang tidak tepat", () => {
    expect(isValidChecksum(SIDIK_HELLO.slice(0, 63))).toBe(false)
    expect(isValidChecksum(`${SIDIK_HELLO}0`)).toBe(false)
    expect(isValidChecksum("")).toBe(false)
  })

  it("menolak huruf besar dan karakter di luar heksadesimal", () => {
    expect(isValidChecksum(SIDIK_HELLO.toUpperCase())).toBe(false)
    expect(isValidChecksum("z".repeat(64))).toBe(false)
  })

  it("menolak nilai yang bukan teks", () => {
    expect(isValidChecksum(null)).toBe(false)
    expect(isValidChecksum(undefined)).toBe(false)
    expect(isValidChecksum(12345)).toBe(false)
  })
})

describe("fileChecksum", () => {
  it("menghitung SHA-256 dari isi berkas", async () => {
    const berkas = new File(["hello"], "halo.png", { type: "image/png" })

    expect(await fileChecksum(berkas)).toBe(SIDIK_HELLO)
  })

  it("isi yang sama menghasilkan sidik jari yang sama walau nama berkas berbeda", async () => {
    const a = new File(["hello"], "satu.png", { type: "image/png" })
    const b = new File(["hello"], "dua.png", { type: "image/png" })

    expect(await fileChecksum(a)).toBe(await fileChecksum(b))
  })

  it("isi yang berbeda menghasilkan sidik jari yang berbeda", async () => {
    const a = new File(["hello"], "a.png", { type: "image/png" })
    const b = new File(["hello "], "b.png", { type: "image/png" })

    expect(await fileChecksum(a)).not.toBe(await fileChecksum(b))
  })
})

describe("partitionByDuplicate", () => {
  const entri = (id: number, checksum: string | null) => ({
    id,
    name: `berkas-${id}.png`,
    checksum,
  })

  it("menahan berkas yang sidik jarinya sudah ada", () => {
    const hasil = partitionByDuplicate([entri(1, SIDIK_HELLO)], { [SIDIK_HELLO]: duplikat(9) })

    expect(hasil.dup.map((e) => e.id)).toEqual([1])
    expect(hasil.rest).toEqual([])
  })

  it("meloloskan berkas yang sidik jarinya belum ada", () => {
    const hasil = partitionByDuplicate([entri(1, SIDIK_HELLO)], {})

    expect(hasil.dup).toEqual([])
    expect(hasil.rest.map((e) => e.id)).toEqual([1])
  })

  it("sidik jari yang gagal dihitung tidak pernah tertahan", () => {
    // null berarti pemeriksaan tidak bisa dijalankan, bukan berarti duplikat.
    // Menahannya karena itu akan memblokir unggahan yang sah.
    const hasil = partitionByDuplicate([entri(1, null)], { [SIDIK_HELLO]: duplikat(9) })

    expect(hasil.dup).toEqual([])
    expect(hasil.rest.map((e) => e.id)).toEqual([1])
  })

  it("memisahkan campuran berkas baru dan berkas lama", () => {
    const lain = "1".repeat(64)
    const hasil = partitionByDuplicate(
      [entri(1, SIDIK_HELLO), entri(2, lain), entri(3, null)],
      { [SIDIK_HELLO]: duplikat(9) },
    )

    expect(hasil.dup.map((e) => e.id)).toEqual([1])
    expect(hasil.rest.map((e) => e.id)).toEqual([2, 3])
  })
})

describe("collectChecksums", () => {
  it("membuang duplikat dan sidik jari yang tidak sah", () => {
    const hasil = collectChecksums([
      { id: 1, name: "a", checksum: SIDIK_HELLO },
      { id: 2, name: "b", checksum: SIDIK_HELLO },
      { id: 3, name: "c", checksum: null },
      { id: 4, name: "d", checksum: "bukan-sidik-jari" },
    ])

    expect(hasil).toEqual([SIDIK_HELLO])
  })

  it("hasilnya kosong bila tidak ada sidik jari yang sah", () => {
    expect(collectChecksums([{ id: 1, name: "a", checksum: null }])).toEqual([])
  })
})

describe("salinan peringatan", () => {
  it("tunggal dan jamak dibedakan", () => {
    expect(duplicateHeadline(1)).toContain("Berkas ini")
    expect(duplicateHeadline(3)).toContain("3 berkas")
  })

  it("penjelasannya menyebut akibat mengunggah ulang", () => {
    expect(duplicateExplanation(1)).toContain("tidak menambah apa pun")
    expect(duplicateExplanation(3)).toContain("tidak menambah apa pun")
  })

  it("batas sidik jari per permintaan selaras dengan validasi server", () => {
    expect(MAX_CHECKSUMS_PER_REQUEST).toBe(50)
  })
})
