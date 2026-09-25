import { Head, useForm } from "@inertiajs/react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
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
      backUrl={indexUrl}
      actions={
        <Button type="submit" form="howto-form" disabled={form.processing}>
          {form.processing ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <Head title="Edit Cara Pesan | Admin" />
      <form
        id="howto-form"
        className="w-full max-w-4xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl)
        }}
      >
        <FormErrorSummary errors={form.errors} />
        <SectionCard
          title="Identitas Section"
          description="Judul dan subjudul yang tampil di atas daftar langkah pada beranda publik."
        >
          <div className="space-y-4">
          <Field id="howto-title" label="Judul section" required error={form.errors.title}>
            <Input value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
          </Field>
          <Field id="howto-subtitle" label="Subjudul" error={form.errors.subtitle}>
            <Input value={form.data.subtitle} onChange={(event) => form.setData("subtitle", event.target.value)} />
          </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Langkah Pemesanan"
          description="Setiap langkah tampil berurutan di beranda publik, maksimal 8 langkah."
        >

          {form.data.steps.map((step, index) => (
            <SectionCard
              key={index}
              title={`Langkah ${index + 1}`}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  className="text-destructive"
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
              }
            >
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
            </SectionCard>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={form.data.steps.length >= 8}
            onClick={() => form.setData("steps", [...form.data.steps, { title: "", description: "" }])}
          >
            Tambah
          </Button>
        </SectionCard>

      </form>
    </AdminLayout>
  )
}
