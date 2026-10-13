import { Head, Link } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatDate } from "@/lib/format"

interface DocumentItem {
  key: string
  title: string
  description: string
  slug: string
  public_url: string
  edit_url: string
  updated_at?: string | null
  published: boolean
}

interface Props {
  title: string
  description: string
  documents: DocumentItem[]
}

export default function DocumentsIndex({ title, description, documents }: Props) {
  return (
    <AdminLayout title={title} description={description}>
      <Head title={`${title} | Admin`} />

      <div className="w-full space-y-6">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Dokumen Legal & Kebijakan</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dokumen resmi yang ditampilkan pada tautan footer toko dan dibaca oleh pelanggan.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-surface/80 text-[11px] font-semibold text-muted-foreground">
                  <th className="px-4 py-3 text-left">Nama Dokumen</th>
                  <th className="px-4 py-3 text-left">URL Publik</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-left">Terakhir Diperbarui</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.key} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex items-start gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-primary">
                          <Icon
                            name={doc.key === "ketentuan_layanan" ? "gavel" : "shield-check"}
                            className="size-4"
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={doc.edit_url}
                            className="font-semibold text-foreground hover:text-primary hover:underline text-sm"
                          >
                            {doc.title}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {doc.description}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 align-middle">
                      <a
                        href={doc.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
                      >
                        <span>/{doc.slug}</span>
                        <Icon name="arrow-up-right" className="size-3" aria-hidden="true" />
                      </a>
                    </td>

                    <td className="px-4 py-3.5 text-center align-middle">
                      <StatusBadge status={doc.published ? "active" : "inactive"} />
                    </td>

                    <td className="px-4 py-3.5 align-middle text-muted-foreground">
                      {doc.updated_at ? formatDate(doc.updated_at) : "-"}
                    </td>

                    <td className="px-4 py-3.5 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs">
                          <a href={doc.public_url} target="_blank" rel="noreferrer">
                            <Icon name="arrow-up-right" className="size-3.5 mr-1" aria-hidden="true" />
                            Lihat publik
                          </a>
                        </Button>
                        <Button asChild size="sm" className="h-8 text-xs">
                          <Link href={doc.edit_url}>
                            <Icon name="pencil" className="size-3.5 mr-1" aria-hidden="true" />
                            Edit konten
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
