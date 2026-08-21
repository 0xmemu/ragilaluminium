import { createPortal } from "react-dom"
import * as React from "react"

import { formatCurrency, formatDateTime } from "@/lib/format"

const LOGO_URL = "/images/brand/dark-mark.png"

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
  shipping_insurance_amount?: number
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
 * Template cetak detail pesanan + pelanggan untuk daftar order (satu halaman
 * A4 794px): header brand + tanggal dipesan/dicetak, no. pesanan, data
 * pelanggan (kiri) dengan alamat lengkap (kanan) dan wilayah (bawah), tabel
 * item, lalu ringkasan harga.
 */
export function PrintOrderArea({ data }: { data: OrderPrintData }) {
  const address = orderShippingAddress(data)
  const printedAt = new Date()

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
    padding: "20px 40px 24px",
    background: "#FFFFFF",
  }

  const label: React.CSSProperties = {
    color: "#666666",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: "uppercase" as const,
  }
  const value: React.CSSProperties = {
    color: "#333333",
    fontSize: 11,
    fontWeight: 400,
  }

  const sectionBox: React.CSSProperties = {
    border: "1px solid #DEE3E0",
    borderRadius: 6,
    padding: "10px 14px 12px",
    marginTop: 12,
  }

  const th: React.CSSProperties = {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 700,
    padding: "6px 8px",
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

      {/* ===== Header brand + tanggal ===== */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={LOGO_URL}
            alt="Ragil Aluminium"
            width={44}
            height={44}
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
        </div>
        <div style={{ textAlign: "right", color: "#666666", fontSize: 10, lineHeight: 1.6 }}>
          <div>
            Tanggal dipesan:{" "}
            <strong style={{ color: "#333333" }}>
              {data.created_at ? formatDateTime(data.created_at) : "—"}
            </strong>
          </div>
          <div>
            Tanggal dicetak:{" "}
            <strong style={{ color: "#333333" }}>{formatDateTime(printedAt.toISOString())}</strong>
          </div>
        </div>
      </div>
      <div style={{ height: 2, background: "#DEE3E0", marginTop: 12 }} />

      {/* ===== No. pesanan ===== */}
      <div style={{ marginTop: 12 }}>
        <div style={label}>No. Pesanan</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: "#C20000",
            marginTop: 2,
            fontFamily: "monospace",
          }}
        >
          {data.order_number}
        </div>
      </div>

      {/* ===== Data pelanggan: kiri (nama/HP) + kanan (alamat) ===== */}
      <div style={sectionBox}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#333333" }}>
          DATA PELANGGAN &amp; ALAMAT PENGIRIMAN
        </div>
        <div style={{ height: 1, background: "#DEE3E0", margin: "8px 0 10px" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px minmax(0, 1fr)",
            columnGap: 24,
          }}
        >
          {/* Kiri: nama, no HP, lalu alamat lengkap di bawahnya (box sempit) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ ...label, width: 56, flexShrink: 0 }}>Nama</span>
              <span style={value}>{data.customer_name}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ ...label, width: 56, flexShrink: 0 }}>No. HP</span>
              <span style={value}>{data.customer_phone || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ ...label, color: "#333333", fontWeight: 700 }}>Alamat lengkap</span>
              <span style={{ ...value, fontSize: 10, lineHeight: 1.5, maxWidth: 290 }}>{address || "—"}</span>
            </div>
          </div>
          {/* Kanan: wilayah (provinsi, kota, kecamatan, kelurahan, kode pos) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              columnGap: 16,
              rowGap: 8,
              alignContent: "start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label}>Provinsi</span>
              <span style={value}>{data.shipping_province || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label}>Kota</span>
              <span style={value}>{data.shipping_city || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label}>Kecamatan</span>
              <span style={value}>{data.shipping_district || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label}>Kelurahan</span>
              <span style={value}>{data.shipping_village || "—"}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={label}>Kode Pos</span>
              <span style={value}>{data.shipping_postal_code || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Tabel item ===== */}
      <div style={{ marginTop: 12 }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, background: "#1A1E1C", borderTopLeftRadius: 4, borderBottomLeftRadius: 4, width: 30 }}>
                NO
              </th>
              <th style={{ ...th, background: "#1A1E1C", width: 200 }}>PRODUK</th>
              <th style={{ ...th, background: "#1A1E1C", width: 140 }}>VARIAN</th>
              <th style={{ ...th, background: "#1A1E1C", width: 110 }}>VOLUME/BERAT</th>
              <th style={{ ...th, background: "#1A1E1C", width: 36, textAlign: "center" }}>QTY</th>
              <th style={{ ...th, background: "#1A1E1C", width: 90, textAlign: "right" }}>HARGA</th>
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
          <div style={{ fontSize: 10, fontWeight: 700, color: "#333333", marginTop: 6 }}>
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
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#333333" }}>RINGKASAN</div>
        <div style={{ height: 1, background: "#DEE3E0", margin: "6px 0 8px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>SUBTOTAL</span>
          <span style={{ fontSize: 10, color: "#333333" }}>
            {data.subtotal_amount != null ? formatCurrency(data.subtotal_amount) : formatCurrency(data.total_amount)}
          </span>
        </div>
        {data.discount_amount && data.discount_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>POTONGAN (FLASH SALE)</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#C20000" }}>
              − {formatCurrency(data.discount_amount)}
            </span>
          </div>
        ) : null}
        {data.voucher_discount_amount && data.voucher_discount_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>
              VOUCHER{data.voucher_code ? ` (${data.voucher_code})` : ""}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#C20000" }}>
              − {formatCurrency(data.voucher_discount_amount)}
            </span>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>ONGKIR</span>
          <span style={{ fontSize: 10, color: "#333333" }}>
            {data.shipping_amount != null ? formatCurrency(data.shipping_amount) : "—"}
          </span>
        </div>
        {data.shipping_subsidy_amount && data.shipping_subsidy_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>SUBSIDI ONGKIR</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#C20000" }}>
              − {formatCurrency(data.shipping_subsidy_amount)}
            </span>
          </div>
        ) : null}
        {data.shipping_insurance_amount && data.shipping_insurance_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>ASURANSI PENGIRIMAN</span>
            <span style={{ fontSize: 10, color: "#333333" }}>{formatCurrency(data.shipping_insurance_amount)}</span>
          </div>
        ) : null}
        {data.cod_fee_amount && data.cod_fee_amount > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#666666" }}>BIAYA COD</span>
            <span style={{ fontSize: 10, color: "#333333" }}>{formatCurrency(data.cod_fee_amount)}</span>
          </div>
        ) : null}
        <div style={{ height: 1, background: "#DEE3E0", margin: "8px 0 6px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#333333" }}>TOTAL HARGA</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#C20000" }}>
            {formatCurrency(data.total_amount)}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
