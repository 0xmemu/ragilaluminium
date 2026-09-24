import { Head, Link } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TargetRow {
  label: string
  excluded: boolean
  override_discount_percent: number | null
}

interface PromotionHeader {
  id: number
  name: string
  type: string
  type_label: string
  status: string
  status_label: string
  discount_percent: number
  starts_at: string | null
  ends_at: string | null
  can_edit: boolean
  edit_href: string
  targets: TargetRow[]
}

interface SalesRow {
  id: number
  name: string
  parent_sku: string | null
  model: string | null
  sub_model: string | null
  product_status: string | null
  qty: number
  orders: number
  revenue: number
  discount: number
  last_sold_at: string | null
}

interface ReportPayload {
  window: { from: string | null; to: string | null; label: string }
  totals: {
    products: number
    variants: number
    qty: number
    orders: number
    revenue: number
    discount: number
    sold_products: number
    unsold_products: number
  }
  rows: SalesRow[]
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "tanpa batas"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "tanpa batas"
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "Belum ada penjualan"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Belum ada penjualan"
  return date.toLocaleString("id-ID", { dateStyle: "medium" })
}

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  hint?: string
  tone?: "default" | "primary"
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
      <p className="text-[11px] font-semibold tracking-tight text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 text-lg font-semibold tabular-nums", tone === "primary" ? "text-primary" : "text-foreground")}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export default function PromotionDetail({
  title,
  description,
  backUrl,
  promotion,
  report,
}: {
  title: string
  description: string
  backUrl: string
  promotion: PromotionHeader
  report: ReportPayload
}) {
  const rows = report.rows ?? []
  const totals = report.totals

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={backUrl}>Kembali ke daftar</Link>
          </Button>
          {promotion.can_edit ? (
            <Button asChild size="sm">
              <Link href={promotion.edit_href}>
                <Icon name="pencil-simple" className="size-4" aria-hidden="true" />
                Edit kampanye
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-6">
        <Card className="border border-border bg-card">
          <CardHeader className="flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-foreground">{promotion.name}</h2>
                <StatusBadge status={promotion.status} label={promotion.status_label} />
                <span className="inline-flex min-h-7 items-center rounded-full bg-secondary px-3 text-xs font-semibold text-secondary-foreground">
                  {promotion.type_label}
                </span>
                <span className="inline-flex min-h-7 items-center rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary tabular-nums">
                  {promotion.discount_percent}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(promotion.starts_at)} → {formatDateTime(promotion.ends_at)}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] font-semibold tracking-tight text-muted-foreground">Target kampanye</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {promotion.targets.length === 0 ? (
                <li className="text-xs text-muted-foreground">Belum ada target produk.</li>
              ) : (
                promotion.targets.map((target, index) => (
                  <li key={index} className="text-xs text-muted-foreground">
                    {target.excluded ? (
                      <span className="text-destructive line-through">{target.label}</span>
                    ) : (
                      <>
                        {target.label}
                        {target.override_discount_percent ? ` (${target.override_discount_percent}%)` : ""}
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Penjualan dihitung untuk pesanan pada {formatDateTime(report.window.from)} sampai{" "}
          {formatDateTime(report.window.to)}.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Unit terjual"
            value={formatNumber(totals.qty)}
            hint={`${formatNumber(totals.sold_products)} dari ${formatNumber(totals.products)} produk ada penjualan`}
            tone="primary"
          />
          <Metric
            label="Nilai penjualan"
            value={formatCurrency(totals.revenue)}
            hint="Dari baris pesanan produk yang tercakup kampanye"
          />
          <Metric
            label="Pesanan"
            value={formatNumber(totals.orders)}
            hint={`${formatNumber(totals.variants)} varian aktif dalam cakupan`}
          />
          <Metric
            label="Nilai diskon terjual"
            value={formatCurrency(totals.discount)}
            hint="Akumulasi potongan pada baris yang terjual"
          />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="ticket-percent"
            title="Kampanye belum punya produk"
            description="Tambahkan target produk, model, atau sub model lalu aktifkan kampanye untuk mulai mencatat penjualan."
            action={
              promotion.can_edit ? (
                <Button asChild size="sm">
                  <Link href={promotion.edit_href}>Atur target kampanye</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <Card className="overflow-hidden border border-border bg-card">
            <CardHeader>
              <CardTitle>Produk dalam kampanye</CardTitle>
              <p className="text-xs text-muted-foreground">
                Diurutkan dari yang paling banyak terjual. Produk tanpa penjualan tetap tampil di bawah dengan angka nol.
              </p>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[56rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-right">#</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Terjual</TableHead>
                      <TableHead className="text-right">Pesanan</TableHead>
                      <TableHead className="text-right">Nilai</TableHead>
                      <TableHead>Terakhir terjual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{row.name}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {row.parent_sku ?? "-"}
                              {row.product_status === "archived" ? " · diarsipkan" : ""}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.model ?? "-"}
                          {row.sub_model ? ` · ${row.sub_model}` : ""}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.qty > 0 ? (
                            <span className="font-semibold text-foreground">{formatNumber(row.qty)}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {formatNumber(row.orders)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={row.revenue > 0 ? "font-medium text-foreground" : "text-muted-foreground"}>
                            {formatCurrency(row.revenue)}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateOnly(row.last_sold_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Pesanan yang masih menunggu konfirmasi atau dibatalkan belum dihitung sebagai penjualan. Angka mengikuti
          snapshot baris pesanan, sama dengan modul Performa Toko.
        </p>
      </div>
    </AdminLayout>
  )
}
