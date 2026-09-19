import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

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
  if (normalized.includes("spesifikasi")) return "sliders"
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
  const [descriptionExpanded, setDescriptionExpanded] = React.useState(false)
  // Deskripsi import bisa sangat panjang (ratusan baris teks promosi), jadi
  // kartu ringkasan tidak boleh ikut memanjang karenanya.
  const descriptionIsLong = (description ?? "").length > 240

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

  /** Judul kolom per seksi: turunan judul seksi, bukan aturan bisnis. */
  const sectionColumns = (sectionTitle: string) => {
    const normalized = sectionTitle.toLowerCase()
    if (normalized.includes("media")) {
      return { item: "Foto", note: "Status media", code: "Berkas" }
    }
    if (normalized.includes("varian")) {
      return { item: "Varian", note: "Status, harga, stok", code: "SKU" }
    }
    if (normalized.includes("spesifikasi")) {
      return { item: "Nama", note: "Nilai", code: "Kode" }
    }

    return { item: "Item", note: "Keterangan", code: "Kode" }
  }

  /** Satu seksi data terkait sebagai tabel membentang penuh (Table-First). */
  const renderSectionTable = (section: DetailSection) => {
    const rows = section.rows
    const hasThumbs = rows.some((row) => Boolean(row.thumb_url))
    const hasMeta = rows.some((row) => Boolean(row.meta))
    const columns = sectionColumns(section.title)

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
              {hasThumbs ? <th className="w-[1%] px-4 py-3 text-left">Media</th> : null}
              <th className="px-4 py-3 text-left">{columns.item}</th>
              <th className="px-4 py-3 text-left">{columns.note}</th>
              {hasMeta ? <th className="px-4 py-3 text-left">{columns.code}</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, index) => (
              <tr key={row.label + "-" + index} className="transition-colors hover:bg-muted/40">
                {hasThumbs ? (
                  <td className="w-[1%] px-4 py-2.5 align-middle">
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
                      {row.thumb_url ? (
                        <img src={row.thumb_url} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <Icon name="image" className="size-4 text-muted-foreground/70" aria-hidden="true" />
                      )}
                    </span>
                  </td>
                ) : null}
                <td className="px-4 py-2.5 align-middle font-medium text-foreground">{row.label}</td>
                <td className="px-4 py-2.5 align-middle text-muted-foreground">
                  {String(row.value ?? "Belum tersedia")}
                </td>
                {hasMeta ? (
                  <td className="px-4 py-2.5 align-middle font-mono text-[11px] text-muted-foreground">
                    {row.meta}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
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

        </Card>

        <SectionCard
          title="Deskripsi"
          icon="notes"
          action={
            descriptionIsLong ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDescriptionExpanded((value) => !value)}
              >
                {descriptionExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
              </Button>
            ) : null
          }
        >
          {description ? (
            <p
              className={cn(
                "whitespace-pre-line text-sm leading-6 text-foreground",
                descriptionIsLong && !descriptionExpanded && "line-clamp-3",
              )}
            >
              {description}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon name="warning" className="size-4 text-destructive" aria-hidden="true" />
              Belum diisi. Deskripsi wajib sebelum produk bisa diaktifkan.
            </p>
          )}
        </SectionCard>

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

        {sections.map((section) => {
          const rows = section.rows

          return (
            <SectionCard
              key={section.title}
              title={section.title}
              description={rows.length ? rows.length + " entri" : undefined}
              icon={sectionIcon(section.title)}
              contentClassName="p-0"
              className="overflow-hidden"
            >
              {rows.length ? (
                renderSectionTable(section)
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
    </AdminLayout>
  )
}
