import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface HighlightItem {
  icon: string
  title: string
  description: string
}

export default function ServiceHighlightsForm({
  highlights,
  iconOptions,
  submitUrl,
  indexUrl,
}: {
  highlights: { title: string; subtitle: string; items: HighlightItem[] }
  iconOptions: string[]
  submitUrl: string
  indexUrl: string
}) {
  const form = useForm({
    title: highlights.title,
    subtitle: highlights.subtitle,
    items: highlights.items.length
      ? highlights.items
      : [{ icon: "check", title: "", description: "" }],
  })

  function updateItem(index: number, patch: Partial<HighlightItem>) {
    form.setData(
      "items",
      form.data.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    )
  }

  return (
    <AdminLayout
      title="Edit Sorotan Layanan"
      description="Konten keunggulan layanan di beranda publik."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Kembali</Link>
        </Button>
      }
    >
      <Head title="Edit Sorotan Layanan | Admin" />
      <form
        className="mx-auto max-w-3xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />
        <section className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <Field id="highlights-title" label="Judul section" required error={form.errors.title}>
            <Input value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
          </Field>
          <Field id="highlights-subtitle" label="Subjudul" error={form.errors.subtitle}>
            <Input value={form.data.subtitle} onChange={(event) => form.setData("subtitle", event.target.value)} />
          </Field>
        </section>

        <section className="space-y-3">
          {form.data.items.map((item, index) => (
            <article key={index} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Item {index + 1}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs text-destructive"
                  disabled={form.data.items.length <= 1}
                  onClick={() =>
                    form.setData(
                      "items",
                      form.data.items.filter((_, i) => i !== index),
                    )
                  }
                >
                  Hapus
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id={`item-icon-${index}`} label="Ikon">
                  <Select value={item.icon} onChange={(event) => updateItem(index, { icon: event.target.value })}>
                    {iconOptions.map((icon) => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </Select>
                </Field>
                <Field id={`item-title-${index}`} label="Judul" className="sm:col-span-2">
                  <Input value={item.title} onChange={(event) => updateItem(index, { title: event.target.value })} />
                </Field>
                <Field id={`item-desc-${index}`} label="Deskripsi" className="sm:col-span-3">
                  <Input
                    value={item.description}
                    onChange={(event) => updateItem(index, { description: event.target.value })}
                  />
                </Field>
              </div>
            </article>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={form.data.items.length >= 8}
            onClick={() =>
              form.setData("items", [...form.data.items, { icon: "check", title: "", description: "" }])
            }
          >
            Tambah item
          </Button>
        </section>

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary"><Link href={indexUrl}>Batal</Link></Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
