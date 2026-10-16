// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { authorizerKanal } from "@/lib/admin-live-connection"

/**
 * Penjaga bentuk permintaan otorisasi kanal (17 Okt 2026).
 *
 * Kejadian produksi: otorisasi kanal SELALU 403 di peramban admin, padahal sesi
 * sah. Buktinya, pada detik yang sama halaman /admin dijawab 200 tetapi
 * /broadcasting/auth dijawab 403 dengan pesan KOSONG. Akibatnya langganan kanal
 * privat gagal dan panel menampilkan "Pembaruan langsung terputus".
 *
 * Penyebabnya DIPEROLEH ULANG di produksi: bila isi permintaan berbentuk JSON
 * tetapi header menyatakan form-urlencoded, server tidak menemukan nama kanal dan
 * menjawab 403. Uji pembanding dengan sesi admin sah:
 *   body form + header form  -> 200
 *   body JSON + header form  -> 403 pesan kosong  (bentuk bawaan yang gagal)
 *   body JSON + header JSON  -> 200
 *
 * Karena itu bentuk permintaannya ditentukan sendiri. Penjaga ini mengunci
 * kecocokan header dengan isi, plus cookie dan token CSRF yang wajib ikut.
 */
describe("bentuk permintaan otorisasi kanal", () => {
  const asliFetch = globalThis.fetch

  beforeEach(() => {
    const meta = document.createElement("meta")
    meta.setAttribute("name", "csrf-token")
    meta.setAttribute("content", "token-uji-123")
    document.head.appendChild(meta)
  })

  afterEach(() => {
    document.head.querySelectorAll('meta[name="csrf-token"]').forEach((m) => m.remove())
    globalThis.fetch = asliFetch
    vi.restoreAllMocks()
  })

  it("mengirim JSON dengan header JSON, bukan campur aduk", async () => {
    let ditangkap: { url: string; init: RequestInit } | null = null

    globalThis.fetch = (async (url: string, init: RequestInit) => {
      ditangkap = { url: String(url), init }

      return {
        ok: true,
        json: async () => ({ auth: "kunci:tanda" }),
      } as unknown as Response
    }) as unknown as typeof fetch

    const handler = authorizerKanal({ name: "private-admin.operations" }, {})
    const hasil = await new Promise<unknown>((resolve, reject) => {
      handler.authorize("1234.5678", (err, data) => (err ? reject(err) : resolve(data)))
    })

    expect(ditangkap).not.toBeNull()
    const { url, init } = ditangkap as unknown as { url: string; init: RequestInit }
    const headers = init.headers as Record<string, string>

    expect(url).toBe("/broadcasting/auth")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("same-origin")

    // Inilah inti perbaikannya: header HARUS cocok dengan isi.
    expect(headers["Content-Type"]).toBe("application/json")

    const body = JSON.parse(String(init.body)) as Record<string, string>
    expect(body.channel_name).toBe("private-admin.operations")
    expect(body.socket_id).toBe("1234.5678")

    // Cookie sesi dan token CSRF wajib ikut, kalau tidak server menjawab 419/403.
    expect(init.credentials).toBe("same-origin")
    expect(headers["X-CSRF-TOKEN"]).toBe("token-uji-123")

    expect(hasil).toEqual({ auth: "kunci:tanda" })
  })

  it("mengubah status gagal menjadi error, bukan diam", async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 403 }) as unknown as Response) as unknown as typeof fetch

    const handler = authorizerKanal({ name: "private-admin.operations" }, {})

    const err = await new Promise<Error | null>((resolve) => {
      handler.authorize("1.2", (e) => resolve(e as Error | null))
    })

    expect(err).toBeInstanceOf(Error)
    expect(String(err?.message)).toContain("403")
  })
})
