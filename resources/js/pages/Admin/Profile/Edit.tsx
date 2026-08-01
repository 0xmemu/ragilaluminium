import { Head, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"

interface ProfileRecord {
  name: string
  username: string
  email: string
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
    email: profile.email,
    current_password: "",
    password: "",
    password_confirmation: "",
  })

  return (
    <AdminLayout
      title="Profil Saya"
      description="Perbarui nama, username, email penerima, dan password akun yang sedang login."
    >
      <Head title="Profil Saya | Admin" />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          form.put(submitUrl, {
            onSuccess: () => form.reset("current_password", "password", "password_confirmation"),
          })
        }}
        className="mx-auto max-w-2xl space-y-6"
      >
        <FormErrorSummary errors={form.errors} />

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center gap-3 border-b border-border pb-5">
            <div>
              <p className="text-xs font-bold tracking-tight text-muted-foreground">Peran & status</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{profile.role_label}</p>
            </div>
            <StatusBadge status={profile.status} />
            <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
              Semua admin setara; akses login diatur lewat status aktif/nonaktif.
            </p>
          </div>

          <div className="mt-5 grid gap-5">
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
            <Field
              id="profile-email"
              label="Email penerima"
              required
              error={form.errors.email}
              hint="Email dapat dipakai oleh lebih dari satu akun."
            >
              <Input
                type="email"
                value={form.data.email}
                onChange={(event) => form.setData("email", event.target.value)}
                autoComplete="email"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-semibold tracking-tight">Ganti password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kosongkan jika password tidak diubah. Wajib isi password saat ini bila mengganti.
          </p>
          <div className="mt-5 grid gap-5">
            <Field id="profile-current-password" label="Password saat ini" error={form.errors.current_password}>
              <Input
                type="password"
                value={form.data.current_password}
                onChange={(event) => form.setData("current_password", event.target.value)}
                autoComplete="current-password"
              />
            </Field>
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
              />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan profil"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
