import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { PeriodeField, type PeriodeMode, type PeriodePreset } from "@/components/admin/ui/period-field"
import AdminLayout from "@/layouts/admin-layout"
import { todayDateString } from "@/lib/period"

const PRESET_TANGGAL: PeriodePreset[] = [
  { label: "+3 hari", days: 3 },
  { label: "+7 hari", days: 7 },
  { label: "+14 hari", days: 14 },
  { label: "+30 hari", days: 30 },
]

const MODE_PERIODE = [
  { value: "always" as const, label: "Selalu tampil" },
  { value: "scheduled" as const, label: "Jadwalkan periode" },
]

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

  // Periode dipilih lebih dulu; kotak tanggal baru muncul saat dijadwalkan.
  const [mode, setMode] = React.useState<PeriodeMode>(
    announcement?.starts_at || announcement?.ends_at ? "scheduled" : "always",
  )

  function ubahMode(next: PeriodeMode) {
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
            <Field
              id="text"
              label="Teks promo"
              error={form.errors.text}
              required
              hint="Rekomendasi maksimal 40 karakter agar utuh di ponsel; di desktop 64 karakter (batas kolom) masih tampil."
            >
              <Input
                value={form.data.text}
                onChange={(event) => form.setData("text", event.target.value)}
                placeholder="Mis. Diskon sampai 30% untuk semua model"
                maxLength={64}
              />
            </Field>
            <Field id="href" label="Link tujuan" error={form.errors.href}>
              <Input
                value={form.data.href}
                onChange={(event) => form.setData("href", event.target.value)}
                placeholder="/products/boven/jungkit"
              />
            </Field>

            <PeriodeField
              className="sm:col-span-2"
              mode={mode}
              onModeChange={ubahMode}
              modeOptions={MODE_PERIODE}
              startsAt={form.data.starts_at}
              endsAt={form.data.ends_at}
              onStartsAtChange={(value) => form.setData("starts_at", value)}
              onEndsAtChange={(value) => form.setData("ends_at", value)}
              presets={PRESET_TANGGAL}
              errors={{ starts_at: form.errors.starts_at, ends_at: form.errors.ends_at }}
              alwaysNote="Bar promo tampil terus selama aktif, tanpa tanggal mulai maupun berakhir."
            />
          </FieldGrid>
        </section>
      </form>
    </AdminLayout>
  )
}
