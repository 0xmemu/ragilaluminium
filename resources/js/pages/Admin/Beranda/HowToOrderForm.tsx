import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface StepItem {
  title: string
  description: string
}

export default function HowToOrderForm({
  howToOrder,
  submitUrl,
  indexUrl,
}: {
  howToOrder: { title: string; subtitle: string; steps: StepItem[] }
  submitUrl: string
  indexUrl: string
}) {
  const form = useForm({
    title: howToOrder.title,
    subtitle: howToOrder.subtitle,
    steps: howToOrder.steps.length ? howToOrder.steps : [{ title: "", description: "" }],
  })

  function updateStep(index: number, patch: Partial<StepItem>) {
    form.setData(
      "steps",
      form.data.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    )
  }

  return (
    <AdminLayout
      title="Edit Cara Pesan Jendela Anda"
      description="Langkah pemesanan yang tampil di beranda publik."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>Kembali</Link>
        </Button>
      }
    >
      <Head title="Edit Cara Pesan | Admin" />
      <form
        className="mx-auto max-w-3xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />
        <section className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <Field id="howto-title" label="Judul section" required error={form.errors.title}>
            <Input value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
          </Field>
          <Field id="howto-subtitle" label="Subjudul" error={form.errors.subtitle}>
            <Input value={form.data.subtitle} onChange={(event) => form.setData("subtitle", event.target.value)} />
          </Field>
        </section>

        <section className="space-y-3">
          {form.data.steps.map((step, index) => (
            <article key={index} className="rounded-lg border border-border bg-surface p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold">Langkah {index + 1}</p>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs text-destructive"
                  disabled={form.data.steps.length <= 1}
                  onClick={() =>
                    form.setData(
                      "steps",
                      form.data.steps.filter((_, i) => i !== index),
                    )
                  }
                >
                  Hapus
                </Button>
              </div>
              <div className="grid gap-3">
                <Field id={`step-title-${index}`} label="Judul langkah">
                  <Input value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} />
                </Field>
                <Field id={`step-desc-${index}`} label="Deskripsi langkah">
                  <Textarea
                    rows={3}
                    value={step.description}
                    onChange={(event) => updateStep(index, { description: event.target.value })}
                  />
                </Field>
              </div>
            </article>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={form.data.steps.length >= 8}
            onClick={() => form.setData("steps", [...form.data.steps, { title: "", description: "" }])}
          >
            Tambah langkah
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
