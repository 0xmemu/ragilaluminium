import { createPortal } from "react-dom"
import * as React from "react"

export interface AddressData {
  order_number?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  shipping_address_line1?: string | null
  shipping_address_line2?: string | null
  shipping_village?: string | null
  shipping_district?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  shipping_postal_code?: string | null
}

export function fullAddress(data: AddressData): string {
  return [
    data.shipping_address_line1,
    data.shipping_address_line2,
    data.shipping_village,
    data.shipping_district,
    data.shipping_city,
    data.shipping_province,
    data.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(", ")
}

/**
 * Hook cetak alamat: saat dipanggil, render area cetak (portal ke <body>)
 * lalu buka dialog print browser. CSS `@media print` di app.css hanya
 * menampilkan `#print-address`; setelah dialog ditutup area dihapus.
 */
export function usePrintAddress() {
  const [printing, setPrinting] = React.useState(false)

  React.useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(false)
    window.addEventListener("afterprint", done)
    return () => window.removeEventListener("afterprint", done)
  }, [printing])

  const handlePrint = React.useCallback(() => {
    setPrinting(true)
    // Tunggu React commit DOM-nya dulu, baru buka dialog print.
    window.setTimeout(() => window.print(), 0)
  }, [])

  return { printing, handlePrint }
}

/** Label alamat yang tampil di hasil cetak (satu-satunya elemen yang dicetak). */
export function PrintAddressArea({ data }: { data: AddressData }) {
  const label: React.CSSProperties = {
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: 14,
    lineHeight: 1.65,
    color: "#111",
    padding: 32,
    // Tersembunyi di layar; hanya tampil saat print (lihat @media print di app.css).
    display: "none",
  }

  return createPortal(
    <div id="print-address" aria-hidden="true" style={label}>
      <div style={{ borderBottom: "2px solid #111", marginBottom: 16, paddingBottom: 8 }}>
        <strong style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
          Ragil Aluminium — Alamat Pengiriman
        </strong>
      </div>
      <p style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>{data.customer_name || ""}</p>
      <p style={{ margin: "2px 0 0" }}>{data.customer_phone || ""}</p>
      <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{fullAddress(data) || "-"}</p>
      {data.order_number ? (
        <p style={{ marginTop: 14, fontSize: 12, color: "#555" }}>
          Order: {data.order_number}
        </p>
      ) : null}
    </div>,
    document.body,
  )
}
