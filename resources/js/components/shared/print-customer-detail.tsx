import { createPortal } from "react-dom"
import * as React from "react"

import { formatCurrency, formatDate } from "@/lib/format"
import { statusMeta } from "@/lib/status"

export interface CustomerPrintData {
  customer: {
    id: number
    code: string
    name: string
    phone: string
    email?: string | null
    default_address_line1?: string | null
    default_address_line2?: string | null
    default_city?: string | null
    default_province?: string | null
    default_postal_code?: string | null
    default_country?: string | null
  }
  metrics: {
    order_count: number
    total_spent: number
    last_order_at: string | null
    status: { key: string; label: string }
    fraud: { score: number; label: string; tone: string }
    name_variants: string[]
    address_variant_count: number
    duplicate_warning: string | null
  }
  orders: Array<{
    id: number
    order_number: string
    order_status: string
    payment_status: string
    total_amount: number
    created_at: string | null
  }>
}

export function fullCustomerAddress(data: CustomerPrintData["customer"]): string {
  return [
    data.default_address_line1,
    data.default_address_line2,
    data.default_city,
    data.default_province,
    data.default_postal_code,
    data.default_country,
  ]
    .filter(Boolean)
    .join(", ")
}

/**
 * Hook cetak detail konsumen: saat dipanggil, render area cetak (portal ke <body>)
 * lalu buka dialog print browser. CSS `@media print` di app.css hanya
 * menampilkan `#print-customer-detail`; setelah dialog ditutup area dihapus.
 */
export function usePrintCustomer() {
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

/** Template cetak detail konsumen (satu-satunya elemen yang dicetak). */
export function PrintCustomerArea({ data }: { data: CustomerPrintData }) {
  const { customer, metrics, orders } = data
  const address = fullCustomerAddress(customer)
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

  const label = { color: "#777", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 0.5, display: "block" }
  const value = { fontWeight: 600 }

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
    <div id="print-customer-detail" style={page}>
      <div style={headerRow}>
        <div>
          <div style={brand}>RAGIL ALUMINIUM</div>
          <div style={docTitle}>Detail Konsumen · {customer.code}</div>
        </div>
        <div style={printMeta}>
          Dicetak: {formatDate(printedAt.toISOString())}
          <br />
          Status: <strong>{metrics.status.label}</strong>
        </div>
      </div>

      <div style={sectionTitle}>Identitas Konsumen</div>
      <div style={grid}>
        <div>
          <span style={label}>Nama</span>
          <span style={value}>{customer.name}</span>
        </div>
        <div>
          <span style={label}>Kode Konsumen</span>
          <span style={value}>{customer.code}</span>
        </div>
        <div>
          <span style={label}>WhatsApp</span>
          <span style={value}>{customer.phone}</span>
        </div>
        <div>
          <span style={label}>Email</span>
          <span style={value}>{customer.email || "-"}</span>
        </div>
      </div>

      <div style={sectionTitle}>Alamat Default</div>
      <div style={{ fontSize: 13, lineHeight: 1.7 }}>{address || "-"}</div>

      <div style={sectionTitle}>Ringkasan</div>
      <div style={grid}>
        <div>
          <span style={label}>Jumlah Order</span>
          <span style={value}>{metrics.order_count}</span>
        </div>
        <div>
          <span style={label}>Total Belanja (Fulfillment)</span>
          <span style={value}>{formatCurrency(metrics.total_spent)}</span>
        </div>
        <div>
          <span style={label}>Order Terakhir</span>
          <span style={value}>{metrics.last_order_at ? formatDate(metrics.last_order_at) : "-"}</span>
        </div>
        <div>
          <span style={label}>Skor Penipuan</span>
          <span style={value}>
            {metrics.fraud.score} · {metrics.fraud.label}
          </span>
        </div>
        {metrics.duplicate_warning ? (
          <div>
            <span style={label}>Catatan Duplikat</span>
            <span style={value}>{metrics.duplicate_warning}</span>
          </div>
        ) : null}
      </div>

      <div style={sectionTitle}>Riwayat Pesanan</div>
      {orders.length ? (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>No. Order</th>
              <th style={th}>Tanggal</th>
              <th style={th}>Status</th>
              <th style={th}>Pembayaran</th>
              <th style={th} align="right">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td style={{ ...td, fontFamily: "monospace", fontWeight: 600 }}>{order.order_number}</td>
                <td style={td}>{order.created_at ? formatDate(order.created_at) : "-"}</td>
                <td style={td}>{statusMeta(order.order_status).label}</td>
                <td style={td}>{statusMeta(order.payment_status).label}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{formatCurrency(order.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ fontSize: 13, color: "#555" }}>Belum ada pesanan.</div>
      )}

      <div style={footer}>Dokumen ini dicetak dari panel admin Ragil Aluminium. Data konsumen bersifat internal.</div>
    </div>,
    document.body,
  )
}
