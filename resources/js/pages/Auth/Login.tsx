import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import AuthLayout from "@/layouts/auth-layout"

export default function Login({ login = "" }: { login?: string }) {
  const [showPassword, setShowPassword] = React.useState(false)
  const form = useForm({
    login,
    password: "",
    remember: false,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (form.processing) return
    form.post("/login", {
      onFinish: () => form.reset("password"),
    })
  }

  return (
    <AuthLayout description="Gunakan username akun Anda. Email lama tetap dapat dipakai selama tidak digunakan oleh beberapa akun.">
      <Head title="Login Admin" />
      <form onSubmit={submit} className="flex flex-col gap-5">
        <FormErrorSummary errors={form.errors} />

        <Field
          id="login-identifier"
          label="Username atau email"
          required
          error={form.errors.login}
        >
          <Input
            type="text"
            value={form.data.login}
            onChange={(event) => form.setData("login", event.target.value)}
            autoComplete="username"
            autoFocus
            placeholder="contoh: admin.ragil"
          />
        </Field>

        <div className="grid gap-2">
          <label htmlFor="login-password" className="text-sm font-semibold text-foreground">
            Password <span className="ml-1 text-accent-foreground" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={form.data.password}
              onChange={(event) => form.setData("password", event.target.value)}
              autoComplete="current-password"
              placeholder="Masukkan password"
              className="pr-12"
              aria-describedby={form.errors.password ? "login-password-error" : undefined}
              aria-invalid={Boolean(form.errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-1 top-1 inline-flex h-9 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
            >
              <Icon name="eye" className="size-4" aria-hidden="true" />
            </button>
          </div>
          {form.errors.password ? (
            <p id="login-password-error" role="alert" className="text-xs font-medium text-destructive">
              {form.errors.password}
            </p>
          ) : null}
        </div>

        <Checkbox
          checked={form.data.remember}
          onChange={(event) => form.setData("remember", event.target.checked)}
          label="Pertahankan sesi di perangkat ini"
          round
          compact
        />

        <Button type="submit" size="lg" className="w-full" disabled={form.processing}>
          {form.processing ? "Memeriksa akun..." : "Masuk"}
          <Icon name="arrow-right" className="size-5" aria-hidden="true" />
        </Button>

        <p className="text-center text-xs leading-5 text-muted-foreground">
          Akses terbatas untuk administrator Ragil Aluminium.
        </p>
      </form>
    </AuthLayout>
  )
}