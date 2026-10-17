import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"

import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Field, FieldGrid, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { SubmitGateButton } from "@/components/admin/ui/submit-gate-button"
import { gerbangBolehLanjut } from "@/lib/submit-gate"

interface UserRecord {
  id: number
  name: string
  username: string
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


  // Gerbang isi tombol simpan: kolom wajibnya mengikuti aturan `required`
  // controller, jadi frontend tidak menciptakan aturan baru.
  // Password wajib hanya saat membuat akun baru. Saat menyunting, kolom itu
  // memang boleh dikosongkan (server tidak mewajibkannya), jadi tidak boleh ikut
  // dikunci.
  const fieldsWajib: Record<string, string> = {
    name: "Nama",
    username: "Username",
    status: "Status",
  }
  if (!editing) fieldsWajib.password = "Password"

  const gerbang = {
    fields: fieldsWajib,
    requireChange: editing,
  }

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
                <SubmitGateButton
          form={form}
          {...gerbang}
          formId="user-form"
        >
          Simpan akun
        </SubmitGateButton>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Admin | Admin`} />

      <form
        id="user-form"
        onSubmit={(event) => {
          if (!gerbangBolehLanjut(event, form, gerbang)) return
          event.preventDefault()
          if (editing) form.put(submitUrl)
          else form.post(submitUrl)
        }}
        className="w-full space-y-5"
      >
        <FormErrorSummary errors={form.errors} />

        <SectionCard
          title="Akun admin"
          description="Identitas login dan status akun pengelola panel."
        >
          <FieldGrid>
            {editing && user ? (
              <Field id="user-account-status" label="Status akun" className="sm:col-span-2">
                <div className="flex min-h-9 flex-wrap items-center gap-2">
                  <StatusBadge status={user.status} />
                  <span className="text-xs font-semibold text-muted-foreground">Admin (hak setara)</span>
                  {isSelf ? (
                    <span className="text-xs font-semibold text-primary">Ini akun yang sedang Anda pakai</span>
                  ) : null}
                </div>
              </Field>
            ) : null}

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
              id="user-password"
              label={editing ? "Password baru" : "Password awal"}
              required={!editing}
              error={form.errors.password}
              hint={editing ? "Kosongkan bila tidak diubah." : undefined}
            >
              <div className="flex items-center gap-1.5">
                <Input
                  type="text"
                  value={form.data.password}
                  onChange={(event) => form.setData("password", event.target.value)}
                  autoComplete="new-password"
                  placeholder={editing ? "Kosongkan jika tidak diubah" : "Tulis manual atau Generate"}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*"
                    const array = new Uint32Array(14)
                    crypto.getRandomValues(array)
                    const generated = Array.from(array, (n) => charset[n % charset.length]).join("")
                    form.setData("password", generated)
                    form.setData("password_confirmation", generated)
                  }}
                >
                  <Icon name="sparkles" className="size-3.5" aria-hidden="true" />
                  Generate
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="shrink-0"
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
                  <Icon name={copied ? "check" : "copy"} className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
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
              hint="Nonaktif berarti tidak bisa login. Semua admin aktif punya akses panel yang sama."
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
          </FieldGrid>
        </SectionCard>

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