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
    <AuthLayout heading="Masuk Ke Panel Admin">
      <Head title="Login Admin" />
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormErrorSummary title="Username/Password Salah" errors={form.errors} hideMessages />

        <Field
          id="login-identifier"
          label="Email/Username"
          required
          error={form.errors.login}
        >
          <Input
            type="text"
            value={form.data.login}
            onChange={(event) => form.setData("login", event.target.value)}
            autoComplete="username"
            autoFocus
            placeholder="Masukkan Email/Username"
          />
        </Field>

        <div className="grid gap-1.5">
          <label htmlFor="login-password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={form.data.password}
              onChange={(event) => form.setData("password", event.target.value)}
              autoComplete="current-password"
              placeholder="Masukkan Password"
              className="pr-11"
              aria-describedby={form.errors.password ? "login-password-error" : undefined}
              aria-invalid={Boolean(form.errors.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
            >
              <Icon name="eye" className="size-4" aria-hidden="true" />
            </button>
          </div>
          {form.errors.password ? (
            <p id="login-password-error" role="alert" className="text-xs text-destructive">
              {form.errors.password}
            </p>
          ) : null}
        </div>

        <Checkbox
          checked={form.data.remember}
          onChange={(event) => form.setData("remember", event.target.checked)}
          label="Tetap Masuk Di Perangkat Ini"
          round
          compact
        />

        <Button type="submit" className="mt-1 w-full" disabled={form.processing}>
          {form.processing ? "Memeriksa..." : "Masuk"}
        </Button>
      </form>
    </AuthLayout>
  )
}