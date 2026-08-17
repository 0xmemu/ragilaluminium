import { describe, expect, it } from "vitest"

import { fullAddress } from "@/components/shared/print-address"

describe("print address label", () => {
  it("joins the present address fields in shipping order", () => {
    const label = fullAddress({
      customer_name: "Budi",
      shipping_address_line1: "Jl. Cihampelas No. 4",
      shipping_address_line2: "Gedung B",
      shipping_village: "LEBAK GEDE",
      shipping_district: "COBLONG",
      shipping_city: "KOTA BANDUNG",
      shipping_province: "JAWA BARAT",
      shipping_postal_code: "40132",
    })

    expect(label).toBe(
      "Jl. Cihampelas No. 4, Gedung B, LEBAK GEDE, COBLONG, KOTA BANDUNG, JAWA BARAT, 40132",
    )
  })

  it("skips empty address segments instead of emitting blank commas", () => {
    expect(
      fullAddress({
        shipping_address_line1: "Jl. A",
        shipping_village: null,
        shipping_district: "",
        shipping_city: "KOTA BANDUNG",
        shipping_province: "JAWA BARAT",
        shipping_postal_code: "40132",
      }),
    ).toBe("Jl. A, KOTA BANDUNG, JAWA BARAT, 40132")
  })

  it("returns the empty string when no address field is filled", () => {
    expect(fullAddress({})).toBe("")
  })
})
