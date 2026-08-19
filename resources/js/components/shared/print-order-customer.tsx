import { createPortal } from "react-dom"
import * as React from "react"

import { formatCurrency, formatDate } from "@/lib/format"
import { statusMeta } from "@/lib/status"

export interface OrderPrintItem {
  id: number
  name: string
  variant_sku?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
  quantity: number
  unit_price?: number
  line_total?: number
  note?: string | null
}

export interface OrderPrintData {
  id: number
  order_number: string
  order_status: string
  payment_status: string
  payment_method?: string | null
  payment_method_label?: string
  shipping_status?: string
  cod_flag?: boolean
  flow?: "cod" | "transfer"
  customer_name: string
  customer_phone?: string | null
  shipping_address_line1?: string | null
  shipping_address_line2?: string | null
  shipping_village?: string | null
  shipping_district?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  shipping_postal_code?: string | null
  notes?: string | null
  admin_notes?: string | null
  total_amount: number
  product_count: number
  unit_count: number
  created_at: string | null
  items: OrderPrintItem[]
}

export function orderShippingAddress(data: OrderPrintData): string {
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
 * Hook cetak detail konsumen dari daftar pesanan: render area cetak (portal
 * ke <body>) lalu buka dialog print browser. CSS `@media print` di app.css
 * hanya menampilkan `#print-order-customer`; setelah dialog ditutup area
 * dihapus.
 */
export function usePrintOrder() {
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

/**
 * Template cetak detail konsumen + isi pesanan untuk daftar order.
 * Admin menekan tombol cetak setelah mengonfirmasi pesanan; dokumen memuat
 * identitas konsumen, alamat kirim, ringkasan, dan rincian item.
 */
export function PrintOrderArea({ data }: { data: OrderPrintData }) {
  const address = orderShippingAddress(data)
  const paymentLabel =
    data.payment_method_label ||
    (data.cod_flag ? "COD" : data.payment_method === "cod" ? "COD" : "Transfer")
  const printedAt = new Date()

  const page: React.CSSProperties = {
    fontFamily: "Arial, Helvetica, sans-serif",
    color: "#111",
    maxWidth: 720,
    margin: "0 auto",
    padding: 24,
  }

  const headerRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #111",
    paddingBottom: 12,
    marginBottom: 16,
  }

  const brand: React.CSSProperties = { fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }
  const docTitle: React.CSSProperties = { fontSize: 13, color: "#555", marginTop: 2 }
  const printMeta: React.CSSProperties = { fontSize: 11, color: "#555", textAlign: "right", lineHeight: 1.6 }

  const sectionTitle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#333",
    borderBottom: "1px solid #bbb",
    paddingBottom: 4,
    margin: "18px 0 10px",
  }

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "6px 24px",
    fontSize: 13,
    lineHeight: 1.7,
  }

  const label: React.CSSProperties = {
    color: "#777",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    display: "block",
  }
  const value: React.CSSProperties = { fontWeight: 600 }

  const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 }
  const th: React.CSSProperties = {
    textAlign: "left",
    borderBottom: "1px solid #333",
    padding: "6px 8px",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#333",
  }
  const td: React.CSSProperties = { borderBottom: "1px solid #ddd", padding: "6px 8px", verticalAlign: "top" }

  const footer: React.CSSProperties = {
    marginTop: 24,
    paddingTop: 10,
    borderTop: "1px solid #bbb",
    fontSize: 10,
    color: "#888",
  }

  return createPortal(
    <div id="print-order-customer" style={page}>
      <div style={headerRow}>
        <div>
          <div style={brand}>RAGIL ALUMINIUM</div>
          <div style={docTitle}>
            Detail Konsumen &amp; Pesanan — {data.order_number}
          </div>
        </div>
        <div style={printMeta}>
          Dicetak: {formatDate(printedAt.toISOString())}
          <br />
          Order: {formatDate(data.created_at || "")}
        </div>
      </div>

      <div style={sectionTitle}>Identitas Konsumen</div>
      <div style={grid}>
        <div>
          <span style={label}>Nama</span>
          <span style={value}>{data.customer_name}</span>
        </div>
        <div>
          <span style={label}>WhatsApp</span>
          <span style={value}>{data.customer_phone || "—"}</span>
        </div>
        <div>
          <span style={label}>Status Pesanan</span>
          <span style={value}>{statusMeta(data.order_status).label}</span>
        </div>
        <div>
          <span style={label}>Pembayaran</span>
          <span style={value}>
            {statusMeta(data.payment_status).label} · {paymentLabel}
          </span>
        </div>
      </div>

      <div style={sectionTitle}>Alamat Pengiriman</div>
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{address || "—"}</div>

      <div style={sectionTitle}>Ringkasan</div>
      <div style={grid}>
        <div>
          <span style={label}>Total Produk</span>
          <span style={value}>{data.product_count} jenis</span>
        </div>
        <div>
          <span style={label}>Total Qty</span>
          <span style={value}>{data.unit_count} pcs</span>
        </div>
        <div>
          <span style={label}>Total Tagihan</span>
          <span style={value}>{formatCurrency(data.total_amount)}</span>
        </div>
      </div>

      <div style={sectionTitle}>Rincian Pesanan</div>
      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Produk</th>
            <th style={th}>Varian</th>
            <th style={th} align="center">
              Qty
            </th>
            <th style={th} align="right">
              Harga
            </th>
            <th style={th} align="right">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => {
            const variation = [
              item.variation_1_name && item.variation_1_option
                ? `${item.variation_1_name}: ${item.variation_1_option}`
                : null,
              item.variation_2_name && item.variation_2_option
                ? `${item.variation_2_name}: ${item.variation_2_option}`
                : null,
            ]
              .filter(Boolean)
              .join(", ")
            return (
              <tr key={item.id}>
                <td style={td}>{item.name}</td>
                <td style={td}>{variation || "—"}</td>
                <td style={{ ...td, textAlign: "center" }}>{item.quantity}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {item.unit_price != null ? formatCurrency(item.unit_price) : "—"}
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                  {item.line_total != null ? formatCurrency(item.line_total) : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {data.notes?.trim() ? (
        <>
          <div style={sectionTitle}>Catatan Konsumen</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>{data.notes}</div>
        </>
      ) : null}
      {data.admin_notes?.trim() ? (
        <>
          <div style={sectionTitle}>Catatan Admin</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>{data.admin_notes}</div>
        </>
      ) : null}

      <div style={footer}>
        Dokumen ini dicetak dari panel admin Ragil Aluminium. Data konsumen bersifat internal.
      </div>
    </div>,
    document.body,
  )
}
