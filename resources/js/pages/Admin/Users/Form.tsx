import { Head, Link, useForm } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"

interface UserRecord {
  id: number
  name: string
  username: string
  email: string
  status: string
}

export default function UserForm({
  user,
  submitUrl,
  isSelf = false,
}: {
  user: UserRecord | null
  submitUrl: string
  isSelf?: boolean
}) {
  const editing = Boolean(user)
  const form = useForm({
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
    password: "",
    password_confirmation: "",
    status: user?.status ?? "active",
  })
  const statusForm = useForm({})

  return (
    <AdminLayout
      title={editing ? "Edit akun admin" : "Tambah akun admin"}
      description={
        editing
          ? isSelf
            ? "Anda mengedit akun sendiri. Ganti password pribadi juga bisa lewat Profil Saya."
            : user?.email
          : "Buat username unik dan kirim kredensial awal ke email penerima."
      }
      actions={
        <Button asChild variant="secondary">
          <Link href={routeUrl("admin.users.index")}>Kembali</Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Admin | Admin`} />

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="mx-auto max-w-2xl space-y-6"
      >
        <FormErrorSummary errors={form.errors} />

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
          {editing && user ? (
            <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-border pb-5">
              <StatusBadge status={user.status} />
              <p className="text-xs font-semibold text-muted-foreground">Admin (hak setara)</p>
              {isSelf ? (
                <p className="text-xs font-semibold text-primary">Ini akun yang sedang Anda pakai</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-5">
            <Field id="user-name" label="Nama" required error={form.errors.name}>
              <Input
                value={form.data.name}
                onChange={(event) => form.setData("name", event.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field
              id="user-username"
              label="Username"
              required
              error={form.errors.username}
              hint="Unik untuk setiap akun. Gunakan huruf, angka, titik, garis bawah, atau tanda hubung."
            >
              <Input
                value={form.data.username}
                onChange={(event) => form.setData("username", event.target.value.toLowerCase())}
                autoComplete="username"
                placeholder="contoh: admin.ragil"
              />
            </Field>

            <Field
              id="user-email"
              label="Email penerima kredensial"
              required
              error={form.errors.email}
              hint="Satu email boleh digunakan untuk beberapa username."
            >
              <Input
                type="email"
                value={form.data.email}
                onChange={(event) => form.setData("email", event.target.value)}
                autoComplete="email"
              />
            </Field>

            <Field
              id="user-password"
              label={editing ? "Password baru" : "Password awal"}
              required={!editing}
              error={form.errors.password}
              hint={
                editing
                  ? "Kosongkan jika password tidak diubah."
                  : "Minimal 8 karakter dan dikirim sekali ke email penerima."
              }
            >
              <Input
                type="password"
                value={form.data.password}
                onChange={(event) => form.setData("password", event.target.value)}
                autoComplete="new-password"
              />
            </Field>

            <Field
              id="user-password-confirmation"
              label={editing ? "Ulangi password baru" : "Ulangi password awal"}
              required={!editing}
              error={form.errors.password_confirmation}
            >
              <Input
                type="password"
                value={form.data.password_confirmation}
                onChange={(event) => form.setData("password_confirmation", event.target.value)}
                autoComplete="new-password"
              />
            </Field>

            <Field
              id="user-status"
              label="Status"
              required
              error={form.errors.status}
              hint="Nonaktif = tidak bisa login. Semua admin aktif punya akses panel yang sama."
            >
              <Select
                value={form.data.status}
                onChange={(event) => form.setData("status", event.target.value)}
                disabled={isSelf}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </Select>
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-2 border-t border-border pt-5">
            <Button asChild variant="secondary">
              <Link href={routeUrl("admin.users.index")}>Batal</Link>
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan akun"}
            </Button>
          </div>
        </section>
      </form>

      {editing && user && !isSelf ? (
        <section className="mx-auto mt-6 max-w-2xl rounded-lg border border-destructive/25 bg-destructive/5 p-5">
          <h2 className="text-lg font-semibold">Status akses login</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Nonaktifkan akses login tanpa menghapus akun. Aktifkan kembali bila staf perlu masuk lagi.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                statusForm.post(routeUrl("admin.users.activate", { user: user.id }), {
                  preserveScroll: true,
                })
              }
              disabled={statusForm.processing || user.status === "active"}
            >
              Aktifkan
            </Button>
            <ConfirmAction
              trigger={
                <Button variant="destructive" disabled={user.status === "inactive"}>
                  Nonaktifkan
                </Button>
              }
              title="Nonaktifkan akun?"
              description={`${user.name} tidak dapat login sampai akun diaktifkan kembali.`}
              confirmLabel="Nonaktifkan"
              processing={statusForm.processing}
              onConfirm={() =>
                statusForm.post(routeUrl("admin.users.deactivate", { user: user.id }), {
                  preserveScroll: true,
                })
              }
            />
          </div>
        </section>
      ) : null}
    </AdminLayout>
  )
}
