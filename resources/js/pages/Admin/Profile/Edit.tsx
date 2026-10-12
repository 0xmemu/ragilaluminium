import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { Icon } from "@/components/shared/icon"
import { jagaGerbang } from "@/lib/submit-gate"
import AdminLayout from "@/layouts/admin-layout"

interface ProfileRecord {
  name: string
  username: string
  role_label: string
  status: string
}

export default function ProfileEdit({
  profile,
  submitUrl,
}: {
  profile: ProfileRecord
  submitUrl: string
}) {
  const form = useForm({
    name: profile.name,
    username: profile.username,
    current_password: "",
    password: "",
    password_confirmation: "",
  })

  // Kontrak halaman pengaturan (ADR-023): halaman yang tugasnya mengubah nilai
  // yang sudah ada dibuka terkunci. Isian baru bisa diubah setelah admin
  // menekan Edit, supaya data akun tidak rawan tersunting tanpa sengaja saat
  // halaman cuma dibuka untuk melihat.
  // Gerbang isi (kontrak "logika tombol"): kolom wajibnya mengikuti aturan
  // `required` ProfileController. Halaman ini selalu dalam keadaan menyunting
  // data yang sudah ada, jadi tombolnya juga menunggu sampai ada perubahan.
  const gerbang = {
    fields: { name: "Nama", username: "Username" },
    requireChange: true,
  }

  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const terkunci = mode === "view"

  function batal() {
    // Jangan router.reload(): Inertia di repo ini mempertahankan state sehingga
    // mode edit bertahan walau sudah dibatalkan.
    form.resetAndClearErrors()
    setMode("view")
  }

  return (
    <AdminLayout
      title="Profil Saya"
      description="Perbarui nama, username, dan password akun yang sedang login."
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
              <SubmitGateButton
                form={form} {...gerbang}
                formId="profile-form"
                label="Simpan"
                size="sm"
                processing={form.processing}
              />
            </>
          )}
        </div>
      }
    >
      <Head title="Profil Saya | Admin" />
      <form
        id="profile-form"
        onSubmit={jagaGerbang(gerbang, form, (event) => {
          event.preventDefault()
          form.put(submitUrl, {
            preserveScroll: true,
            onSuccess: () => {
              form.reset("current_password", "password", "password_confirmation")
              // Simpan berhasil = kondisi baru jadi acuan Batal berikutnya.
              form.setDefaults()
              setMode("view")
            },
          })
        })}
        className="w-full max-w-4xl space-y-6"
      >
        <FormErrorSummary errors={form.errors} />

        <SectionCard
          title="Identitas Akun"
          description="Semua admin setara; hak akses login diatur lewat status aktif/nonaktif."
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">{profile.role_label}</span>
              <StatusBadge status={profile.status} />
            </div>
          }
        >
          <FieldGrid>
            <Field id="profile-name" label="Nama" required error={form.errors.name}>
              <Input
              disabled={terkunci}
                value={form.data.name}
                onChange={(event) => form.setData("name", event.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field
              id="profile-username"
              label="Username"
              required
              error={form.errors.username}
              hint="Username digunakan untuk masuk ke panel admin."
            >
              <Input
              disabled={terkunci}
                value={form.data.username}
                onChange={(event) => form.setData("username", event.target.value.toLowerCase())}
                autoComplete="username"
              />
            </Field>
          </FieldGrid>
        </SectionCard>

        <SectionCard
          title="Ganti Password"
          description="Kosongkan jika password tidak diubah. Wajib isi password saat ini bila mengganti."
        >
          <div className="space-y-4">
            <Field id="profile-current-password" label="Password saat ini" error={form.errors.current_password}>
              <Input
              disabled={terkunci}
                type="password"
                value={form.data.current_password}
                onChange={(event) => form.setData("current_password", event.target.value)}
                autoComplete="current-password"
                placeholder="Masukkan password saat ini untuk konfirmasi"
              />
            </Field>

            <FieldGrid>
              <Field
                id="profile-password"
                label="Password baru"
                error={form.errors.password}
                hint="Minimal 8 karakter."
              >
                <Input
                disabled={terkunci}
                  type="password"
                  value={form.data.password}
                  onChange={(event) => form.setData("password", event.target.value)}
                  autoComplete="new-password"
                  placeholder="Password baru"
                />
              </Field>

              <Field
                id="profile-password-confirmation"
                label="Ulangi password baru"
                error={form.errors.password_confirmation}
              >
                <Input
                disabled={terkunci}
                  type="password"
                  value={form.data.password_confirmation}
                  onChange={(event) => form.setData("password_confirmation", event.target.value)}
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                />
              </Field>
            </FieldGrid>
          </div>
        </SectionCard>
      </form>
    </AdminLayout>
  )
}
