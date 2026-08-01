import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import AdminLayout from "@/layouts/admin-layout"

type PlatformRow = {
  key: string
  label: string
  channel: "marketplace" | "social"
  icon: string | null
  href: string
}

export default function StorefrontPlatformsEdit({
  title,
  description,
  platforms,
  submitUrl,
  previewUrl,
}: {
  title: string
  description: string
  platforms: PlatformRow[]
  submitUrl: string
  previewUrl: string
}) {
  const initialLinks = Object.fromEntries(platforms.map((p) => [p.key, p.href]))

  const form = useForm<{ links: Record<string, string> }>({
    links: initialLinks,
  })

  const marketplace = platforms.filter((p) => p.channel === "marketplace")
  const social = platforms.filter((p) => p.channel === "social")

  function submit(event: React.FormEvent) {
    event.preventDefault()
    form.put(submitUrl)
  }

  function setLink(key: string, value: string) {
    form.setData("links", { ...form.data.links, [key]: value })
  }

  function renderGroup(heading: string, hint: string, rows: PlatformRow[]) {
    if (rows.length === 0) return null

    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold">{heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="space-y-4">
          {rows.map((row) => (
            <Field
              key={row.key}
              id={`link-${row.key}`}
              label={row.label}
              error={form.errors[`links.${row.key}` as keyof typeof form.errors]}
              hint="Kosongkan jika belum punya toko/akun. Gunakan URL lengkap (https://…)."
            >
              <div className="flex items-center gap-3">
                {row.icon ? (
                  <img
                    src={row.icon}
                    alt=""
                    className="size-9 shrink-0 object-contain"
                    width={36}
                    height={36}
                  />
                ) : null}
                <Input
                  id={`link-${row.key}`}
                  type="url"
                  inputMode="url"
                  placeholder={`https://… (${row.label})`}
                  value={form.data.links[row.key] ?? ""}
                  onChange={(event) => setLink(row.key, event.target.value)}
                  className="min-w-0 flex-1"
                />
              </div>
            </Field>
          ))}
        </div>
      </section>
    )
  }

  return (
    <AdminLayout title={title} description={description}>
      <Head title={`${title} | Admin`} />

      <form
        onSubmit={submit}
        className="mx-auto max-w-2xl space-y-8 rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <FormErrorSummary errors={form.errors} />

        {renderGroup(
          "Marketplace",
          "Tautan toko resmi di channel jual-beli. Tampil menonjol di Informasi Toko dan footer.",
          marketplace,
        )}

        {renderGroup(
          "Media sosial",
          "Akun konten resmi (Instagram, TikTok, YouTube, Facebook). Bukan channel marketplace.",
          social,
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan tautan"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={previewUrl} target="_blank" rel="noopener noreferrer">
              Pratinjau Informasi Toko
            </Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
