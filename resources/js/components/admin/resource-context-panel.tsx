import { Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { routeUrl } from "@/lib/routes"
import type { ResourceRow } from "@/types"

function PaymentRowControl({ row }: { row: ResourceRow }) {
  const form = useForm({ status: String(row.status ?? "pending") })

  return (
    <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_11rem_auto] sm:items-end">
      <div>
        <p className="font-mono text-xs font-semibold">Payment #{String(row.id)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {String(row.payment_method)} · {String(row.amount)}
        </p>
      </div>
      <Field id={`payment-row-status-${String(row.id)}`} label="Status" error={form.errors.status}>
        <Select value={form.data.status} onChange={(event) => form.setData("status", event.target.value)}>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
      </Field>
      <Button
        variant="secondary"
        onClick={() =>
          form.put(routeUrl("admin.payments.update", { payment: Number(row.id) }), {
            preserveScroll: true,
          })
        }
        disabled={form.processing}
      >
        Simpan
      </Button>
    </div>
  )
}

function PaymentManager({ orderId, rows }: { orderId: string; rows: ResourceRow[] }) {
  const form = useForm({
    payment_method: "transfer",
    amount: "",
    status: "pending",
    transaction_reference: "",
    evidence_url: "",
    paid_at: "",
  })

  return (
    <section className="mb-6 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      {rows.length ? (
        <div>
          <div className="border-b border-border p-5">
            <h2 className="text-lg font-semibold">Perbarui pembayaran</h2>
          </div>
          {rows.map((row) => <PaymentRowControl key={String(row.id)} row={row} />)}
        </div>
      ) : null}
      <details>
        <summary className="cursor-pointer list-none p-5 text-lg font-semibold">
          + Catat pembayaran baru
        </summary>
        <form
        onSubmit={(event) => {
          event.preventDefault()
          form.post(routeUrl("admin.payments.store", { order: orderId }), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
          })
        }}
        className="grid gap-4 border-t border-border p-5 md:grid-cols-2 xl:grid-cols-3"
        >
        <FormErrorSummary errors={form.errors} className="md:col-span-2 xl:col-span-3" />
        <Field id="index-payment-method" label="Metode" required error={form.errors.payment_method}>
          <Select value={form.data.payment_method} onChange={(event) => form.setData("payment_method", event.target.value)}>
            <option value="cod">COD</option>
            <option value="transfer">Transfer</option>
            <option value="gateway">Gateway</option>
          </Select>
        </Field>
        <Field id="index-payment-amount" label="Jumlah" required error={form.errors.amount}>
          <Input type="number" min="0" value={form.data.amount} onChange={(event) => form.setData("amount", event.target.value)} />
        </Field>
        <Field id="index-payment-status" label="Status" required error={form.errors.status}>
          <Select value={form.data.status} onChange={(event) => form.setData("status", event.target.value)}>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
        </Field>
        <Field id="index-payment-reference" label="Referensi" error={form.errors.transaction_reference}>
          <Input value={form.data.transaction_reference} onChange={(event) => form.setData("transaction_reference", event.target.value)} />
        </Field>
        <Field id="index-payment-evidence" label="URL bukti" error={form.errors.evidence_url}>
          <Input type="url" value={form.data.evidence_url} onChange={(event) => form.setData("evidence_url", event.target.value)} />
        </Field>
        <Field id="index-payment-paid-at" label="Waktu dibayar" error={form.errors.paid_at}>
          <Input type="datetime-local" value={form.data.paid_at} onChange={(event) => form.setData("paid_at", event.target.value)} />
        </Field>
        <div className="md:col-span-2 xl:col-span-3">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Catat pembayaran"}
          </Button>
        </div>
        </form>
      </details>
    </section>
  )
}

function BrandingManager() {
  const form = useForm<{ logo: File | null; favicon: File | null }>({
    logo: null,
    favicon: null,
  })

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.banners.index")}>Kelola banner beranda</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.testimonials.index")}>Kelola ulasan</Link>
        </Button>
      </div>
      <details className="rounded-lg border border-border bg-surface shadow-sm">
      <summary className="cursor-pointer list-none p-5 text-lg font-semibold">
        + Unggah aset brand resmi
      </summary>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          form.post(routeUrl("admin.pages.branding"), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
          })
        }}
        className="grid gap-4 border-t border-border p-5 sm:grid-cols-2"
      >
        <FormErrorSummary errors={form.errors} className="sm:col-span-2" />
        <Field id="branding-logo" label="Logo" error={form.errors.logo} hint="JPEG, PNG, GIF, SVG, atau WebP. Maksimal 5 MB.">
          <Input type="file" accept=".jpeg,.jpg,.png,.gif,.svg,.webp" onChange={(event) => form.setData("logo", event.target.files?.[0] ?? null)} />
        </Field>
        <Field id="branding-favicon" label="Favicon" error={form.errors.favicon} hint="ICO atau PNG. Maksimal 2 MB.">
          <Input type="file" accept=".ico,.png" onChange={(event) => form.setData("favicon", event.target.files?.[0] ?? null)} />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={form.processing || (!form.data.logo && !form.data.favicon)}>
            {form.processing ? "Mengunggah..." : "Simpan branding"}
          </Button>
        </div>
      </form>
      </details>
    </div>
  )
}

export function ResourceContextPanel({ rows }: { rows: ResourceRow[] }) {
  const current = route().current()
  const params = route().params as Record<string, string>

  if (current === "admin.orders.payments" && params.order) {
    return <PaymentManager orderId={params.order} rows={rows} />
  }

  if (current === "admin.pages.index") {
    return <BrandingManager />
  }

  return null
}
