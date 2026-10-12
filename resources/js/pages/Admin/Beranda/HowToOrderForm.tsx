import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"
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


  // Kontrak halaman pengaturan (ADR-023): halaman yang tugasnya mengubah nilai
  // yang sudah ada dibuka terkunci. Isian baru bisa diubah setelah admin
  // menekan Edit, supaya setelan tidak rawan tersunting tanpa sengaja saat
  // halaman cuma dibuka untuk melihat kondisi sekarang.
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = mode === "view"

  function batal() {
    // Jangan router.reload(): Inertia di repo ini mempertahankan state sehingga
    // mode edit bertahan walau sudah dibatalkan.
    form.resetAndClearErrors()
    setMode("view")
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {mode === "view" ? (
            <Button type="button" size="sm" onClick={() => setMode("edit")}>
              <Icon name="pencil" className="size-3.5" aria-hidden="true" />
              Edit
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={batal}>
                Batal
              </Button>
              <Button type="submit" form="howto-form" size="sm" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Simpan"}
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title="Edit Cara Pesan | Admin" />
      <form
        id="howto-form"
        className="w-full max-w-4xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl, {
            preserveScroll: true,
            onSuccess: () => {
              // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
              form.setDefaults()
              setMode("view")
            },
          })
        }}
      >
        <FormErrorSummary errors={form.errors} />
        <SectionCard
          title="Identitas Section"
          description="Judul dan subjudul yang tampil di atas daftar langkah pada beranda publik."
        >
          <div className="space-y-4">
          <Field id="howto-title" label="Judul section" required error={form.errors.title}>
            <Input disabled={terkunci} value={form.data.title} onChange={(event) => form.setData("title", event.target.value)} />
          </Field>
          <Field id="howto-subtitle" label="Subjudul" error={form.errors.subtitle}>
            <Input disabled={terkunci} value={form.data.subtitle} onChange={(event) => form.setData("subtitle", event.target.value)} />
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
                  disabled={terkunci || form.data.steps.length <= 1}
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
                  <Input disabled={terkunci} value={step.title} onChange={(event) => updateStep(index, { title: event.target.value })} />
                </Field>
                <Field id={`step-desc-${index}`} label="Deskripsi langkah">
                  <Textarea
                    disabled={terkunci}
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
            disabled={terkunci || form.data.steps.length >= 8}
            onClick={() => form.setData("steps", [...form.data.steps, { title: "", description: "" }])}
          >
            Tambah
          </Button>
        </SectionCard>

      </form>
    </AdminLayout>
  )
}
