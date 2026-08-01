import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { ResourceValue } from "@/components/admin/resource-value"
import { Icon } from "@/components/shared/icon"
import { Alert } from "@/components/admin/ui/alert"
import { Button } from "@/components/admin/ui/button"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { ResourceShowProps } from "@/types"

function keyForLabel(label: string): string {
  const normalized = label.toLowerCase()
  if (normalized.includes("status")) return "status"
  if (normalized.includes("waktu") || normalized.includes("update") || normalized.includes("dimulai") || normalized.includes("selesai")) {
    return "created_at"
  }
  return normalized.replace(/\s+/g, "_")
}

export default function ResourceShow({
  title,
  subtitle,
  fields = [],
  sections = [],
}: ResourceShowProps) {
  const actionForm = useForm({})
  const currentRoute = route().current()
  const routeParams = route().params as Record<string, string>
  const isImport = currentRoute === "admin.imports.show"
  const isShipping = currentRoute === "admin.shipping.show"
  const isStoreAnalytics = currentRoute === "admin.analytics.store-performance"

  const actions = (
    <>
      {isStoreAnalytics
        ? [7, 30, 90].map((days) => (
            <Button
              key={days}
              variant={subtitle?.startsWith(String(days)) ? "primary" : "secondary"}
              onClick={() => router.get(routeUrl("admin.analytics.store-performance"), { days })}
            >
              {days} hari
            </Button>
          ))
        : null}
      {isImport && routeParams.import_job ? (
        <>
          <Button asChild variant="secondary">
            <Link href={routeUrl("admin.imports.failed-rows", { import_job: routeParams.import_job })}>
              Baris gagal
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <a href={routeUrl("admin.imports.correction-file", { import_job: routeParams.import_job })}>
              <Icon name="download" className="h-4 w-4" aria-hidden="true" />
              File koreksi
            </a>
          </Button>
          <Button
            onClick={() =>
              actionForm.post(
                routeUrl("admin.imports.retry", { import_job: routeParams.import_job }),
                { preserveScroll: true },
              )
            }
            disabled={actionForm.processing}
          >
            <Icon name="refresh" className="h-4 w-4" aria-hidden="true" />
            Jalankan ulang
          </Button>
        </>
      ) : null}
      {isShipping && routeParams.shipping ? (
        <Button
          onClick={() =>
            actionForm.post(
              routeUrl("admin.shipping.refresh", { shipping_record: routeParams.shipping }),
              { preserveScroll: true },
            )
          }
          disabled={actionForm.processing}
        >
          <Icon name="refresh" className="h-4 w-4" aria-hidden="true" />
          Segarkan status
        </Button>
      ) : null}
    </>
  )

  return (
    <AdminLayout title={title} description={subtitle} actions={actions}>
      <Head title={`${title} | Admin`} />

      {currentRoute === "admin.settings.index" ? (
        <Alert tone="info" className="mb-6">
          Nilai integrasi bersifat read-only. Perubahan kredensial dilakukan melalui environment
          server agar rahasia tidak disimpan dari browser.
        </Alert>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-soft">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
          {fields.map((field, index) => (
            <div
              key={`${field.label}-${index}`}
              className="min-h-28 p-5 [&:nth-child(n+3)]:border-t [&:nth-child(n+4)]:lg:border-t"
            >
              <p className="text-xs font-semibold text-muted-foreground">{field.label}</p>
              <div className="mt-3 break-words text-sm font-semibold leading-6 text-foreground">
                <ResourceValue fieldKey={keyForLabel(field.label)} value={field.value} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {sections.length ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {sections.map((section) => (
            <section key={section.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {section.rows.length} record
                </span>
              </div>
              {section.rows.length ? (
                <dl className="mt-4 divide-y divide-border border-y border-border">
                  {section.rows.map((row, index) => (
                    <div key={`${row.label}-${index}`} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(8rem,0.8fr)_1.2fr] sm:gap-4">
                      <dt className="font-semibold text-foreground">{row.label}</dt>
                      <dd className="break-words text-muted-foreground">{String(row.value ?? "Belum tersedia")}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Belum ada record pada bagian ini.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}

      <Button variant="ghost" className="mt-6" onClick={() => window.history.back()}>
        <Icon name="arrow-left" className="h-4 w-4" aria-hidden="true" />
        Kembali
      </Button>
    </AdminLayout>
  )
}
