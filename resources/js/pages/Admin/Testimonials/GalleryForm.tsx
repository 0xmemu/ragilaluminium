import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

interface GalleryRecord {
  id: number
  label?: string | null
  image_url: string
  sort_order: number
  published: boolean
}

export default function GalleryForm({
  item,
  submitUrl,
  indexUrl,
}: {
  item: GalleryRecord | null
  submitUrl: string
  indexUrl: string
}) {
  const editing = Boolean(item)
  const form = useForm({
    label: item?.label ?? "",
    image_url: item?.image_url ?? "",
    sort_order: item?.sort_order ?? 0,
    published: item?.published ?? true,
  })

  return (
    <AdminLayout
      title={editing ? "Edit ulasan foto" : "Tambah ulasan foto"}
      description="Foto hasil pemasangan untuk beranda dan halaman /reviews#hasil-pemasangan."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Ulasan Foto | Admin`} />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="mx-auto max-w-3xl space-y-6"
      >
        <FormErrorSummary errors={form.errors} />
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Stripe: thumbnail kiri, field inline kanan */}
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
            <div className="size-24 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
              {form.data.image_url ? (
                <img src={form.data.image_url} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground/60">
                  <span className="text-[10px]">Tanpa gambar</span>
                </div>
              )}
            </div>
            <div className="grid min-w-0 flex-1 gap-4">
              <Field id="gallery-label" label="Label" error={form.errors.label}>
                <Input
                  value={form.data.label}
                  onChange={(event) => form.setData("label", event.target.value)}
                  placeholder="Contoh: Pemasangan Bpk. Ahmad – Perumahan Kudus Indah"
                />
              </Field>
              <Field id="gallery-image" label="URL gambar" required error={form.errors.image_url}>
                <Input
                  type="url"
                  value={form.data.image_url}
                  onChange={(event) => form.setData("image_url", event.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
                <Field id="gallery-sort" label="Urutan" error={form.errors.sort_order} className="w-28">
                  <Input
                    type="number"
                    min="0"
                    value={form.data.sort_order}
                    onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                  />
                </Field>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={form.data.published}
                    onChange={(event) => form.setData("published", event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Tampilkan di storefront
                </label>
              </div>
            </div>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={indexUrl}>Batal</Link></Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan foto"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
