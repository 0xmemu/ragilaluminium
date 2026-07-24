import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import AuthLayout from "@/layouts/auth-layout"

export default function Login({ email = "" }: { email?: string }) {
  const [showPassword, setShowPassword] = React.useState(false)
  const form = useForm({
    email,
    password: "",
    remember: false,
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (form.processing) return
    // Relative path avoids Ziggy absolute-URL host mismatches in local/WSL e2e.
    form.post("/login", {
      onFinish: () => form.reset("password"),
    })
  }

  return (
    <AuthLayout description="Masukkan email dan password akun admin untuk melanjutkan.">

      <Head title="Login Admin" />
      <form onSubmit={submit} className="flex flex-col gap-6">
        <FormErrorSummary errors={form.errors} />
        <Field id="login-email" label="Email" required error={form.errors.email}>
          <Input
            type="email"
            placeholder="admin@ragilaluminium.com"
            value={form.data.email}
            onChange={(event) => form.setData("email", event.target.value)}
            autoComplete="username"
            autoFocus
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
              <Icon name="eye" className="h-4 w-4" aria-hidden="true" />
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
          <Icon name="arrow-right" className="h-5 w-5" aria-hidden="true" />
        </Button>
      </form>
    </AuthLayout>
  )
}
