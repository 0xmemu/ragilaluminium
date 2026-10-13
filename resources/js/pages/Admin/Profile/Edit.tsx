import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
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
  const [copied, setCopied] = React.useState(false)
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
        className="w-full space-y-6"
      >
        <FormErrorSummary errors={form.errors} />

        {/* Table-First terpadu sesuai standar panel admin */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {/* Seksi 1: Identitas Akun */}
          <div className="border-b border-border bg-muted/40 px-4 py-2.5 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Identitas Akun</h2>
          </div>

          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Status &amp; peran
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={profile.status} />
                    <span className="text-xs font-semibold text-foreground">{profile.role_label}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Nama <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="profile-name"
                    disabled={terkunci}
                    value={form.data.name}
                    onChange={(event) => form.setData("name", event.target.value)}
                    autoComplete="name"
                    className="h-8 max-w-md text-xs"
                  />
                  {form.errors.name ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.name}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Username <span className="text-destructive">*</span>
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="profile-username"
                    disabled={terkunci}
                    value={form.data.username}
                    onChange={(event) => form.setData("username", event.target.value.toLowerCase())}
                    autoComplete="username"
                    className="h-8 max-w-md text-xs font-mono"
                  />
                  {form.errors.username ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.username}</p>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Seksi 2: Ganti Kata Sandi */}
          <div className="border-t border-b border-border bg-muted/40 px-4 py-2.5 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">Ganti Kata Sandi</h2>
          </div>

          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kata sandi saat ini
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="profile-current-password"
                    disabled={terkunci}
                    type="password"
                    value={form.data.current_password}
                    onChange={(event) => form.setData("current_password", event.target.value)}
                    autoComplete="current-password"
                    placeholder={terkunci ? "••••••••" : "Kata sandi saat ini"}
                    className="h-8 max-w-md text-xs"
                  />
                  {form.errors.current_password ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.current_password}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Kata sandi baru
                </th>
                <td className="px-4 py-2.5">
                  <div className="flex max-w-md items-center gap-1.5">
                    <Input
                      id="profile-password"
                      disabled={terkunci}
                      type={terkunci ? "password" : "text"}
                      value={form.data.password}
                      onChange={(event) => form.setData("password", event.target.value)}
                      autoComplete="new-password"
                      placeholder={terkunci ? "••••••••" : "Minimal 8 karakter"}
                      className="h-8 flex-1 text-xs font-mono"
                    />
                    {!terkunci ? (
                      <>
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
                              // clipboard ditolak browser
                            }
                          }}
                        >
                          <Icon name={copied ? "check" : "copy"} className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {form.errors.password ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.password}</p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">
                  Ulangi kata sandi baru
                </th>
                <td className="px-4 py-2.5">
                  <Input
                    id="profile-password-confirmation"
                    disabled={terkunci}
                    type={terkunci ? "password" : "text"}
                    value={form.data.password_confirmation}
                    onChange={(event) => form.setData("password_confirmation", event.target.value)}
                    autoComplete="new-password"
                    placeholder={terkunci ? "••••••••" : "Ulangi kata sandi baru"}
                    className="h-8 max-w-md text-xs font-mono"
                  />
                  {form.errors.password_confirmation ? (
                    <p className="mt-1 text-xs text-destructive">{form.errors.password_confirmation}</p>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>
    </AdminLayout>
  )
}
