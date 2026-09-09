import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { FormErrorSummary } from "@/components/admin/ui/field"
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
  const [copied, setCopied] = React.useState(false)
  const form = useForm({
    name: user?.name ?? "",
    username: user?.username ?? "",
    password: "",
    password_confirmation: "",
    status: user?.status ?? "active",
  })
  const statusForm = useForm({})

  return (
    <AdminLayout
      backUrl={routeUrl("admin.users.index")}
      title={editing ? "Edit akun admin" : "Tambah akun admin"}
      description={
        editing
          ? isSelf
            ? "Anda mengedit akun sendiri. Ganti password pribadi juga bisa lewat Profil Saya."
            : user?.username
          : "Buat username dan password untuk akun admin baru."
      }
      actions={
        <Button type="submit" form="user-form" disabled={form.processing}>
          {form.processing ? "Menyimpan..." : "Simpan akun"}
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Admin | Admin`} />

      <form
        id="user-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="w-full space-y-5"
      >
        <FormErrorSummary errors={form.errors} />

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              {editing && user ? (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Status akun</th>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={user.status} />
                      <span className="text-xs font-semibold text-muted-foreground">Admin (hak setara)</span>
                      {isSelf ? (
                        <span className="text-xs font-semibold text-primary">Ini akun yang sedang Anda pakai</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : null}
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Nama <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.name}
                    onChange={(event) => form.setData("name", event.target.value)}
                    autoComplete="name"
                    className="h-8 text-xs"
                  />
                  {form.errors.name ? <p className="mt-1 text-xs text-destructive">{form.errors.name}</p> : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Username <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    value={form.data.username}
                    onChange={(event) => form.setData("username", event.target.value.toLowerCase())}
                    autoComplete="username"
                    placeholder="contoh: admin.ragil"
                    className="h-8 text-xs"
                  />
                  {form.errors.username ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.username}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Unik untuk setiap akun. Gunakan huruf, angka, titik, garis bawah, atau tanda hubung.
                  </p>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  {editing ? "Password baru" : "Password awal"}
                  {!editing ? <span className="text-destructive"> *</span> : null}
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="text"
                      value={form.data.password}
                      onChange={(event) => form.setData("password", event.target.value)}
                      autoComplete="new-password"
                      placeholder={editing ? "Kosongkan jika tidak diubah" : "Tulis manual atau Generate"}
                      className="h-8 flex-1 text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => {
                        const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
                        const array = new Uint32Array(14)
                        crypto.getRandomValues(array)
                        const generated = Array.from(array, (n) => charset[n % charset.length]).join("")
                        form.setData("password", generated)
                        form.setData("password_confirmation", generated)
                      }}
                    >
                      <Icon name="sparkles" className="h-3.5 w-3.5" aria-hidden="true" />
                      Generate
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 w-8 shrink-0 p-0"
                      aria-label="Salin password"
                      title="Salin password"
                      onClick={async () => {
                        if (!form.data.password) return
                        try {
                          await navigator.clipboard.writeText(form.data.password)
                          setCopied(true)
                          window.setTimeout(() => setCopied(false), 1500)
                        } catch {
                          // clipboard ditolak browser: biarkan manual
                        }
                      }}
                    >
                      <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                  {form.errors.password ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.password}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  {editing ? "Ulangi password baru" : "Ulangi password awal"}
                  {!editing ? <span className="text-destructive"> *</span> : null}
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    type="password"
                    value={form.data.password_confirmation}
                    onChange={(event) => form.setData("password_confirmation", event.target.value)}
                    autoComplete="new-password"
                    className="h-8 text-xs"
                  />
                  {form.errors.password_confirmation ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.password_confirmation}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Status <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Select
                    value={form.data.status}
                    onChange={(event) => form.setData("status", event.target.value)}
                    disabled={isSelf}
                    className="h-8 w-44 text-xs"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </Select>
                  {form.errors.status ? <p className="mt-1 text-xs text-destructive">{form.errors.status}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nonaktif = tidak bisa login. Semua admin aktif punya akses panel yang sama.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        
      </form>

      {editing && user && !isSelf ? (
        <div className="mt-4">
          <ConfirmAction
            trigger={
              <Button variant="destructive" size="sm">
                Nonaktifkan akun
              </Button>
            }
            title="Nonaktifkan akun?"
            description={`${user.name} tidak akan bisa login lagi sampai diaktifkan kembali.`}
            confirmLabel="Nonaktifkan"
            variant="destructive"
            processing={statusForm.processing}
            onConfirm={() => {
              statusForm.post(routeUrl("admin.users.deactivate", { user: user.id }), {
                preserveScroll: true,
              })
            }}
          />
        </div>
      ) : null}
    </AdminLayout>
  )
}