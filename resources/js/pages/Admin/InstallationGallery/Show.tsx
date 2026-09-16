import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu, rowActionTextClass } from "@/components/admin/row-actions"
import { SectionCard } from "@/components/admin/section-card"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

interface MediaRow {
  id: number
  media_id: number
  url: string
  thumb: string
  is_video: boolean
  caption: string
  visibility: "visible" | "hidden" | "archived"
  product_sku: string
  product_name: string
  created_at?: string | null
  toggleStatusUrl: string
  updateMediaUrl: string
  archiveUrl: string
  destroyUrl: string
}

interface ShowProps {
  title: string
  group: {
    label: string
    group: string
    media: MediaRow[]
  }
  backUrl: string
}

export default function InstallationGalleryShow({ title, group, backUrl }: ShowProps) {
  const [rows, setRows] = React.useState<MediaRow[]>(group.media ?? [])
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [editValue, setEditValue] = React.useState("")

  const editForm = useForm({
    installation_caption: "",
  })

  React.useEffect(() => {
    setRows(group.media ?? [])
  }, [group.media])

  function startEdit(row: MediaRow) {
    setEditingId(row.media_id)
    setEditValue(row.caption)
  }

  function submitEdit(row: MediaRow) {
    editForm.setData("installation_caption", editValue)
    editForm.patch(row.updateMediaUrl, {
      preserveScroll: true,
      onSuccess: () => {
        setEditingId(null)
        setRows((prev) =>
          prev.map((r) => (r.media_id === row.media_id ? { ...r, caption: editValue } : r)),
        )
      },
    })
  }

  const hasSku = rows.some((row) => Boolean(row.product_sku))
  const videoCount = rows.filter((row) => row.is_video).length

  return (
    <AdminLayout
      title={title}
      description="Kelola media hasil pemasangan di grup ini: keterangan, visibilitas, dan arsip."
      backUrl={backUrl}
    >
      <Head title={`${title} | Media Hasil Pemasangan`} />

      <SectionCard
        title="Media dalam grup"
        description={`${rows.length} media${videoCount ? ` · ${videoCount} video` : ""}. Tombol Edit mengubah keterangan; aksi lain ada di menu Lainnya.`}
        icon="image"
        contentClassName="p-0"
      >
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Icon name="images" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
            <p className="mt-2 text-xs text-muted-foreground">
              Belum ada media di grup ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Media</th>
                  <th className="px-3 py-3 text-left">Keterangan</th>
                  {hasSku ? <th className="px-3 py-3 text-left">Produk (SKU)</th> : null}
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row, index) => (
                  <tr key={row.id} className="transition-colors hover:bg-muted/40">
                    {/* Thumbnail */}
                    <td className="px-4 py-3 align-middle">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                        {row.thumb ? (
                          <img
                            src={row.thumb}
                            alt={row.caption || "Media pemasangan"}
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-muted-foreground">
                            <Icon name="image" className="size-5" />
                          </div>
                        )}
                        {row.is_video && (
                          <span className="absolute bottom-1 right-1 flex size-4 items-center justify-center rounded-full bg-black/70 text-white">
                            <Icon name="play" className="size-2.5 fill-current" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Keterangan + meta */}
                    <td className="px-3 py-3 align-middle">
                      {editingId === row.media_id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            submitEdit(row)
                          }}
                          className="min-w-56 space-y-1.5"
                        >
                          <Input
                            value={editValue}
                            onChange={(event) => setEditValue(event.target.value)}
                            placeholder="Keterangan media"
                            className="h-8 text-xs"
                            autoFocus
                          />
                          <div className="flex items-center gap-1">
                            <Button type="submit" size="sm" className="h-7 text-xs" disabled={editForm.processing}>
                              Simpan
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditingId(null)}
                            >
                              Batal
                            </Button>
                          </div>
                          {editForm.errors.installation_caption ? (
                            <p className="text-[11px] text-destructive">{editForm.errors.installation_caption}</p>
                          ) : null}
                        </form>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">
                            {row.caption || <span className="italic text-muted-foreground">Tanpa keterangan</span>}
                          </p>
                          <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Icon
                              name={row.is_video ? "video-camera" : "image"}
                              className="size-3"
                              aria-hidden="true"
                            />
                            {row.is_video ? "Video" : "Foto"} · {row.created_at ?? "—"}
                          </p>
                        </div>
                      )}
                    </td>

                    {/* SKU */}
                    {hasSku ? (
                      <td className="px-3 py-3 align-middle">
                        {row.product_sku ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-foreground">{row.product_name}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{row.product_sku}</p>
                          </div>
                        ) : (
                          <span className="italic text-muted-foreground">Media grup</span>
                        )}
                      </td>
                    ) : null}

                    {/* Status: dua status saja (Aktif / Diarsipkan) */}
                    <td className="px-3 py-3 text-center align-middle">
                      <div className="inline-flex items-center justify-center">
                        <StatusBadge status={row.visibility === "visible" ? "active" : "archived"} />
                      </div>
                    </td>

                    {/* Aksi: satu tombol teks + dropdown sekunder (pola halaman Produk) */}
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-right align-middle">
                      <RowActions className="flex-nowrap">
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => startEdit(row)}
                        >
                          Edit
                        </Button>

                        <RowActionsMenu>
                          {row.visibility === "visible" ? (
                            <ConfirmAction
                              trigger={
                                <button type="button" className={cn("w-full text-left", rowActionTextClass)}>
                                  Arsipkan
                                </button>
                              }
                              title="Arsipkan media?"
                              description="Media ini akan keluar dari halaman publik hasil pemasangan."
                              confirmLabel="Arsipkan"
                              onConfirm={() => router.post(row.archiveUrl, {}, { preserveScroll: true })}
                            />
                          ) : (
                            <DropdownMenuItem
                              onSelect={() => router.patch(row.toggleStatusUrl, {}, { preserveScroll: true })}
                            >
                              Aktifkan kembali
                            </DropdownMenuItem>
                          )}

                          <ConfirmAction
                            trigger={
                              <button
                                type="button"
                                className="w-full px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                              >
                                Hapus Permanen
                              </button>
                            }
                            title="Hapus media?"
                            description="Hapus media ini secara permanen? Tindakan tidak dapat dibatalkan."
                            confirmLabel="Hapus Permanen"
                            variant="destructive"
                            onConfirm={() => router.delete(row.destroyUrl, { preserveScroll: true })}
                          />
                        </RowActionsMenu>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <div className="mt-5">
        <Button asChild variant="secondary">
          <Link href={backUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali ke daftar grup
          </Link>
        </Button>
      </div>
    </AdminLayout>
  )
}