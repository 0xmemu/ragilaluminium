import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { DetailField } from "@/types"

interface ProductHeader {
  id: number
  name: string
  parent_sku: string
  status: string
  description?: string | null
  public_visible: boolean
  image_url?: string | null
  edit_href: string
  product_href: string
}

interface VariantRowData {
  id: number
  label: string
  status: string
  price: number
  stock: number
  sku: string
  edit_url: string
}

interface AttributeRowData {
  id: number
  name: string
  value: string
  updated_at?: string | null
}

interface MediaRowData {
  id: number
  media_asset_id?: number | null
  name: string
  kind: string
  status: string
  visibility: string
  file?: string | null
  updated_at?: string | null
  thumb_url?: string | null
  preview_url?: string | null
  library_url?: string | null
}

const TAB_KEYS = ["varian", "spesifikasi", "media"] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_LABELS: Record<TabKey, string> = {
  varian: "Varian",
  spesifikasi: "Spesifikasi & Deskripsi",
  media: "Media",
}

/** Tabel Varian: tiap kolom berdiri sendiri, angka rata kanan dengan tabular-nums. */
function VariantTable({ rows, manageHref }: { rows: VariantRowData[]; manageHref: string }) {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [sort, setSort] = React.useState("sku")

  const statusOptions = React.useMemo(() => {
    const unique = Array.from(new Set(rows.map((row) => row.status).filter(Boolean)))
    return unique.sort()
  }, [rows])

  const tersaring = React.useMemo(() => {
    const kata = query.trim().toLowerCase()
    const hasil = rows.filter((row) => {
      if (status && row.status !== status) return false
      if (!kata) return true

      return row.label.toLowerCase().includes(kata) || row.sku.toLowerCase().includes(kata)
    })

    return hasil.sort((a, b) => {
      if (sort === "harga") return b.price - a.price
      if (sort === "stok") return b.stock - a.stock

      return a.sku.localeCompare(b.sku)
    })
  }, [rows, query, status, sort])

  const adaFilter = query.trim() !== "" || status !== ""

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon name="package" className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Varian</h2>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              <span className="tabular-nums">{formatNumber(tersaring.length)}</span>
              {tersaring.length === rows.length ? "" : " dari " + formatNumber(rows.length)} entri
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={manageHref}>Kelola varian</Link>
        </Button>
      </div>

      <div className="px-4 sm:px-5">
        <ListToolbar
          className="mt-0"
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Cari varian atau SKU…",
          }}
          sort={
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              className="w-auto"
              aria-label="Urutan varian"
            >
              <option value="sku">SKU (A-Z)</option>
              <option value="harga">Harga tertinggi</option>
              <option value="stok">Stok terbanyak</option>
            </Select>
          }
        >
          <Select
            className="flex-1 min-w-0"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter status varian"
          >
            <option value="">Semua status</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {statusMeta(option).label}
              </option>
            ))}
          </Select>
        </ListToolbar>
      </div>

      {tersaring.length === 0 ? (
        <div className="px-4 py-12 text-center sm:px-5">
          <Icon name="package" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            {adaFilter ? "Tidak ada varian yang cocok" : "Belum ada varian"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {adaFilter
              ? "Ubah kata kunci atau kosongkan filter untuk melihat semua varian."
              : "Varian dibuat dari tab Varian di halaman edit produk."}
          </p>
          {adaFilter ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setQuery("")
                setStatus("")
              }}
            >
              Reset filter
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface/80">
                <TableHead className="px-4 sm:px-5">Varian</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Harga</TableHead>
                <TableHead className="px-4 text-right">Stok</TableHead>
                <TableHead className="px-4">SKU</TableHead>
                <TableHead className="w-[1%] px-4 text-right sm:px-5">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tersaring.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="px-4 font-medium sm:px-5">{row.label}</TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 text-right tabular-nums font-semibold">
                    {formatCurrency(row.price)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 text-right tabular-nums">
                    {formatNumber(row.stock)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 font-mono text-[11px] text-muted-foreground">
                    {row.sku}
                  </TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap px-4 text-right sm:px-5">
                    <RowActions>
                      <Button asChild variant="secondary" size="xs">
                        <Link href={row.edit_url}>Edit</Link>
                      </Button>
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}

/** Tabel Spesifikasi: nama, nilai, waktu ubah. */
function SpecificationTable({ rows, manageHref }: { rows: AttributeRowData[]; manageHref: string }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="sliders"
        title="Belum ada spesifikasi untuk produk ini"
        description="Spesifikasi tampil di halaman produk sebagai bagian Informasi produk, misalnya Bahan, Kusen, Ketebalan Aluminium, atau Merek."
        action={
          <Button asChild size="sm">
            <Link href={manageHref}>
              <Icon name="plus" className="size-4" aria-hidden="true" />
              Tambah spesifikasi
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon name="sliders" className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Spesifikasi</h2>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              <span className="tabular-nums">{formatNumber(rows.length)}</span> entri
            </p>
          </div>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={manageHref}>Kelola spesifikasi</Link>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface/80">
              <TableHead className="px-4 sm:px-5">Nama</TableHead>
              <TableHead className="px-4">Nilai</TableHead>
              <TableHead className="px-4">Diperbarui</TableHead>
              <TableHead className="w-[1%] px-4 text-right sm:px-5">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/40">
                <TableCell className="px-4 font-medium sm:px-5">{row.name}</TableCell>
                <TableCell className="px-4 text-muted-foreground">{row.value}</TableCell>
                <TableCell className="whitespace-nowrap px-4 tabular-nums text-muted-foreground">
                  {row.updated_at ?? "-"}
                </TableCell>
                <TableCell className="w-[1%] whitespace-nowrap px-4 text-right sm:px-5">
                  <RowActions>
                    <Button asChild variant="secondary" size="xs">
                      <Link href={manageHref}>Edit</Link>
                    </Button>
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

/** Tabel Media: thumbnail baris besar setinggi row, preview modal, tautan ke media library. */
function MediaTable({
  rows,
  manageHref,
}: {
  rows: MediaRowData[]
  manageHref: string
}) {
  const [publikasi, setPublikasi] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [previewItem, setPreviewItem] = React.useState<MediaRowData | null>(null)

  const tersaring = React.useMemo(() => {
    const kata = query.trim().toLowerCase()

    return rows.filter((row) => {
      if (publikasi && row.visibility !== publikasi) return false
      if (!kata) return true

      return (
        row.name.toLowerCase().includes(kata) ||
        (row.file ?? "").toLowerCase().includes(kata)
      )
    })
  }, [rows, publikasi, query])

  const adaFilter = publikasi !== "" || query.trim() !== ""

  return (
    <>
      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon name="image" className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Media</h2>
              <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                <span className="tabular-nums">{formatNumber(tersaring.length)}</span>
                {tersaring.length === rows.length ? "" : " dari " + formatNumber(rows.length)} entri
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={manageHref}>Kelola media</Link>
          </Button>
        </div>

        <div className="px-4 sm:px-5">
          <ListToolbar
            className="mt-0"
            search={{
              value: query,
              onChange: setQuery,
              placeholder: "Cari nama media atau berkas…",
            }}
          >
            <Select
              className="flex-1 min-w-0"
              value={publikasi}
              onChange={(event) => setPublikasi(event.target.value)}
              aria-label="Filter publikasi media"
            >
              <option value="">Semua publikasi</option>
              <option value="visible">Tampil</option>
              <option value="hidden">Disembunyikan</option>
              <option value="archived">Diarsipkan</option>
            </Select>
          </ListToolbar>
        </div>

        {tersaring.length === 0 ? (
          <div className="px-4 py-12 text-center sm:px-5">
            <Icon name="image" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-foreground">
              {adaFilter ? "Tidak ada media yang cocok" : "Belum ada media"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {adaFilter
                ? "Ubah kata kunci atau kosongkan filter untuk melihat semua media."
                : "Media dikelola dari Media Library atau tab Media di form edit produk."}
            </p>
            {adaFilter ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setQuery("")
                  setPublikasi("")
                }}
              >
                Reset filter
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface/80">
                  <TableHead className="w-[1%] px-4 sm:px-5">Preview</TableHead>
                  <TableHead className="px-4">Nama media</TableHead>
                  <TableHead className="px-4">Tipe</TableHead>
                  <TableHead className="px-4">Status File</TableHead>
                  <TableHead className="px-4">Publikasi</TableHead>
                  <TableHead className="px-4">Berkas</TableHead>
                  <TableHead className="px-4">Diperbarui</TableHead>
                  <TableHead className="w-[1%] px-4 text-right sm:px-5">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tersaring.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/40">
                    <TableCell className="w-[1%] px-4 py-2 sm:px-5">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(row)}
                        className="group relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted transition hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary"
                        title="Klik untuk melihat preview ukuran penuh"
                        aria-label={"Preview " + row.name}
                      >
                        {row.thumb_url ? (
                          <img
                            src={row.thumb_url}
                            alt=""
                            className="size-full object-cover transition duration-150 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <Icon
                            name={row.kind === "video" ? "video-camera" : "image"}
                            className="size-5 text-muted-foreground/70"
                            aria-hidden="true"
                          />
                        )}
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition duration-150 group-hover:opacity-100">
                          <Icon name="eye" className="size-4 text-white" aria-hidden="true" />
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="px-4 font-medium">{row.name}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {row.kind === "video" ? "Video" : "Foto"}
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {statusMeta(row.status).label}
                    </TableCell>
                    <TableCell className="px-4">
                      <StatusBadge status={row.visibility} />
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate px-4 font-mono text-[11px]">
                      {row.file ? (
                        <Link
                          href={row.library_url ?? routeUrl("admin.media.library")}
                          className="text-primary transition hover:underline"
                          title="Buka asal media di Media Library"
                        >
                          {row.file}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 tabular-nums text-muted-foreground">
                      {row.updated_at ?? "-"}
                    </TableCell>
                    <TableCell className="w-[1%] whitespace-nowrap px-4 text-right sm:px-5">
                      <RowActions>
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => setPreviewItem(row)}
                        >
                          Preview
                        </Button>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Modal Preview Media */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {previewItem?.name}
              </DialogTitle>
              {previewItem?.file ? (
                <DialogDescription className="font-mono text-xs text-muted-foreground">
                  {previewItem.file}
                </DialogDescription>
              ) : null}
            </div>
            {previewItem?.library_url ? (
              <Button asChild variant="secondary" size="xs">
                <Link href={previewItem.library_url} target="_blank">
                  <Icon name="arrow-up-right" className="size-3.5" aria-hidden="true" />
                  Buka di Library
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="flex max-h-[65vh] items-center justify-center bg-black/90 p-4">
            {previewItem?.kind === "video" ? (
              <video
                src={previewItem.preview_url || previewItem.thumb_url || ""}
                controls
                className="max-h-[60vh] w-auto max-w-full rounded"
              />
            ) : (
              <img
                src={previewItem?.preview_url || previewItem?.thumb_url || ""}
                alt={previewItem?.name || ""}
                className="max-h-[60vh] w-auto max-w-full object-contain"
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Publikasi:</span>
              {previewItem ? <StatusBadge status={previewItem.visibility} /> : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPreviewItem(null)}
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function ProductShow({
  product,
  details,
  activeTab = "varian",
  counts,
  variants = [],
  attributes = [],
  media = [],
  links,
}: {
  product: ProductHeader
  details: DetailField[]
  activeTab?: string
  counts: { varian: number; spesifikasi: number; media: number }
  variants: VariantRowData[]
  attributes: AttributeRowData[]
  media: MediaRowData[]
  links: { variants: string; attributes: string; media: string; import: string }
}) {
  const archiveForm = useForm({})
  const archived = product.status === "archived"
  const [descriptionExpanded, setDescriptionExpanded] = React.useState(false)
  const [copiedSku, setCopiedSku] = React.useState(false)

  const propTab: TabKey = (TAB_KEYS as readonly string[]).includes(activeTab)
    ? (activeTab as TabKey)
    : "varian"

  // Tab aktif disimpan lokal agar perpindahan tab instan tanpa reload,
  // dan URL tetap dicatat (?tab=) untuk reload serta tombol back/forward.
  const [tab, setTab] = React.useState<TabKey>(propTab)

  const description = (product.description ?? "").trim()
  const descriptionIsLong = description.length > 240

  React.useEffect(() => {
    // Tab awal datang dari server lewat prop saat navigasi produk Inertia.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(propTab)
  }, [propTab])

  function pilihTab(next: TabKey) {
    if (typeof window === "undefined" || next === tab) return

    const url = new URL(window.location.href)
    if (next === "varian") {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", next)
    }

    window.history.pushState({}, "", url.toString())
    setTab(next)
  }

  // Back/forward browser mengembalikan tab sesuai URL.
  React.useEffect(() => {
    function onPopState() {
      const dari = new URL(window.location.href).searchParams.get("tab") ?? "varian"
      setTab((TAB_KEYS as readonly string[]).includes(dari) ? (dari as TabKey) : "varian")
    }

    window.addEventListener("popstate", onPopState)

    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const tabBadge: Record<TabKey, number | null> = {
    varian: counts.varian,
    spesifikasi: counts.spesifikasi,
    media: counts.media,
  }

  // Bagi detail produk menjadi dua kelompok kolom seimbang:
  // Kolom 1 (katalog): Kategori, Model, Sub Model
  // Kolom 2 (paket & kirim): Berat paket, Dimensi paket, Pengiriman
  const col1 = details.filter((d) => ["Kategori", "Model", "Sub Model"].includes(d.label))
  const col2 = details.filter((d) => !["Kategori", "Model", "Sub Model"].includes(d.label))

  const actions = (
    <>
      {product.public_visible ? (
        <Button asChild variant="secondary">
          <a href={product.product_href} target="_blank" rel="noreferrer">
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
        <Link href={product.edit_href}>
          <Icon name="pencil" className="h-4 w-4" aria-hidden="true" />
          Edit produk
        </Link>
      </Button>
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
              product: product.id,
            }),
          )
        }
      />
    </>
  )

  return (
    <AdminLayout
      title={product.name}
      description={"Parent SKU · " + product.parent_sku}
      actions={actions}
      backUrl={routeUrl("admin.products.index")}
    >
      <Head title={product.name + " | Admin"} />

      <div className="space-y-4">
        {/* Dua kartu seimbang 50-50: identitas (foto 1:1 full-height) di kiri, detail 2 kolom di kanan */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section
            className="flex overflow-hidden rounded-lg border border-border bg-card"
            aria-label="Identitas produk"
          >
            {/* Foto utama 1:1 persegi mengisi penuh tinggi kartu */}
            <div
              style={{ width: "202px" }}
              className="relative flex h-full shrink-0 items-center justify-center overflow-hidden border-r border-border bg-muted"
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={"Foto utama " + product.name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <Icon name="image" className="size-8 text-muted-foreground/50" aria-hidden="true" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between p-4 sm:p-5">
              <div>
                <h2
                  className="text-lg font-bold leading-snug text-foreground line-clamp-2 sm:text-xl"
                  title={product.name}
                >
                  {product.name}
                </h2>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="font-mono text-sm font-medium text-muted-foreground">
                    Parent SKU · {product.parent_sku}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(product.parent_sku)
                        setCopiedSku(true)
                        setTimeout(() => setCopiedSku(false), 2000)
                      }
                    }}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Salin Parent SKU"
                    title={copiedSku ? "Tersalin!" : "Salin Parent SKU"}
                  >
                    <Icon name={copiedSku ? "check" : "copy"} className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <StatusBadge status={product.status} />
                {product.public_visible ? (
                  <span className="text-xs text-muted-foreground">· Tayang di toko</span>
                ) : null}
              </div>
            </div>
          </section>

          <section
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
            aria-label="Detail produk"
          >
            <div className="border-b border-border px-4 py-2.5 sm:px-5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Detail produk</h2>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2 sm:p-5">
              <div className="space-y-2.5">
                {col1.map((field, index) => (
                  <div key={field.label + "-" + index}>
                    <dt className="text-[11px] font-medium text-muted-foreground">{field.label}</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                      {field.value ? (
                        String(field.value)
                      ) : (
                        <span className="font-normal text-muted-foreground">Belum tersedia</span>
                      )}
                    </dd>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {col2.map((field, index) => (
                  <div key={field.label + "-" + index}>
                    <dt className="text-[11px] font-medium text-muted-foreground">{field.label}</dt>
                    <dd className="mt-0.5 text-[13px] font-medium text-foreground">
                      {field.value ? (
                        String(field.value)
                      ) : (
                        <span className="font-normal text-muted-foreground">Belum tersedia</span>
                      )}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Tab utama: Varian, Spesifikasi & Deskripsi, Media */}
        <div
          role="tablist"
          aria-label="Bagian detail produk"
          className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto pb-1"
        >
          {TAB_KEYS.map((key) => {
            const isActive = key === tab
            const jumlah = tabBadge[key]

            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => pilihTab(key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium transition",
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border font-semibold"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent",
                )}
              >
                {TAB_LABELS[key]}
                {jumlah !== null && jumlah !== undefined ? (
                  <span className="tabular-nums text-[11px] text-muted-foreground">{jumlah}</span>
                ) : null}
              </button>
            )
          })}
        </div>

        {tab === "varian" ? (
          <VariantTable rows={variants} manageHref={links.variants} />
        ) : null}

        {tab === "spesifikasi" ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon name="notes" className="size-3.5" aria-hidden="true" />
                  </span>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground">Deskripsi</h2>
                </div>
                {descriptionIsLong ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDescriptionExpanded((value) => !value)}
                  >
                    {descriptionExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                  </Button>
                ) : null}
              </div>
              <div className="px-4 py-3.5 sm:px-5">
                {description ? (
                  <p
                    className={cn(
                      "whitespace-pre-line text-[13px] leading-6 text-foreground",
                      descriptionIsLong && !descriptionExpanded && "line-clamp-4",
                    )}
                  >
                    {description}
                  </p>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Icon name="warning" className="size-4 text-destructive" aria-hidden="true" />
                    Belum diisi. Deskripsi wajib sebelum produk bisa diaktifkan.
                  </p>
                )}
              </div>
            </section>

            <SpecificationTable rows={attributes} manageHref={links.attributes} />
          </div>
        ) : null}

        {tab === "media" ? (
          <MediaTable rows={media} manageHref={links.media} />
        ) : null}
      </div>
    </AdminLayout>
  )
}
