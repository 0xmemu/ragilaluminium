import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
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
  nextSortOrder = 1,
  submitUrl,
  method,
  indexHref,
}: {
  announcement: AnnouncementFormData | null
  /** Nomor urut usulan untuk baris baru (selalu di bawah baris yang sudah ada). */
  nextSortOrder?: number
  submitUrl: string
  method: "post" | "put"
  indexHref: string
}) {
  const isEdit = Boolean(announcement?.id)
  // Urutan tampil dan status aktif TIDAK ditampilkan di form (owner 2026-09-29):
  // urutan diatur lewat mode Urutkan di daftar, status lewat aksi
  // Aktifkan/Sembunyikan. Nilainya tetap ikut terkirim dari nilai awal supaya
  // perilakunya tidak berubah: baris baru tetap di bawah dan aktif, dan
  // menyunting teks tidak mengubah urutan atau menonaktifkan baris.
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
    sort_order: announcement?.sort_order ?? nextSortOrder,
    published: announcement?.published ?? true,
  })

  // Pola sama dengan form Promo Toko ("Waktu berlaku"): periode dipilih lebih
  // dulu, pemilih tanggal baru muncul saat dijadwalkan (owner 2026-09-29).
  // Sebelumnya tanggal langsung terlihat walau periodenya memang opsional.
  const [mode, setMode] = React.useState<"always" | "scheduled">(
    announcement?.starts_at || announcement?.ends_at ? "scheduled" : "always",
  )

  function pilihMode(next: "always" | "scheduled") {
    setMode(next)
    if (next === "always") {
      form.setData("starts_at", "")
      form.setData("ends_at", "")
      return
    }
    if (!form.data.starts_at) {
      form.setData("starts_at", todayDateString())
    }
  }

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

  const presetTanggal = [
    { label: "+3 hari", days: 3 },
    { label: "+7 hari", days: 7 },
    { label: "+14 hari", days: 14 },
    { label: "+30 hari", days: 30 },
  ]

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

      <form id="announcement-form" onSubmit={onSubmit} className="w-full space-y-6">
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <FieldGrid className="p-5 sm:p-6">
            <Field id="text" label="Teks promo" error={form.errors.text} required>
              <Input
                value={form.data.text}
                onChange={(event) => form.setData("text", event.target.value)}
                placeholder="Mis. Diskon sampai 30% untuk semua model"
                maxLength={64}
              />
            </Field>
            <Field id="href" label="Link tujuan" error={form.errors.href} hint="Kosongkan untuk arahkan ke katalog.">
              <Input
                value={form.data.href}
                onChange={(event) => form.setData("href", event.target.value)}
                placeholder="/products/boven/jungkit"
              />
            </Field>

            <div className="grid min-w-0 content-start gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-foreground">Periode tampil</span>
              <div className="flex w-fit items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
                <button
                  type="button"
                  onClick={() => pilihMode("always")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    mode === "always"
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Selalu tampil
                </button>
                <button
                  type="button"
                  onClick={() => pilihMode("scheduled")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    mode === "scheduled"
                      ? "bg-card font-semibold text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Jadwalkan periode
                </button>
              </div>
            </div>

            {mode === "scheduled" ? (
              <>
                <Field id="starts_at" label="Mulai" error={form.errors.starts_at}>
                  <Input
                    type="date"
                    value={form.data.starts_at}
                    onChange={(event) => form.setData("starts_at", event.target.value)}
                  />
                </Field>
                <Field id="ends_at" label="Berakhir" error={form.errors.ends_at}>
                  <Input
                    type="date"
                    value={form.data.ends_at}
                    onChange={(event) => form.setData("ends_at", event.target.value)}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
                  {presetTanggal.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        form.setData("ends_at", addDaysDateString(form.data.starts_at || todayDateString(), preset.days))
                      }
                      className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-muted"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {form.data.ends_at ? (
                    <button
                      type="button"
                      onClick={() => form.setData("ends_at", "")}
                      className="rounded border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
                    >
                      Kosongkan berakhir
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </FieldGrid>
        </section>
      </form>
    </AdminLayout>
  )
}
