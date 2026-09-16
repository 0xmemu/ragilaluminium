import { Head, Link, router } from "@inertiajs/react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"

interface ShowMedia {
  id: number
  title: string
  image_url: string
  is_video: boolean
  visibility: "visible" | "hidden" | "archived"
  caption: string
  product_sku: string
  product_name: string
  model_label: string
  created_at?: string | null
  toggleStatusUrl: string
  archiveUrl: string
  destroyUrl: string
}

interface ShowProps {
  title: string
  project: ShowMedia
  backUrl: string
}

const VISIBILITY_LABEL: Record<ShowMedia["visibility"], string> = {
  visible: "Aktif",
  hidden: "Disembunyikan",
  archived: "Diarsipkan",
}

export default function InstallationGalleryShow({ title, project, backUrl }: ShowProps) {
  return (
    <AdminLayout
      title={title}
      description="Detail satu media hasil pemasangan."
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
              name={project.visibility === "visible" ? "eye-slash" : "eye"}
              className="size-4 mr-1.5"
            />
            {project.visibility === "visible" ? "Sembunyikan" : "Tampilkan"}
          </Button>

          {project.visibility !== "archived" && (
            <ConfirmAction
              trigger={
                <Button variant="outline">
                  <Icon name="archive" className="size-4 mr-1.5 text-amber-600" />
                  Arsipkan
                </Button>
              }
              title="Arsipkan media?"
              description="Media ini akan keluar dari halaman publik hasil pemasangan."
              confirmLabel="Arsipkan"
              onConfirm={() => router.post(project.archiveUrl, {}, { preserveScroll: true })}
            />
          )}

          <ConfirmAction
            trigger={
              <Button variant="destructive">
                <Icon name="trash" className="size-4 mr-1.5" />
                Hapus
              </Button>
            }
            title="Hapus media permanen?"
            description="Media ini akan dihapus dari sistem dan tidak dapat dikembalikan."
            confirmLabel="Hapus"
            variant="destructive"
            onConfirm={() => router.delete(project.destroyUrl)}
          />
        </div>
      }
    >
      <Head title={`${title} | Detail Hasil Pemasangan`} />

      <div className="mx-auto max-w-3xl space-y-6">
        {/* Media preview */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="relative aspect-video w-full bg-black">
            {project.is_video ? (
              <video
                src={project.image_url}
                controls
                preload="metadata"
                className="size-full object-contain"
              />
            ) : (
              <img src={project.image_url} alt={project.title} className="size-full object-cover" />
            )}
          </div>
        </div>

        {/* Detail table */}
        <div className="rounded-lg border border-border">
          <table className="w-full">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Keterangan</th>
                <td className="px-4 py-2.5 text-xs text-foreground">
                  {project.caption || "Tanpa keterangan"}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Model</th>
                <td className="px-4 py-2.5 text-xs text-foreground">{project.model_label}</td>
              </tr>
              {project.product_sku ? (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Produk (SKU)</th>
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-foreground">{project.product_name}</p>
                    <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">{project.product_sku}</p>
                  </td>
                </tr>
              ) : (
                <tr>
                  <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Penempatan</th>
                  <td className="px-4 py-2.5 text-xs text-foreground">Milik model (tanpa SKU)</td>
                </tr>
              )}
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Status</th>
                <td className="px-4 py-2.5 text-xs text-foreground">
                  {VISIBILITY_LABEL[project.visibility]}
                </td>
              </tr>
              <tr>
                <th className="w-64 px-4 py-2.5 text-left align-top text-xs font-semibold">Ditambahkan</th>
                <td className="px-4 py-2.5 text-xs text-foreground">{project.created_at ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
