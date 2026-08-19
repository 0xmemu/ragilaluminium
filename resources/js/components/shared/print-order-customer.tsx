import { createPortal } from "react-dom"
import * as React from "react"

import { formatCurrency, formatDateTime } from "@/lib/format"
import { statusMeta } from "@/lib/status"

/** Logo toko (inline, agar hasil cetak tidak bergantung file eksternal). */
const LOGO_DATA_URL =
  "data:image/png;base64,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"

const INTER_FONT =
  "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap"

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
  weight_kg?: number | null
  volume_m3?: number | null
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
  customer_email?: string | null
  shipping_address_line1?: string | null
  shipping_address_line2?: string | null
  shipping_village?: string | null
  shipping_district?: string | null
  shipping_city?: string | null
  shipping_province?: string | null
  shipping_postal_code?: string | null
  notes?: string | null
  admin_notes?: string | null
  subtotal_amount?: number
  shipping_amount?: number
  shipping_subsidy_amount?: number
  discount_amount?: number
  voucher_code?: string | null
  voucher_discount_amount?: number
  cod_fee_amount?: number
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

/** Format angka desimal ala Indonesia (koma), mis. "0,040". */
function fmtDecimal(value: number, digits: number): string {
  return value
    .toFixed(digits)
    .replace(".", ",")
    .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.")
}

/**
 * Hook cetak detail pesanan dari daftar pesanan: render area cetak (portal
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
 * Template cetak detail pesanan + pelanggan untuk daftar order (desain
 * 794px/A4): header brand, no. pesanan, data pelanggan & alamat pengiriman,
 * tabel item (dengan volume/berat), dan ringkasan harga.
 */
export function PrintOrderArea({ data }: { data: OrderPrintData }) {
  const address = orderShippingAddress(data)

  const totalVolume = data.items.reduce(
    (sum, item) => sum + (item.volume_m3 ?? 0) * item.quantity,
    0,
  )
  const totalWeight = data.items.reduce(
    (sum, item) => sum + (item.weight_kg ?? 0) * item.quantity,
    0,
  )
  const hasVolume = data.items.some((item) => item.volume_m3 != null)
  const hasWeight = data.items.some((item) => item.weight_kg != null)

  const page: React.CSSProperties = {
    fontFamily: "'Inter', system-ui, sans-serif",
    color: "#1A1E1C",
    width: 794,
    margin: "0 auto",
    padding: "16px 0 24px",
    background: "#FFFFFF",
  }

  const label: React.CSSProperties = {
    color: "#666666",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0,
  }
  const value: React.CSSProperties = {
    color: "#333333",
    fontSize: 10,
    fontWeight: 400,
  }

  const sectionBox: React.CSSProperties = {
    border: "1px solid #DEE3E0",
    borderRadius: 6,
    padding: "10px 16px 14px",
    marginTop: 14,
  }

  const th: React.CSSProperties = {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 700,
    padding: "7px 8px",
    textAlign: "left",
    whiteSpace: "nowrap",
  }
  const td: React.CSSProperties = {
    fontSize: 9,
    padding: "5px 8px",
    verticalAlign: "top",
    lineHeight: "12px",
    color: "#333333",
  }

  return createPortal(
    <div id="print-order-customer" style={page}>
      {/* Font Inter untuk hasil cetak konsisten dengan desain. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={INTER_FONT} rel="stylesheet" />

      {/* ===== Header brand ===== */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 40px 0" }}>
        <img
          src={LOGO_DATA_URL}
          alt=""
          width={48}
          height={47}
          style={{ display: "block", objectFit: "contain" }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#1A1E1C", lineHeight: 1.1 }}>
            Ragil Aluminium
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#BF0000", marginTop: 2 }}>
            ragilaluminium.com
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", color: "#666666", fontSize: 10, lineHeight: 1.5 }}>
          <div>Tanggal: {data.created_at ? formatDateTime(data.created_at) : "—"}</div>
          <div>
            Status: {statusMeta(data.order_status).label} · {statusMeta(data.payment_status).label}
          </div>
        </div>
      </div>
      <div style={{ height: 2, background: "#DEE3E0", margin: "12px 40px 0" }} />

      {/* ===== No. pesanan ===== */}
      <div style={{ padding: "16px 40px 0" }}>
        <div style={{ ...label, fontSize: 9 }}>NO. PESANAN</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#C20000", marginTop: 2, fontFamily: "monospace" }}>
          {data.order_number}
        </div>
      </div>

      {/* ===== Data pelanggan & alamat pengiriman ===== */}
      <div style={sectionBox}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#333333" }}>
          DATA PELANGGAN &amp; ALAMAT PENGIRIMAN
        </div>
        <div style={{ height: 1, background: "#DEE3E0", margin: "8px 0 10px" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            rowGap: 8,
            columnGap: 24,
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 66, flexShrink: 0 }}>Nama</span>
            <span style={value}>{data.customer_name}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 72, flexShrink: 0 }}>Provinsi</span>
            <span style={value}>{data.shipping_province || "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 66, flexShrink: 0 }}>No. HP</span>
            <span style={value}>{data.customer_phone || "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 72, flexShrink: 0 }}>Kota</span>
            <span style={value}>{data.shipping_city || "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 66, flexShrink: 0 }}>Email</span>
            <span style={{ ...value, wordBreak: "break-all" }}>{data.customer_email || "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 72, flexShrink: 0 }}>Kecamatan</span>
            <span style={value}>{data.shipping_district || "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 66, flexShrink: 0 }}>&nbsp;</span>
            <span style={value}>&nbsp;</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 72, flexShrink: 0 }}>Kelurahan</span>
            <span style={value}>{data.shipping_village || "—"}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 66, flexShrink: 0 }}>&nbsp;</span>
            <span style={value}>&nbsp;</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ ...label, width: 72, flexShrink: 0 }}>Kode Pos</span>
            <span style={value}>{data.shipping_postal_code || "—"}</span>
          </div>
        </div>
        <div style={{ height: 1, background: "#DEE3E0", margin: "12px 0 8px" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ ...label, color: "#333333", fontWeight: 700, width: 100, flexShrink: 0 }}>
            ALAMAT LENGKAP:
          </span>
          <span style={value}>{address || "—"}</span>
        </div>
      </div>

      {/* ===== Tabel item ===== */}
      <div style={{ marginTop: 14, padding: "0 40px" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, background: "#1A1E1C", borderTopLeftRadius: 4, borderBottomLeftRadius: 4, width: 32 }}>
                NO
              </th>
              <th style={{ ...th, background: "#1A1E1C", width: 156 }}>PRODUK</th>
              <th style={{ ...th, background: "#1A1E1C", width: 120 }}>VARIAN</th>
              <th style={{ ...th, background: "#1A1E1C", width: 118 }}>
                VOLUME/BERAT
              </th>
              <th style={{ ...th, background: "#1A1E1C", width: 40, textAlign: "center" }}>QTY</th>
              <th style={{ ...th, background: "#1A1E1C", width: 92, textAlign: "right" }}>HARGA</th>
              <th
                style={{
                  ...th,
                  background: "#1A1E1C",
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                  width: 110,
                  textAlign: "right",
                }}
              >
                SUBTOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const variation = [
                item.variation_1_name && item.variation_1_option
                  ? `${item.variation_1_name}: ${item.variation_1_option}`
                  : null,
                item.variation_2_name && item.variation_2_option
                  ? `${item.variation_2_name}: ${item.variation_2_option}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
              const dimParts: string[] = []
              if (item.volume_m3 != null) dimParts.push(`${fmtDecimal(item.volume_m3, 3)} m³`)
              if (item.weight_kg != null) dimParts.push(`${fmtDecimal(item.weight_kg, 1)} kg`)
              const bg = index % 2 === 1 ? "#F9FAFA" : "#FFFFFF"
              return (
                <tr key={item.id}>
                  <td style={{ ...td, background: bg, outline: "1px solid #DEE3E0", outlineOffset: -0.5, color: "#666666" }}>
                    {index + 1}
                  </td>
                  <td style={{ ...td, background: bg, outline: "1px solid #DEE3E0", outlineOffset: -0.5 }}>{item.name}</td>
                  <td style={{ ...td, background: bg, outline: "1px solid #DEE3E0", outlineOffset: -0.5 }}>
                    {variation || "—"}
                  </td>
                  <td style={{ ...td, background: bg, outline: "1px solid #DEE3E0", outlineOffset: -0.5 }}>
                    {dimParts.join(" · ") || "—"}
                  </td>
                  <td style={{ ...td, background: bg, outline: "1px solid #DEE3E0", outlineOffset: -0.5, textAlign: "center" }}>
                    {item.quantity}
                  </td>
                  <td style={{ ...td, background: bg, outline: "1px solid #DEE3E0", outlineOffset: -0.5, textAlign: "right" }}>
                    {item.unit_price != null ? formatCurrency(item.unit_price) : "—"}
                  </td>
                  <td
                    style={{
                      ...td,
                      background: bg,
                      outline: "1px solid #DEE3E0",
                      outlineOffset: -0.5,
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {item.line_total != null ? formatCurrency(item.line_total) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {hasVolume || hasWeight ? (
          <div style={{ fontSize: 10, fontWeight: 700, color: "#333333", marginTop: 8 }}>
            TOTAL VOLUME / BERAT:{" "}
            {[
              hasVolume ? `${fmtDecimal(totalVolume, 3)} m³` : null,
              hasWeight ? `${fmtDecimal(totalWeight, 1)} kg` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        ) : null}
      </div>

      {/* ===== Ringkasan harga ===== */}
      <div style={{ marginTop: 14, padding: "0 40px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#333333" }}>RINGKASAN</div>
        <div style={{ height: 1, background: "#DEE3E0", margin: "8px 0 10px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>SUBTOTAL</span>
          <span style={{ fontSize: 10, color: "#333333" }}>
            {data.subtotal_amount != null ? formatCurrency(data.subtotal_amount) : formatCurrency(data.total_amount)}
          </span>
        </div>
        {data.discount_amount && data.discount_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>POTONGAN (FLASH SALE)</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#C20000" }}>
              − {formatCurrency(data.discount_amount)}
            </span>
          </div>
        ) : null}
        {data.voucher_discount_amount && data.voucher_discount_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>
              VOUCHER{data.voucher_code ? ` (${data.voucher_code})` : ""}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#C20000" }}>
              − {formatCurrency(data.voucher_discount_amount)}
            </span>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>ONGKIR</span>
          <span style={{ fontSize: 10, color: "#333333" }}>
            {data.shipping_amount != null ? formatCurrency(data.shipping_amount) : "—"}
          </span>
        </div>
        {data.shipping_subsidy_amount && data.shipping_subsidy_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>SUBSIDI ONGKIR</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#C20000" }}>
              − {formatCurrency(data.shipping_subsidy_amount)}
            </span>
          </div>
        ) : null}
        {data.cod_fee_amount && data.cod_fee_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>BIAYA COD</span>
            <span style={{ fontSize: 10, color: "#333333" }}>{formatCurrency(data.cod_fee_amount)}</span>
          </div>
        ) : null}
        <div style={{ height: 1, background: "#DEE3E0", margin: "10px 0 8px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#333333" }}>TOTAL HARGA</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#C20000" }}>
            {formatCurrency(data.total_amount)}
          </span>
        </div>
      </div>

      {/* ===== Footer ===== */}
      <div
        style={{
          marginTop: 20,
          padding: "8px 40px 0",
          borderTop: "1px solid #DEE3E0",
          fontSize: 9,
          color: "#888888",
        }}
      >
        Dokumen ini dicetak dari panel admin Ragil Aluminium. Data konsumen bersifat internal.
      </div>
    </div>,
    document.body,
  )
}
