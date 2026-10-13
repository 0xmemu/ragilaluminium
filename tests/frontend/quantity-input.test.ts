// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { QuantityInput } from "@/components/admin/ui/quantity-input"

/**
 * Kontrol jumlah bersama panel admin (permintaan owner 2026-09-29).
 *
 * Yang dijaga di sini adalah PERILAKU, bukan tampilan: batas bawah dan atas
 * ditegakkan komponen ini sendiri, jadi pemanggil tidak bisa lagi lupa
 * membatasi angka yang diketik admin. Sebelumnya setiap halaman mengatur
 * sendiri, ada yang memakai Math.max, ada yang tidak dibatasi sama sekali.
 */
afterEach(cleanup)

function pasang(props: Partial<React.ComponentProps<typeof QuantityInput>> = {}) {
  const onChange = vi.fn()
  render(React.createElement(QuantityInput, { value: 5, onChange, ...props }))

  return {
    onChange,
    kurang: () => screen.getByRole("button", { name: "Kurangi jumlah" }),
    tambah: () => screen.getByRole("button", { name: "Tambah jumlah" }),
    isian: () => screen.getByRole("spinbutton"),
  }
}

describe("kontrol jumlah bersama", () => {
  it("menampilkan nilai berjalan dan kedua tombol", () => {
    const { isian, kurang, tambah } = pasang({ value: 3 })

    expect(isian()).toHaveProperty("value", "3")
    expect(kurang()).toBeTruthy()
    expect(tambah()).toBeTruthy()
  })

  it("menambah dan mengurangi satu langkah", () => {
    const { onChange, kurang, tambah } = pasang({ value: 4 })

    fireEvent.click(tambah())
    expect(onChange).toHaveBeenLastCalledWith(5)

    fireEvent.click(kurang())
    expect(onChange).toHaveBeenLastCalledWith(3)
  })

  it("tidak pernah turun di bawah batas bawah", () => {
    const { onChange, kurang } = pasang({ value: 1, min: 1 })

    expect(kurang()).toHaveProperty("disabled", true)
    fireEvent.click(kurang())
    expect(onChange).not.toHaveBeenCalled()
  })

  it("tidak pernah naik di atas batas atas", () => {
    const { onChange, tambah } = pasang({ value: 2, max: 2 })

    expect(tambah()).toHaveProperty("disabled", true)
    fireEvent.click(tambah())
    expect(onChange).not.toHaveBeenCalled()
  })

  it("membatasi angka yang diketik langsung, bukan hanya lewat tombol", () => {
    const { onChange, isian } = pasang({ value: 2, min: 1, max: 9 })

    fireEvent.change(isian(), { target: { value: "40" } })
    expect(onChange).toHaveBeenLastCalledWith(9)

    fireEvent.change(isian(), { target: { value: "0" } })
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it("memakai label tombol yang menyebut konteksnya", () => {
    // Tidak memakai helper: nama tombolnya sengaja berbeda dari bawaan, dan
    // itulah yang sedang diuji.
    render(
      React.createElement(QuantityInput, { value: 5, onChange: vi.fn(), label: "jumlah unit retur" }),
    )

    expect(screen.getByRole("button", { name: "Kurangi jumlah unit retur" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Tambah jumlah unit retur" })).toBeTruthy()
  })

  it("menyebut barisnya pada isian lewat ariaLabel", () => {
    const { isian } = pasang({ ariaLabel: "Jumlah Tinggi 180cm x Panjang 130cm" })

    expect(isian()).toHaveProperty("ariaLabel", "Jumlah Tinggi 180cm x Panjang 130cm")
  })

  it("mematikan seluruh kontrol saat disabled", () => {
    const { onChange, kurang, tambah, isian } = pasang({ value: 3, disabled: true })

    expect(kurang()).toHaveProperty("disabled", true)
    expect(tambah()).toHaveProperty("disabled", true)
    expect(isian()).toHaveProperty("disabled", true)

    fireEvent.click(tambah())
    expect(onChange).not.toHaveBeenCalled()
  })
})
