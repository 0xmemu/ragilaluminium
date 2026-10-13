import * as React from "react"
import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { RichSolutionPanel } from "@/pages/Public/MasalahSolusi"

/**
 * Penjaga DOM panel Masalah & Solusi (kontrak owner 2026-10-01).
 *
 * Panel dirender langsung dari payload, tanpa halaman penuh. Yang dijaga bukan
 * "halaman memuat", tetapi "isinya benar-benar terbawa ke DOM": dua cacat yang
 * dulu lolos ke halaman publik adalah teks solusi yang hilang karena daftar
 * opsi, dan judul bagian contoh yang tampil tanpa isi.
 */

type IsiPanel = React.ComponentProps<typeof RichSolutionPanel>["content"]

function render(content: IsiPanel, whatsappUrl: string | null = null): string {
  return renderToString(React.createElement(RichSolutionPanel, { content, whatsappUrl }))
}

describe("panel Masalah & Solusi", () => {
  const opsiDenganNomor = {
    type: "rich" as const,
    examples_label: "Contoh kondisi kerusakan",
    solutions_label: "Solusi yang kami tawarkan",
    lead: "chat ke nomor",
    body: "retur",
    options: [{ title: "Hubungi Admin", description: "085725116817", icon: "check-circle" }],
    whatsapp_note: "WhatsApp",
  }

  it("teks solusi tetap tampil walau item memakai daftar opsi", () => {
    const html = render(opsiDenganNomor)

    expect(html).toContain("retur")
    expect(html).toContain("Hubungi Admin")
    // Urutannya: teks solusi lebih dulu, daftar opsi menyusul.
    expect(html.indexOf("retur")).toBeLessThan(html.indexOf("Hubungi Admin"))
  })

  it("nomor WhatsApp di keterangan opsi menjadi tautan tombol", () => {
    const html = render(opsiDenganNomor)

    expect(html).toContain('href="https://wa.me/6285725116817"')
    expect(html).toContain('target="_blank"')
    // Nomornya tetap terbaca pelanggan, bukan diganti label lain.
    expect(html).toContain("085725116817")
  })

  it("keterangan opsi yang bukan nomor tetap teks biasa tanpa tautan", () => {
    const html = render({
      type: "rich",
      solutions_label: "Solusi yang kami tawarkan",
      options: [{ title: "Kirim foto", description: "Kirim foto kerusakan lewat chat" }],
    })

    expect(html).toContain("Kirim foto kerusakan lewat chat")
    expect(html).not.toContain("wa.me")
  })

  it("judul bagian contoh tidak dirender bila belum ada media maupun teks pengganti", () => {
    const html = render({
      type: "rich",
      examples_label: "Contoh kondisi kerusakan",
      solutions_label: "Solusi yang kami tawarkan",
      body: "retur",
    })

    expect(html).not.toContain("Contoh kondisi kerusakan")
    expect(html).toContain("retur")
  })

  it("judul bagian contoh dirender bila ada teks pengganti", () => {
    const html = render({
      type: "rich",
      examples_label: "Contoh kondisi kerusakan",
      examples_hint: "retak pada bingkai, goresan kaca",
      solutions_label: "Solusi yang kami tawarkan",
    })

    expect(html).toContain("Contoh kondisi kerusakan")
    expect(html).toContain("retak pada bingkai, goresan kaca")
  })

  it("catatan WhatsApp memakai tautan konsultasi toko", () => {
    const html = render(
      {
        type: "rich",
        solutions_label: "Solusi yang kami tawarkan",
        whatsapp_note: "Butuh bantuan? WhatsApp kami.",
      },
      "https://wa.me/62881080733754",
    )

    expect(html).toContain('href="https://wa.me/62881080733754"')
    expect(html).toContain("WhatsApp")
  })

  it("lead solusi tetap tampil bersama teks solusi", () => {
    const html = render(opsiDenganNomor)

    expect(html).toContain("chat ke nomor")
    expect(html).toContain("retur")
  })
})
