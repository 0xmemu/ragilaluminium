import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { Textarea } from "@/components/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"

interface TemplatePayload {
  id: number
  internal_key: string
  label: string
  provider_template_name: string
  language_code: string
  category: string
  status: string
  body_preview: string
}

interface VariableChip {
  token: string
  label: string
}

export default function WhatsAppEdit({
  title,
  description,
  template,
  variables = [],
  submitUrl,
  backUrl,
  activateUrl,
  deactivateUrl,
}: {
  title: string
  description: string
  template: TemplatePayload
  variables: VariableChip[]
  submitUrl: string
  backUrl: string
  activateUrl: string
  deactivateUrl: string
}) {
  const form = useForm({
    provider_template_name: template.provider_template_name,
    language_code: template.language_code,
    body_preview: template.body_preview,
  })
  const statusForm = useForm({})
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  function insertVariable(token: string) {
    const el = textareaRef.current
    const current = form.data.body_preview ?? ""
    if (!el) {
      form.setData("body_preview", `${current}${token}`)
      return
    }
    const start = el.selectionStart ?? current.length
    const end = el.selectionEnd ?? current.length
    const next = current.slice(0, start) + token + current.slice(end)
    form.setData("body_preview", next)
    requestAnimationFrame(() => {
      el.focus()
      const caret = start + token.length
      el.setSelectionRange(caret, caret)
    })
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl, { preserveScroll: true })
  }

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={<StatusBadge status={template.status === "active" ? "active" : "inactive"} />}
    >
      <Head title={`${title} | Admin`} />

      <div className="mb-4">
        <Button asChild variant="secondary">
          <Link href={backUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke WhatsApp Otomatis
          </Link>
        </Button>
      </div>

      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <section className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
          <FormErrorSummary errors={form.errors} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="provider_template_name" label="Nama template provider (Meta/BSP)" required error={form.errors.provider_template_name}>
              <Input
                id="provider_template_name"
                value={form.data.provider_template_name}
                onChange={(event) => form.setData("provider_template_name", event.target.value)}
                className="font-mono"
                required
              />
            </Field>
            <Field id="language_code" label="Kode bahasa" required error={form.errors.language_code}>
              <Input
                id="language_code"
                value={form.data.language_code}
                onChange={(event) => form.setData("language_code", event.target.value)}
                required
              />
            </Field>
          </div>

          <Field
            id="body_preview"
            label="Pratinjau isi pesan (naskah Meta)"
            error={form.errors.body_preview}
            hint="Salin teks ini ke WhatsApp Manager. Variabel harus {{1}}, {{2}}, … (jenis Nomor). Pengiriman production memakai template yang sudah Approved di Meta."
          >
            <Textarea
              id="body_preview"
              ref={textareaRef}
              rows={16}
              value={form.data.body_preview}
              onChange={(event) => form.setData("body_preview", event.target.value)}
              className="font-mono text-sm leading-6"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan perubahan"}
            </Button>
            <Button
              type="button"
              variant={template.status === "active" ? "destructive" : "secondary"}
              disabled={statusForm.processing}
              onClick={() =>
                statusForm.post(template.status === "active" ? deactivateUrl : activateUrl, {
                  preserveScroll: true,
                })
              }
            >
              {template.status === "active" ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </div>
        </section>

        <aside className="rounded-lg border border-border bg-surface p-5 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-base font-bold">Urutan variabel Meta</h2>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            Klik token untuk sisipkan ke pratinjau. Urutan ini sama dengan parameter yang dikirim backend — jangan ganti jadi nama seperti {"{{order_number}}"}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {variables.map((variable) => (
              <button
                key={variable.token}
                type="button"
                onClick={() => insertVariable(variable.token)}
                className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-left text-xs font-semibold text-foreground hover:border-primary hover:text-primary"
              >
                <span className="font-mono">{variable.token}</span>
                <span className="mt-0.5 block font-medium text-muted-foreground">{variable.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">Key: {template.internal_key}</p>
        </aside>
      </form>
    </AdminLayout>
  )
}
