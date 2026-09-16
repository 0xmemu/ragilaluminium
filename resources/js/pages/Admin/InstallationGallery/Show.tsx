import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { Input } from "@/components/admin/ui/input"
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

const VISIBILITY_LABEL: Record<MediaRow["visibility"], string> = {
  visible: "Aktif",
  hidden: "Disembunyikan",
  archived: "Diarsipkan",
}

export default function InstallationGalleryShow({ title, group, backUrl }: ShowProps) {
  const [rows, setRows] = React.useState<MediaRow[]>(group.media ?? [])

  function reload() {
    router.reload({ only: ["group"] })
  }

  return (
    <AdminLayout
      title={title}
      description={`Daftar media hasil pemasangan di grup "${group.label}".`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={backUrl}>
              <Icon name="arrow-left" className="size-4" aria-hidden="true" />
              Kembali
            </Link>
          </Button>
        </div>
      }
    >
      <Head title={`${title} | Media Hasil Pemasangan`} />

      <div className="space-y-5">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon name="image" className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Belum ada media di grup ini
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Tambahkan media lewat tombol "Tambah Pemasangan" di halaman daftar.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-20" />
                  <col />
                  <col className="w-48" />
                  <col className="w-24" />
                  <col className="w-28" />
                  <col className="w-24" />
                </colgroup>
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3">Media</th>
                    <th className="px-3 py-3">Keterangan</th>
                    <th className="px-3 py-3">Produk (SKU)</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Ditambahkan</th>
                    <th className="py-3 pl-2 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, index) => (
                    <tr key={row.id} className="transition-colors hover:bg-muted/30">
                      {/* Thumbnail */}
                      <td className="px-3 py-3">
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

                      {/* Keterangan */}
                      <td className="px-3 py-3">
                        <p className="line-clamp-2 font-medium text-foreground">
                          {row.caption || "Tanpa keterangan"}
                        </p>
                      </td>

                      {/* SKU */}
                      <td className="px-3 py-3">
                        {row.product_sku ? (
                          <>
                            <p className="truncate font-medium text-foreground">{row.product_name}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.product_sku}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            row.visibility === "visible"
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                              : row.visibility === "hidden"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
                          )}
                        >
                          {VISIBILITY_LABEL[row.visibility]}
                        </span>
                      </td>

                      {/* Tanggal */}
                      <td className="px-3 py-3 text-center text-muted-foreground">
                        {row.created_at ?? "—"}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 pl-2 pr-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              router.patch(row.toggleStatusUrl, {}, { preserveScroll: true })
                            }
                          >
                            <Icon
                              name={row.visibility === "visible" ? "eye-slash" : "eye"}
                              className="size-3.5"
                            />
                            {row.visibility === "visible" ? "Sembunyikan" : "Tampilkan"}
                          </Button>

                          {row.visibility !== "archived" ? (
                            <ConfirmAction
                              trigger={
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-700">
                                  <Icon name="archive" className="size-3.5" />
                                  Arsip
                                </Button>
                              }
                              title="Arsipkan media?"
                              description="Media ini akan keluar dari halaman publik hasil pemasangan."
                              confirmLabel="Arsipkan"
                              onConfirm={() => router.post(row.archiveUrl, {}, { preserveScroll: true })}
                            />
                          ) : null}

                          <ConfirmAction
                            trigger={
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-destructive"
                                aria-label={`Hapus media ${index + 1}`}
                              >
                                <Icon name="trash-2" className="size-3.5" />
                              </Button>
                            }
                            title="Hapus media?"
                            description="Hapus media ini secara permanen? Tindakan tidak dapat dibatalkan."
                            confirmLabel="Hapus"
                            variant="destructive"
                            onConfirm={() => router.delete(row.destroyUrl, { preserveScroll: true })}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
