import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
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

  /** Table-first: satu baris per platform, input tautan inline. */
  function renderTable(heading: string, hint: string, rows: PlatformRow[]) {
    if (rows.length === 0) return null

    return (
      <section className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-muted/40 px-3 py-2">
          <h2 className="text-sm font-bold">{heading}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="w-44 px-3 py-1.5">Platform</th>
              <th className="px-3 py-1.5">Tautan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-1.5 align-middle">
                  <div className="flex items-center gap-2">
                    {row.icon ? (
                      <img src={row.icon} alt="" className="size-7 shrink-0 object-contain" width={28} height={28} />
                    ) : null}
                    <span className="text-xs font-medium">{row.label}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="url"
                    inputMode="url"
                    placeholder={`https://… (${row.label})`}
                    value={form.data.links[row.key] ?? ""}
                    onChange={(event) => setLink(row.key, event.target.value)}
                    className="h-8 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    )
  }

  return (
    <AdminLayout title={title} description={description}>
      <Head title={`${title} | Admin`} />

      <form onSubmit={submit} className="w-full space-y-6">
        <FormErrorSummary errors={form.errors} />

        <div className="grid items-start gap-6 lg:grid-cols-2">
          {renderTable(
            "Marketplace",
            "Tautan toko resmi di channel jual-beli. Tampil menonjol di Tentang Kami dan footer.",
            marketplace,
          )}

          {renderTable(
            "Media sosial",
            "Akun konten resmi (Instagram, TikTok, YouTube, Facebook). Bukan channel marketplace.",
            social,
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan tautan"}
          </Button>
          <Button asChild type="button" variant="secondary">
            <Link href={previewUrl} target="_blank" rel="noopener noreferrer">
              Pratinjau Tentang Kami
            </Link>
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}