import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface CustomerForm {
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

interface Metrics {
  order_count: number
  total_spent: number
  last_order_at: string | null
  status: { key: string; label: string }
  fraud: { score: number; label: string; tone: string }
  name_variants: string[]
  address_variant_count: number
  duplicate_warning: string | null
}

interface OrderRow {
  id: number
  order_number: string
  order_status: string
  payment_status: string
  total_amount: number
  created_at: string | null
  href: string
}

export default function CustomerEdit({
  title,
  description,
  customer,
  metrics,
  orders = [],
  submitUrl,
  backUrl,
  whatsappUrl,
}: {
  title: string
  description: string
  customer: CustomerForm
  metrics: Metrics
  orders: OrderRow[]
  submitUrl: string
  backUrl: string
  whatsappUrl: string
}) {
  const form = useForm({
    name: customer.name,
    email: customer.email ?? "",
    default_address_line1: customer.default_address_line1 ?? "",
    default_address_line2: customer.default_address_line2 ?? "",
    default_city: customer.default_city ?? "",
    default_province: customer.default_province ?? "",
    default_postal_code: customer.default_postal_code ?? "",
    default_country: customer.default_country ?? "Indonesia",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl, { preserveScroll: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={<StatusBadge status={metrics.status.key} label={metrics.status.label} />}
    >
      <Head title={`${customer.name} | Customer | Admin`} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="secondary">
          <Link href={backUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke Customer
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <a href={whatsappUrl} target="_blank" rel="noreferrer">
              <Icon name="whatsapp" className="size-4" aria-hidden="true" />
              Chat WA
            </a>
          </Button>
        </div>
      </div>

      <section className="mb-6 rounded-lg border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-12 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
              <Icon name="users" className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold">{customer.name}</h2>
              <p className="mt-1 font-mono text-sm text-muted-foreground">{customer.code} · {customer.phone}</p>
              {metrics.fraud.score >= 30 ? (
                <p className="mt-2 text-sm font-semibold text-warning-foreground">Nomor WhatsApp sedang diselidiki</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-border px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skor penipuan</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{metrics.fraud.score}</p>
            <p
              className={cn(
                "text-xs font-semibold",
                metrics.fraud.tone === "success" && "text-success",
                metrics.fraud.tone === "warning" && "text-warning-foreground",
                metrics.fraud.tone === "danger" && "text-destructive",
              )}
            >
              {metrics.fraud.label}
            </p>
          </div>
        </div>
        {metrics.duplicate_warning ? (
          <Alert tone="warning" className="mt-4">
            {metrics.duplicate_warning}
          </Alert>
        ) : null}
        <dl className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Jumlah order</dt>
            <dd className="font-semibold tabular-nums">{formatNumber(metrics.order_count)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total belanja (fulfillment)</dt>
            <dd className="font-semibold tabular-nums">{formatCurrency(metrics.total_spent)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Order terakhir</dt>
            <dd className="font-semibold">{metrics.last_order_at ? formatDate(metrics.last_order_at) : "—"}</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
        <section className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
          <h3 className="text-base font-bold">Edit data pelanggan</h3>
          <FormErrorSummary errors={form.errors} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Nama lengkap" required error={form.errors.name}>
              <Input id="name" value={form.data.name} onChange={(e) => form.setData("name", e.target.value)} required />
            </Field>
            <Field id="email" label="Email" error={form.errors.email}>
              <Input id="email" type="email" value={form.data.email} onChange={(e) => form.setData("email", e.target.value)} />
            </Field>
            <Field id="phone" label="WhatsApp (tidak diubah)" className="sm:col-span-2">
              <Input id="phone" value={customer.phone} disabled className="font-mono" />
            </Field>
            <Field id="default_address_line1" label="Alamat" error={form.errors.default_address_line1} className="sm:col-span-2">
              <Input
                id="default_address_line1"
                value={form.data.default_address_line1}
                onChange={(e) => form.setData("default_address_line1", e.target.value)}
              />
            </Field>
            <Field id="default_address_line2" label="Alamat 2" error={form.errors.default_address_line2} className="sm:col-span-2">
              <Input
                id="default_address_line2"
                value={form.data.default_address_line2}
                onChange={(e) => form.setData("default_address_line2", e.target.value)}
              />
            </Field>
            <Field id="default_city" label="Kota" error={form.errors.default_city}>
              <Input id="default_city" value={form.data.default_city} onChange={(e) => form.setData("default_city", e.target.value)} />
            </Field>
            <Field id="default_province" label="Provinsi" error={form.errors.default_province}>
              <Input
                id="default_province"
                value={form.data.default_province}
                onChange={(e) => form.setData("default_province", e.target.value)}
              />
            </Field>
            <Field id="default_postal_code" label="Kode pos" error={form.errors.default_postal_code}>
              <Input
                id="default_postal_code"
                value={form.data.default_postal_code}
                onChange={(e) => form.setData("default_postal_code", e.target.value)}
              />
            </Field>
            <Field id="default_country" label="Negara" error={form.errors.default_country}>
              <Input
                id="default_country"
                value={form.data.default_country}
                onChange={(e) => form.setData("default_country", e.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button asChild type="button" variant="secondary">
              <Link href={backUrl}>Batal</Link>
            </Button>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm xl:sticky xl:top-24">
          <h3 className="text-base font-bold">Riwayat pesanan</h3>
          {orders.length ? (
            <ul className="mt-4 space-y-3">
              {orders.map((order) => (
                <li key={order.id} className="rounded-md border border-border p-3 text-sm">
                  <Link href={order.href} className="font-semibold text-primary hover:underline">
                    {order.order_number}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.order_status} · {order.payment_status}
                  </p>
                  <p className="mt-1 tabular-nums font-semibold">{formatCurrency(order.total_amount)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {order.created_at ? formatDate(order.created_at) : "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Belum ada pesanan.</p>
          )}
        </aside>
      </form>
    </AdminLayout>
  )
}
