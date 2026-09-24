import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

function todayDateString(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDaysDateString(base: string | null | undefined, days: number): string {
  const date = base ? new Date(base) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const target = new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
}

interface AnnouncementFormData {
  id?: number
  text: string
  href?: string | null
  starts_at?: string | null
  ends_at?: string | null
  sort_order: number
  published: boolean
}

export default function AnnouncementForm({
  announcement,
  submitUrl,
  method,
  indexHref,
}: {
  announcement: AnnouncementFormData | null
  submitUrl: string
  method: "post" | "put"
  indexHref: string
}) {
  const isEdit = Boolean(announcement?.id)
  const form = useForm<{
    text: string
    href: string
    starts_at: string
    ends_at: string
    sort_order: number
    published: boolean
  }>({
    text: announcement?.text ?? "",
    href: announcement?.href ?? "",
    starts_at: announcement?.starts_at ?? "",
    ends_at: announcement?.ends_at ?? "",
    sort_order: announcement?.sort_order ?? 0,
    published: announcement?.published ?? true,
  })

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put" }))
      form.post(submitUrl, {
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }
    form.post(submitUrl, { preserveScroll: true })
  }

  return (
    <AdminLayout
      backUrl={indexHref}
      title={isEdit ? "Edit Bar Promo" : "Tambah Bar Promo"}
      description="Teks promo pada bar merah di atas header storefront (homepage)."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexHref}>Batal</Link>
          </Button>
          <Button type="submit" form="announcement-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
          </Button>
        </div>
      }
    >
      <Head title={`${isEdit ? "Edit" : "Tambah"} Bar Promo | Admin`} />

      <form id="announcement-form" onSubmit={onSubmit} className="w-full max-w-4xl space-y-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <FieldGrid className="p-5 sm:p-6">
            <Field
              id="text"
              label="Teks promo"
              error={form.errors.text}
              hint="Maksimal 64 karakter agar tetap ringkas di mobile."
            >
              <Input
                value={form.data.text}
                onChange={(event) => form.setData("text", event.target.value)}
                placeholder="Mis. Diskon sampai 30% untuk semua model"
                maxLength={64}
              />
            </Field>
            <Field
              id="href"
              label="Link tujuan / produk terkait"
              error={form.errors.href}
              hint="Path internal (mis. /products/boven/jungkit) atau URL penuh. Kosongkan untuk arahkan ke katalog."
            >
              <Input
                value={form.data.href}
                onChange={(event) => form.setData("href", event.target.value)}
                placeholder="/products/boven/jungkit"
              />
            </Field>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="starts" className="text-xs font-semibold">
                  Mulai (Opsional)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const today = todayDateString()
                    form.setData("starts_at", today)
                    if (!form.data.ends_at) {
                      form.setData("ends_at", addDaysDateString(today, 7))
                    }
                  }}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Mulai Hari Ini
                </button>
              </div>
              <Input
                id="starts"
                type="date"
                value={form.data.starts_at}
                onChange={(event) => form.setData("starts_at", event.target.value)}
              />
              {form.errors.starts_at && <p className="text-xs text-destructive">{form.errors.starts_at}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="ends" className="text-xs font-semibold">
                  Berakhir (Kustom)
                </label>
                <span className="text-[10px] text-muted-foreground">Pilih tanggal kustom</span>
              </div>
              <Input
                id="ends"
                type="date"
                value={form.data.ends_at}
                onChange={(event) => form.setData("ends_at", event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                <span className="text-muted-foreground">Preset cepat:</span>
                {[
                  { label: "+3 Hari", days: 3 },
                  { label: "+7 Hari", days: 7 },
                  { label: "+14 Hari", days: 14 },
                  { label: "+30 Hari", days: 30 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      const base = form.data.starts_at || todayDateString()
                      form.setData("ends_at", addDaysDateString(base, preset.days))
                    }}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
                  >
                    {preset.label}
                  </button>
                ))}
                {form.data.ends_at && (
                  <button
                    type="button"
                    onClick={() => form.setData("ends_at", "")}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Kosongkan
                  </button>
                )}
              </div>
              {form.errors.ends_at && <p className="text-xs text-destructive">{form.errors.ends_at}</p>}
            </div>
            <Field id="sort" label="Urutan tampil" error={form.errors.sort_order} className="sm:max-w-40">
              <Input
                type="number"
                min={0}
                max={9999}
                value={form.data.sort_order}
                onChange={(event) => form.setData("sort_order", Number(event.target.value))}
              />
            </Field>
            <CheckboxField
              id="announcement-published"
              checked={form.data.published}
              onChange={(checked) => form.setData("published", checked)}
              label="Status aktif (published)"
            />
          </FieldGrid>
        </section>

        
      </form>
    </AdminLayout>
  )
}
