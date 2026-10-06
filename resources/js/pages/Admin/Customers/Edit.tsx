import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { PrintCustomerArea, usePrintCustomer } from "@/components/shared/print-customer-detail"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"

interface CustomerForm {
  id: number
  code: string
  name: string
  phone: string
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

type Mode = "view" | "edit"

/** Nilai kosong tetap ditampilkan sebagai keterangan, bukan ruang hampa. */
function NilaiKosong() {
  return <span className="text-muted-foreground">Belum diisi</span>
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
  const { printing, handlePrint } = usePrintCustomer()

  // Kontrak ADR-023: halaman yang tugasnya mengubah nilai yang sudah ada dibuka
  // dalam mode RINGKASAN, bukan form langsung aktif. Tombol Simpan baru muncul
  // setelah admin menekan tombol kerja "Ubah data pelanggan", supaya data
  // pelanggan tidak bisa berubah hanya karena halaman ini dibuka.
  const [mode, setMode] = React.useState<Mode>("view")

  const form = useForm({
    name: customer.name,
    default_address_line1: customer.default_address_line1 ?? "",
    default_address_line2: customer.default_address_line2 ?? "",
    default_city: customer.default_city ?? "",
    default_province: customer.default_province ?? "",
    default_postal_code: customer.default_postal_code ?? "",
    default_country: customer.default_country ?? "Indonesia",
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl, {
      preserveScroll: true,
      preserveState: true,
      // Simpan sukses kembali ke ringkasan; nilai tersimpan dijadikan titik
      // kembali supaya tombol Batal pada sesi berikutnya tidak mengembalikan
      // ke nilai saat halaman pertama dimuat.
      onSuccess: () => {
        form.setDefaults()
        setMode("view")
      },
    })
  }

  function batal() {
    // Buang isian yang belum disimpan lalu tutup mode edit.
    form.resetAndClearErrors()
    setMode("view")
  }

  /** Baris bacaan satu nilai alamat/kontak di mode ringkasan. */
  function baris(label: string, nilai: string | null | undefined, mono = false) {
    return (
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className={cn("mt-0.5 break-words text-sm text-foreground", mono && "font-mono")}>
          {nilai && nilai.trim() !== "" ? nilai : <NilaiKosong />}
        </dd>
      </div>
    )
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={backUrl}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={metrics.status.key} label={metrics.status.label} />
          <Button asChild variant="secondary" size="sm">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5">
              <Icon name="whatsapp" className="size-4" aria-hidden="true" />
              <span>Chat WA</span>
            </a>
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handlePrint} className="inline-flex items-center gap-1.5">
            <Icon name="printer" className="size-4" aria-hidden="true" />
            <span>Cetak</span>
          </Button>

          {mode === "view" ? (
            <Button type="button" size="sm" onClick={() => setMode("edit")} className="inline-flex items-center gap-1.5">
              <Icon name="pencil-simple" className="size-4" aria-hidden="true" />
              <span>Ubah data pelanggan</span>
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={batal}>
                Batal
              </Button>
              <Button type="submit" form="customer-form" size="sm" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Simpan"}
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={`${customer.name} | Customer | Admin`} />

      <section className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-12 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
              <Icon name="users" className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold">{customer.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="flex items-center gap-1">
                  <span className="font-mono text-sm text-muted-foreground">{customer.code}</span>
                  <CopyButton text={customer.code} label="Salin ID customer" compact showTextInTitle />
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-mono text-sm text-muted-foreground">{customer.phone}</span>
                  <CopyButton text={customer.phone} label="Salin nomor HP" compact showTextInTitle />
                </span>
              </div>
              {metrics.fraud.score >= 30 ? (
                <p className="mt-2 text-sm font-semibold text-warning-foreground">Nomor WhatsApp sedang diselidiki</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-md border border-border px-4 py-3 text-sm">
            <p className="text-xs font-semibold tracking-tight text-muted-foreground">Skor penipuan</p>
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
            <dd className="font-semibold">{metrics.last_order_at ? formatDate(metrics.last_order_at) : "-"}</dd>
          </div>
        </dl>
      </section>

      <div className="w-full max-w-5xl grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        {mode === "view" ? (
          /* Mode RINGKASAN: nilai yang berlaku dibaca sebagai teks, bukan input. */
          <SectionCard
            title="Data Pelanggan"
            description="Informasi kontak dan alamat pengiriman utama pelanggan."
          >
            <dl className="grid gap-4 sm:grid-cols-2">
              {baris("Nama lengkap", customer.name)}
              {baris("Nomor WhatsApp", customer.phone, true)}
              <div className="sm:col-span-2">
                {baris("Alamat", customer.default_address_line1)}
              </div>
              <div className="sm:col-span-2">
                {baris("Alamat 2", customer.default_address_line2)}
              </div>
              {baris("Kota", customer.default_city)}
              {baris("Provinsi", customer.default_province)}
              {baris("Kode pos", customer.default_postal_code)}
              {baris("Negara", customer.default_country)}
            </dl>
            <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
              Data di atas adalah kondisi yang tersimpan. Tekan{" "}
              <strong className="font-semibold text-foreground">Ubah data pelanggan</strong> untuk mengubahnya.
            </p>
          </SectionCard>
        ) : (
          <form id="customer-form" onSubmit={submit} className="min-w-0">
            <SectionCard title="Data Pelanggan" description="Informasi kontak dan alamat pengiriman utama pelanggan.">
              <FormErrorSummary errors={form.errors} className="mb-4" />
              <FieldGrid>
                <Field id="name" label="Nama lengkap" required error={form.errors.name}>
                  <Input id="name" value={form.data.name} onChange={(e) => form.setData("name", e.target.value)} required />
                </Field>
                <Field id="phone" label="Nomor WhatsApp (terkunci)">
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
              </FieldGrid>
            </SectionCard>
          </form>
        )}

        <aside className="space-y-4 xl:sticky xl:top-24">
          <SectionCard title="Riwayat Pesanan">
            {orders.length ? (
              <ul className="space-y-3">
                {orders.map((order) => (
                  <li key={order.id} className="rounded-md border border-border p-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Link href={order.href} className="font-semibold text-primary hover:underline">
                        {order.order_number}
                      </Link>
                      <CopyButton text={order.order_number} label="Salin nomor order" compact showTextInTitle />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {statusMeta(order.order_status).label} · {statusMeta(order.payment_status).label}
                    </p>
                    <p className="mt-1 tabular-nums font-semibold">{formatCurrency(order.total_amount)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {order.created_at ? formatDate(order.created_at) : "-"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
            )}
          </SectionCard>
        </aside>
      </div>

      {printing ? (
        <PrintCustomerArea
          data={{
            customer,
            metrics,
            orders,
          }}
        />
      ) : null}
    </AdminLayout>
  )
}
