import { Head, useForm } from "@inertiajs/react"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
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

  return (
    <AdminLayout
      title="Profil Saya"
      description="Perbarui nama, username, dan password akun yang sedang login."
      actions={
        <Button type="submit" form="profile-form" disabled={form.processing}>
          {form.processing ? "Menyimpan..." : "Simpan"}
        </Button>
      }
    >
      <Head title="Profil Saya | Admin" />
      <form
        id="profile-form"
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl, {
            onSuccess: () => form.reset("current_password", "password", "password_confirmation"),
          })
        }}
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
