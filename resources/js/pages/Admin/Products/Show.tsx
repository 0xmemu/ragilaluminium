import { Head, Link, useForm } from "@inertiajs/react"

import { SectionCard } from "@/components/admin/section-card"
import { ResourceValue } from "@/components/admin/resource-value"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { DetailField, DetailSection } from "@/types"

/** Ikon tautan pengelolaan berdasarkan kind dari controller. */
const managementLinkIcon: Record<string, string> = {
  media: "image",
  attributes: "sliders",
  import: "upload",
  variants: "package",
}

/** Ikon seksi data terkait berdasarkan judul; fallback package. */
function sectionIcon(title: string): string {
  const normalized = title.toLowerCase()
  if (normalized.includes("media")) return "image"
  if (normalized.includes("atribut")) return "sliders"
  return "package"
}

/**
 * Nilai berat dan dimensi panjang (mis. "100 kg · T 100 × P 100 cm × L 100 cm"),
 * jadi selnya membentang dua kolom supaya tidak terpotong dan baris grid
 * tetap penuh tanpa sel kosong.
 */
const wideFieldLabels = new Set(["Berat & Dimensi Paket"])

export default function ProductShow({
  title,
  subtitle,
  description,
  publicVisible,
  fields,
  sections,
  editHref,
  productHref,
  managementLinks,
}: {
  title: string
  subtitle: string
  description?: string | null
  publicVisible: boolean
  fields: DetailField[]
  sections: DetailSection[]
  editHref: string
  productHref: string
  managementLinks: Array<{ label: string; href: string; kind: string }>
}) {
  const productId = (route().params as Record<string, string>).product
  const status = String(fields.find((field) => field.label === "Status")?.value ?? "")
  const archiveForm = useForm({})
  const archived = status === "archived"

  const actions = (
    <>
      {/* Produk arsip tidak dilayani storefront, jadi tombolnya jangan
          ditampilkan supaya tidak menabrak 404. */}
      {publicVisible ? (
        <Button asChild variant="secondary">
          <a href={productHref} target="_blank" rel="noreferrer">
            <Icon name="eye" className="h-4 w-4" aria-hidden="true" />
            Lihat publik
          </a>
        </Button>
      ) : (
        <Button variant="secondary" disabled title="Produk arsip tidak tampil di toko">
          <Icon name="eye" className="h-4 w-4" aria-hidden="true" />
          Lihat publik
        </Button>
      )}
      <Button asChild>
        <Link href={editHref}>
          <Icon name="pencil" className="h-4 w-4" aria-hidden="true" />
          Edit produk
        </Link>
      </Button>
      {productId ? (
        <ConfirmAction
          trigger={
            <Button variant={archived ? "secondary" : "destructive"}>
              <Icon name={archived ? "refresh" : "archive"} className="h-4 w-4" aria-hidden="true" />
              {archived ? "Pulihkan" : "Arsipkan"}
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
    </>
  )

  const renderField = (field: DetailField, index: number) => (
    <div
      key={`${field.label}-${index}`}
      className={cn("bg-card p-5", wideFieldLabels.has(field.label) && "xl:col-span-2")}
    >
      <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
      <div className="mt-1.5 text-sm leading-6 text-foreground">
        <ResourceValue
          fieldKey={field.label.toLowerCase().includes("status") ? "status" : undefined}
          value={field.value}
          format={field.format}
        />
      </div>
    </div>
  )

  const renderRow = (section: DetailSection, row: DetailSection["rows"][number], index: number) => {
    const hasThumbs = section.rows.some((item) => Boolean(item.thumb_url))

    return (
      <div key={`${row.label}-${index}`} className="flex items-start gap-3 px-5 py-3">
        {hasThumbs ? (
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
            {row.thumb_url ? (
              <img src={row.thumb_url} alt="" className="size-full object-cover" loading="lazy" />
            ) : (
              <Icon name="image" className="size-4 text-muted-foreground/70" aria-hidden="true" />
            )}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <dt className="truncate text-sm font-medium text-foreground">{row.label}</dt>
          <dd className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {String(row.value ?? "Belum tersedia")}
          </dd>
          {row.meta ? (
            <dd className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.meta}</dd>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <AdminLayout
      title={title}
      description={subtitle}
      actions={actions}
      backUrl={routeUrl("admin.products.index")}
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-4">
        {/* Ringkasan produk: grid sel proporsional, senada pola detail Order */}
        <Card className="grid gap-px overflow-hidden bg-border sm:grid-cols-2 xl:grid-cols-4">
          {fields.map((field, index) => renderField(field, index))}

          <div className="bg-card p-5 sm:col-span-2 xl:col-span-4">
            <p className="text-xs font-medium text-muted-foreground">Deskripsi</p>
            {description ? (
              <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-foreground">
                {description}
              </p>
            ) : (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Icon name="warning" className="size-4 text-destructive" aria-hidden="true" />
                Belum diisi. Deskripsi wajib sebelum produk bisa diaktifkan.
              </p>
            )}
          </div>
        </Card>

        <SectionCard title="Kelola data terkait" contentClassName="p-0" className="overflow-hidden">
          <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
            {managementLinks.map((link) => (
              <Link
                key={link.kind}
                href={link.href}
                className="flex min-h-12 items-center justify-between gap-2 bg-card px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted/40"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Icon
                    name={managementLinkIcon[link.kind] ?? "package"}
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate">{link.label}</span>
                </span>
                <Icon name="arrow-right" className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </SectionCard>

        <div className="grid items-start gap-4 xl:grid-cols-3">
          {sections.map((section) => {
            const rows = section.rows

            return (
              <SectionCard
                key={section.title}
                title={section.title}
                description={rows.length ? `${rows.length} entri` : undefined}
                icon={sectionIcon(section.title)}
                contentClassName="p-0"
                className="overflow-hidden"
              >
                {rows.length ? (
                  <dl className="divide-y divide-border">
                    {rows.map((row, index) => renderRow(section, row, index))}
                  </dl>
                ) : (
                  <div className="px-5 py-10 text-center">
                    <Icon
                      name={sectionIcon(section.title)}
                      className="mx-auto size-6 text-muted-foreground/70"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">Belum ada data.</p>
                  </div>
                )}
              </SectionCard>
            )
          })}
        </div>
      </div>
    </AdminLayout>
  )
}
