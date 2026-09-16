import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"

interface ShowProject {
  id: number
  title: string
  slug: string
  category_label?: string | null
  description?: string | null
  status: "active" | "inactive" | "archived"
  sort_order: number
  main_image_url?: string | null
  main_video_url?: string | null
  gallery_images: Array<{ url: string; asset_id?: number | null; caption?: string | null }>
  model_product?: {
    id: number
    name: string
    category: string
    model: string
  } | null
  specifications: Array<{ name: string; value: string }>
  features: string[]
  created_at?: string | null
  updated_at?: string | null
  editUrl: string
  toggleStatusUrl: string
  archiveUrl: string
  destroyUrl: string
}

interface ShowProps {
  title: string
  project: ShowProject
  backUrl: string
}

export default function InstallationGalleryShow({ title, project, backUrl }: ShowProps) {
  const [selectedPhoto, setSelectedPhoto] = React.useState<string | null>(null)

  return (
    <AdminLayout
      title={title}
      description={project.category_label || "Detail portofolio proyek hasil pemasangan"}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={backUrl}>
              <Icon name="arrow-left" className="size-4" aria-hidden="true" />
              Kembali
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.patch(project.toggleStatusUrl, {}, { preserveScroll: true })}
          >
            <Icon
              name={project.status === "active" ? "eye-slash" : "eye"}
              className="size-4 mr-1.5"
            />
            {project.status === "active" ? "Nonaktifkan" : "Aktifkan"}
          </Button>

          {project.status !== "archived" && (
            <ConfirmAction
              trigger={
                <Button variant="outline">
                  <Icon name="archive" className="size-4 mr-1.5 text-amber-600" />
                  Arsipkan
                </Button>
              }
              title="Arsipkan proyek?"
              description={`Proyek "${project.title}" tidak lagi ditampilkan di halaman publik.`}
              confirmLabel="Arsipkan"
              onConfirm={() => router.post(project.archiveUrl, {}, { preserveScroll: true })}
            />
          )}

          <Button asChild>
            <Link href={project.editUrl}>
              <Icon name="pencil" className="size-4" aria-hidden="true" />
              Edit Proyek
            </Link>
          </Button>

          <ConfirmAction
            trigger={
              <Button variant="destructive" size="icon" aria-label="Hapus proyek">
                <Icon name="trash" className="size-4" />
              </Button>
            }
            title="Hapus proyek permanen?"
            description={`Data portofolio "${project.title}" akan dihapus dari sistem.`}
            confirmLabel="Hapus"
            variant="destructive"
            onConfirm={() => router.delete(project.destroyUrl)}
          />
        </div>
      }
    >
      <Head title={`${title} | Detail Hasil Pemasangan`} />

      <div className="mx-auto max-w-5xl space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                No. Urut #{project.sort_order}
              </span>
              <StatusBadge status={project.status} />
              {project.category_label && (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {project.category_label}
                </span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-bold text-foreground sm:text-2xl">
              {project.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground font-mono">
              Slug: /{project.slug}
            </p>
          </div>

          <div className="text-right text-xs text-muted-foreground">
            <div>Dibuat: {project.created_at || "—"}</div>
            {project.updated_at && <div className="mt-0.5">Diperbarui: {project.updated_at}</div>}
          </div>
        </div>

        {/* Media Highlights (Main Image & Video) */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Foto Utama */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Foto Utama Proyek</h3>
            </div>
            <div className="relative aspect-video w-full overflow-hidden bg-muted">
              {project.main_image_url ? (
                <img
                  src={project.main_image_url}
                  alt={project.title}
                  className="size-full object-cover cursor-pointer hover:opacity-95 transition"
                  onClick={() => setSelectedPhoto(project.main_image_url ?? null)}
                />
              ) : (
                <div className="flex size-full items-center justify-center text-muted-foreground">
                  <Icon name="image" className="size-10" />
                </div>
              )}
            </div>
          </div>

          {/* Video Utama (jika ada) atau Galeri Foto Tambahan */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="border-b border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">
                {project.main_video_url ? "Video Dokumentasi Lapangan" : "Foto Tambahan"}
              </h3>
            </div>
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              {project.main_video_url ? (
                <video
                  src={project.main_video_url}
                  controls
                  preload="metadata"
                  className="size-full object-contain"
                />
              ) : project.gallery_images && project.gallery_images.length > 0 ? (
                <div className="grid size-full grid-cols-2 gap-1 bg-muted p-2">
                  {project.gallery_images.slice(0, 4).map((g, i) => (
                    <img
                      key={i}
                      src={g.url}
                      alt={g.caption || `Foto Tambahan ${i + 1}`}
                      className="size-full object-cover rounded-md cursor-pointer hover:opacity-95 transition"
                      onClick={() => setSelectedPhoto(g.url)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex size-full flex-col items-center justify-center text-muted-foreground bg-muted">
                  <Icon name="video-camera" className="size-10" />
                  <span className="mt-2 text-xs">Tidak ada video dokumentasi</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Galeri Tambahan jika Video ada dan Foto Tambahan ada */}
        {project.main_video_url && project.gallery_images && project.gallery_images.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Foto Tambahan ({project.gallery_images.length} foto)
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {project.gallery_images.map((img, idx) => (
                <div
                  key={idx}
                  className="relative aspect-4/3 overflow-hidden rounded-lg border border-border bg-muted cursor-pointer hover:opacity-90 transition"
                  onClick={() => setSelectedPhoto(img.url)}
                >
                  <img src={img.url} alt={img.caption || `Foto ${idx + 1}`} className="size-full object-cover" />
                  {img.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[11px] text-white backdrop-blur-xs">
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deskripsi & Hubungan Katalog */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Deskripsi Proyek */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-3 mb-3">
                Deskripsi Pekerjaan &amp; Lapangan
              </h3>
              <div className="text-xs leading-relaxed text-foreground whitespace-pre-line">
                {project.description || (
                  <span className="text-muted-foreground italic">Tidak ada deskripsi rinci.</span>
                )}
              </div>
            </div>

            {/* Fitur & Keunggulan */}
            {project.features && project.features.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-3 mb-3">
                  Fitur &amp; Nilai Jual Keunggulan
                </h3>
                <ul className="space-y-2 text-xs">
                  {project.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-foreground">
                      <Icon name="check" className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Tautan Model Produk Katalog */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-3 mb-3">
                Model Produk Terkait
              </h3>
              {project.model_product ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="layers" className="size-3.5" />
                    <span>{project.model_product.category || "Katalog"}</span>
                  </div>
                  <div className="mt-1 font-semibold text-foreground text-sm">
                    {project.model_product.name}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Model: <code className="font-mono">{project.model_product.model}</code>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">
                  Proyek ini tidak dihubungkan dengan model produk katalog tertentu.
                </div>
              )}
            </div>

            {/* Spesifikasi Unit */}
            {project.specifications && project.specifications.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-3 mb-3">
                  Spesifikasi Teknis Unit
                </h3>
                <dl className="divide-y divide-border text-xs">
                  {project.specifications.map((spec, idx) => (
                    <div key={idx} className="flex justify-between py-2">
                      <dt className="text-muted-foreground font-medium">{spec.name}</dt>
                      <dd className="font-semibold text-foreground text-right">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Simple Image Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-xl bg-background shadow-2xl">
            <img src={selectedPhoto} alt="Perbesar Foto" className="max-h-[85vh] w-auto object-contain" />
            <button
              type="button"
              onClick={() => setSelectedPhoto(null)}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              <Icon name="x" className="size-4" />
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
