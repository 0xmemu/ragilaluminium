import { Head, Link, useForm } from "@inertiajs/react"

import { ResourceValue } from "@/components/admin/resource-value"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { ConfirmAction } from "@/components/ui/confirm-action"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import type { DetailField, DetailSection } from "@/types"

export default function ProductShow({
  title,
  subtitle,
  fields,
  sections,
  editHref,
  managementLinks,
}: {
  title: string
  subtitle: string
  fields: DetailField[]
  sections: DetailSection[]
  editHref: string
  managementLinks: Array<{ label: string; href: string; kind: string }>
}) {
  const productId = (route().params as Record<string, string>).product
  const status = String(fields.find((field) => field.label === "Status")?.value ?? "")
  const archiveForm = useForm({})
  const archived = status === "archived"

  const actions = (
    <>
      <Button asChild variant="secondary">
        <Link href={routeUrl("product.show", { parent_sku: subtitle })} target="_blank">
          <Icon name="eye" className="h-4 w-4" aria-hidden="true" />
          Lihat publik
        </Link>
      </Button>
      <Button asChild>
        <Link href={editHref}>
          <Icon name="pencil" className="h-4 w-4" aria-hidden="true" />
          Edit produk
        </Link>
      </Button>
    </>
  )

  return (
    <AdminLayout title={title} description={subtitle} actions={actions}>
      <Head title={`${title} | Admin`} />

      <section className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="rounded-lg border border-border bg-surface shadow-sm">
          <dl className="grid sm:grid-cols-2">
            {fields.map((field, index) => (
              <div
                key={`${field.label}-${index}`}
                className="min-h-24 border-b border-border p-5 odd:sm:border-r"
              >
                <dt className="text-xs font-semibold text-muted-foreground">{field.label}</dt>
                <dd className="mt-2 text-sm font-semibold leading-6">
                  <ResourceValue
                    fieldKey={field.label.toLowerCase().includes("status") ? "status" : undefined}
                    value={field.value}
                  />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <aside className="space-y-3">
          <p className="text-xs font-bold tracking-tight text-muted-foreground">
            Kelola data terkait
          </p>
          {managementLinks.map((link) => (
            <Link
              key={link.kind}
              href={link.href}
              className="flex min-h-14 items-center justify-between rounded-lg border border-border bg-surface px-4 text-sm font-semibold shadow-sm transition hover:border-primary/35 hover:bg-accent"
            >
              <span className="flex items-center gap-3">
                <Icon
                  name={link.kind === "media" ? "image" : link.kind === "attributes" ? "sliders" : "package"}
                  className="h-5 w-5 text-primary"
                  aria-hidden="true"
                />
                {link.label}
              </span>
              <Icon name="arrow-right" className="h-4 w-4" aria-hidden="true" />
            </Link>
          ))}
          {productId ? (
            <ConfirmAction
              trigger={
                <Button variant={archived ? "secondary" : "destructive"} className="mt-3 w-full">
                  <Icon name={archived ? "refresh" : "archive"} className="h-4 w-4" aria-hidden="true" />
                  {archived ? "Pulihkan produk" : "Arsipkan produk"}
                </Button>
              }
              title={archived ? "Pulihkan produk?" : "Arsipkan produk?"}
              description={
                archived
                  ? "Produk akan kembali aktif dan dapat digunakan sesuai visibility yang berlaku."
                  : "Produk tidak dihapus, tetapi dipindahkan ke status archived."
              }
              confirmLabel={archived ? "Pulihkan" : "Arsipkan"}
              variant={archived ? "primary" : "destructive"}
              processing={archiveForm.processing}
              onConfirm={() =>
                archiveForm.post(
                  routeUrl(archived ? "admin.products.unarchive" : "admin.products.archive", {
                    product: productId,
                  }),
                )
              }
            />
          ) : null}
        </aside>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <span className="tabular-nums text-xs text-muted-foreground">{section.rows.length}</span>
            </div>
            {section.rows.length ? (
              <dl className="mt-4 divide-y divide-border border-y border-border">
                {section.rows.map((row, index) => (
                  <div key={`${row.label}-${index}`} className="py-3">
                    <dt className="text-sm font-semibold">{row.label}</dt>
                    <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                      {String(row.value ?? "Belum tersedia")}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Belum ada data.</p>
            )}
          </section>
        ))}
      </div>
    </AdminLayout>
  )
}
