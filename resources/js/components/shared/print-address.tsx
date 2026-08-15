import { createPortal } from "react-dom"
import * as React from "react"

export interface AddressData {
  order_number?: string | null
  order_status?: string | null
  payment_status?: string | null
  shipping_status?: string | null
  notes?: string | null
  admin_notes?: string | null
  customer_name?: string | null
  customer_phone?: string | null
  shipping_address_line1?: string | null
  shipping_address_line2?: string | null
  shipping_village?: string | null
  shipping_district?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  shipping_postal_code?: string | null
  items?: Array<{
    id?: number | string
    name?: string | null
    quantity?: number
    unit_price?: number
    note?: string | null
    variation_label?: string | null
  }>
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
      {(data.order_status || data.payment_status || data.shipping_status) ? (
        <div style={{ marginTop: 14, borderTop: "1px solid #999", paddingTop: 10 }}>
          <strong style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#555" }}>
            Status setelah konfirmasi
          </strong>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 12 }}>
            <tbody>
              {[
                ["Pesanan", data.order_status],
                ["Pembayaran", data.payment_status],
                ["Pengiriman", data.shipping_status],
              ].map(([label, value]) => value ? (
                <tr key={label}>
                  <td style={{ padding: "3px 8px 3px 0", color: "#555" }}>{label}</td>
                  <td style={{ padding: "3px 0", fontWeight: 600 }}>{String(value).replace(/_/g, " ")}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>
        </div>
      ) : null}
      {(data.notes || data.admin_notes) ? (
        <div style={{ marginTop: 14, borderTop: "1px solid #999", paddingTop: 10 }}>
          <strong style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#555" }}>
            Catatan operasional
          </strong>
          {data.notes ? (
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
              <strong>Catatan pembeli:</strong> {data.notes}
            </p>
          ) : null}
          {data.admin_notes ? (
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
              <strong>Catatan admin:</strong> {data.admin_notes}
            </p>
          ) : null}
        </div>
      ) : null}
      {data.items && data.items.length ? (
        <div style={{ marginTop: 18, borderTop: "1px solid #999", paddingTop: 12 }}>
          <strong style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#555" }}>
            Daftar Produk
          </strong>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12 }}>
            <thead>
              <tr>
                <th align="left" style={{ padding: "4px 8px 4px 0", borderBottom: "1px solid #ccc", fontWeight: 700 }}>Produk</th>
                <th align="center" style={{ padding: "4px 8px", borderBottom: "1px solid #ccc", fontWeight: 700 }}>Qty</th>
                <th align="right" style={{ padding: "4px 0 4px 8px", borderBottom: "1px solid #ccc", fontWeight: 700 }}>Harga</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={item.id ?? index} style={{ verticalAlign: "top" }}>
                  <td style={{ padding: "6px 8px 6px 0", borderBottom: "1px solid #eee" }}>
                    <span style={{ fontWeight: 600 }}>{item.name || "-"}</span>
                    {item.variation_label ? (
                      <span style={{ display: "block", color: "#555" }}>{item.variation_label}</span>
                    ) : null}
                    {item.note ? (
                      <span style={{ display: "block", marginTop: 3, color: "#8a4b00", fontStyle: "italic" }}>
                        Catatan: {item.note}
                      </span>
                    ) : null}
                  </td>
                  <td align="center" style={{ padding: "6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {item.quantity ?? "-"}
                  </td>
                  <td align="right" style={{ padding: "6px 0 6px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {typeof item.unit_price === "number"
                      ? "Rp " + item.unit_price.toLocaleString("id-ID")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}
