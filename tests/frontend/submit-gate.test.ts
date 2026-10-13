import { describe, expect, it, vi } from "vitest"

import { hitungGerbang, jagaKiriman, kosong, nilaiJalur } from "@/lib/submit-gate"

/**
 * Uji PERILAKU gerbang isi tombol simpan, bukan jumlah pemakaiannya.
 *
 * Yang diuji: keputusan yang diambil gerbang untuk masukan tertentu, dan apakah
 * kiriman benar-benar ditahan saat terkunci. Perilaku itu yang menentukan apakah
 * admin bisa menekan tombol yang pasti ditolak server.
 */

const form = (data: Record<string, unknown>, isDirty = false, processing = false) => ({
  processing,
  isDirty,
  data,
})

describe("kosong", () => {
  it("menganggap teks kosong dan spasi saja sebagai kosong", () => {
    expect(kosong("")).toBe(true)
    expect(kosong("   ")).toBe(true)
    expect(kosong(null)).toBe(true)
    expect(kosong(undefined)).toBe(true)
    expect(kosong([])).toBe(true)
  })

  it("TIDAK menganggap nol dan false sebagai kosong", () => {
    // Server menerima keduanya sebagai nilai, jadi mengunci tombolnya akan
    // menahan simpan yang sebenarnya sah.
    expect(kosong(0)).toBe(false)
    expect(kosong(false)).toBe(false)
    expect(kosong("0")).toBe(false)
    expect(kosong(["a"])).toBe(false)
  })
})

describe("nilaiJalur", () => {
  it("membaca jalur bertitik dan indeks daftar", () => {
    const data = { name: "Kusen", steps: [{ title: "Pertama" }] }
    expect(nilaiJalur(data, "name")).toBe("Kusen")
    expect(nilaiJalur(data, "steps.0.title")).toBe("Pertama")
    expect(nilaiJalur(data, "steps.9.title")).toBeUndefined()
    expect(nilaiJalur(data, "tidak.ada")).toBeUndefined()
  })
})

describe("hitungGerbang", () => {
  it("mengunci dan menyebut kolom yang masih kosong", () => {
    const hasil = hitungGerbang({ form: form({ name: "" }), fields: { name: "Nama Kategori" } })
    expect(hasil.terkunci).toBe(true)
    expect(hasil.kolomKosong).toEqual(["name"])
    expect(hasil.alasan).toContain("Nama Kategori")
  })

  it("membuka kunci begitu kolom wajib terisi", () => {
    const hasil = hitungGerbang({ form: form({ name: "Kusen" }), fields: { name: "Nama Kategori" } })
    expect(hasil.terkunci).toBe(false)
    expect(hasil.alasan).toBeUndefined()
  })

  it("menerima daftar nama saja tanpa label", () => {
    const hasil = hitungGerbang({ form: form({ code: "" }), fields: ["code"] })
    expect(hasil.terkunci).toBe(true)
    expect(hasil.alasan).toContain("code")
  })

  it("form edit tanpa perubahan tetap terkunci walau kolomnya terisi", () => {
    const hasil = hitungGerbang({
      form: form({ name: "Kusen" }, false),
      fields: { name: "Nama" },
      requireChange: true,
    })
    expect(hasil.terkunci).toBe(true)
    expect(hasil.alasan).toContain("Belum ada perubahan")
  })

  it("form edit yang sudah diubah membuka kunci", () => {
    const hasil = hitungGerbang({
      form: form({ name: "Kusen" }, true),
      fields: { name: "Nama" },
      requireChange: true,
    })
    expect(hasil.terkunci).toBe(false)
  })

  it("TIDAK mengunci hanya karena ada error server", () => {
    // Penolakan yang bukan soal kolom kosong (mis. nama sudah dipakai) harus
    // tetap bisa dicoba ulang supaya pesannya terbaca dan bisa diperbaiki.
    const hasil = hitungGerbang({
      form: { ...form({ name: "Kusen" }), errors: { name: "Nama sudah dipakai." } } as ReturnType<
        typeof form
      >,
      fields: { name: "Nama" },
    })
    expect(hasil.terkunci).toBe(false)
  })
})

describe("jagaKiriman", () => {
  it("menahan kiriman saat terkunci dan tidak memanggil handler", () => {
    const handler = vi.fn()
    const event = { preventDefault: vi.fn() }

    jagaKiriman(true, handler)(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(handler).not.toHaveBeenCalled()
  })

  it("meneruskan kiriman saat tidak terkunci", () => {
    const handler = vi.fn()
    const event = { preventDefault: vi.fn() }

    jagaKiriman(false, handler)(event)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
