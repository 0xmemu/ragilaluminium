import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface RecordItem {
  id: number
  problem: string
  solution: string
  sort_order: number
}

export default function MasalahSolusiForm({
  item,
  submitUrl,
  indexUrl,
}: {
  item: RecordItem | null
  submitUrl: string
  indexUrl: string
}) {
  const editing = Boolean(item)
  const form = useForm({
    problem: item?.problem ?? "",
    solution: item?.solution ?? "",
    sort_order: item?.sort_order ?? 0,
  })

  return (
    <AdminLayout
      title={editing ? "Edit Masalah & Solusi" : "Tambah Masalah & Solusi"}
      description="Kolom kiri: kendala pelanggan. Kolom kanan: rekomendasi solusi Ragil."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Batal</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Masalah & Solusi | Admin`} />
      <form
        className="mx-auto max-w-5xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />
        <section className="grid gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7 lg:grid-cols-2">
          <Field id="ms-problem" label="Masalah / kendala" required error={form.errors.problem}>
            <Textarea
              rows={10}
              value={form.data.problem}
              onChange={(event) => form.setData("problem", event.target.value)}
              placeholder="Contoh: Kayu jendela cepat lapuk karena hujan…"
            />
          </Field>
          <Field id="ms-solution" label="Solusi / rekomendasi" required error={form.errors.solution}>
            <Textarea
              rows={10}
              value={form.data.solution}
              onChange={(event) => form.setData("solution", event.target.value)}
              placeholder="Contoh: Gunakan jendela aluminium anti rayap dengan kaca 5 mm…"
            />
          </Field>
          <Field id="ms-sort" label="Urutan" error={form.errors.sort_order} className="lg:col-span-2">
            <Input
              type="number"
              min={0}
              value={form.data.sort_order}
              onChange={(event) => form.setData("sort_order", Number(event.target.value))}
              className="max-w-xs"
            />
          </Field>
        </section>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
