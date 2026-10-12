import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import AdminLayout from "@/layouts/admin-layout"

import { Button } from "@/components/admin/ui/button"
import { Field } from "@/components/admin/ui/field"
import { Textarea } from "@/components/admin/ui/textarea"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"


export default function KontakForm({ title, fields }: { title: string; fields: Record<string, string> }) {
  const form = useForm({
    address: fields.address ?? "",
    phone: fields.phone ?? "",
    email: fields.email ?? "",
    hours: fields.hours ?? "",
    problems_content: fields.problems_content ?? "",
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

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(route("admin.beranda.kontak.update"), {
      preserveScroll: true,
      onSuccess: () => {
        // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
        form.setDefaults()
        setMode("view")
      },
    })
  }

  return (
    <AdminLayout
      title={title}
      description="Informasi kontak & masalah solusi yang tampil di halaman publik."
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
              <Button type="submit" form="kontak-form" size="sm" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Simpan"}
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={title} />
      <form id="kontak-form" onSubmit={submit} className="mx-auto max-w-4xl space-y-6">
        {Object.keys(form.errors).length > 0 ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">Perbaiki kesalahan berikut:</p>
            <ul className="mt-1 list-inside list-disc text-sm text-destructive">
              {Object.values(form.errors).map((err, i) => (
                <li key={i}>{String(err)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Informasi Kontak</h2>
          <Field id="kontak-address" label="Alamat" error={form.errors.address}>
            <Input disabled={terkunci} value={form.data.address} onChange={(event) => form.setData("address", event.target.value)} placeholder="Jl. Raya Aluminium No. 123, Semarang" />
          </Field>
          <Field id="kontak-phone" label="Telepon / WhatsApp" error={form.errors.phone}>
            <Input disabled={terkunci} value={form.data.phone} onChange={(event) => form.setData("phone", event.target.value)} placeholder="0812-3456-7890" />
          </Field>
          <Field id="kontak-email" label="Email" error={form.errors.email}>
            <Input disabled={terkunci} type="email" value={form.data.email} onChange={(event) => form.setData("email", event.target.value)} placeholder="info@ragilaluminium.com" />
          </Field>
          <Field id="kontak-hours" label="Jam Operasional" error={form.errors.hours}>
            <Input disabled={terkunci} value={form.data.hours} onChange={(event) => form.setData("hours", event.target.value)} placeholder="Senin - Sabtu: 08.00 - 17.00 WIB" />
          </Field>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Masalah & Solusi</h2>
          <p className="text-sm text-muted-foreground">Konten yang tampil di halaman /masalah-dan-solusi.</p>
          <Field id="kontak-problems" label="Konten masalah & solusi" error={form.errors.problems_content}>
            <Textarea disabled={terkunci} rows={8} value={form.data.problems_content} onChange={(event) => form.setData("problems_content", event.target.value)} placeholder="Deskripsi masalah dan solusi yang sering terjadi..." />
          </Field>
        </section>

        
      </form>
    </AdminLayout>
  )
}