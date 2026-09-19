import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { RowActions, RowActionsMenu } from "@/components/admin/row-actions"
import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { DropdownMenuItem } from "@/components/admin/ui/dropdown-menu"
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
  name: string
  kind: string
  status: string
  visibility: string
  file?: string | null
  updated_at?: string | null
  thumb_url?: string | null
}

const TAB_KEYS = ["ringkasan", "varian", "spesifikasi", "media"] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_LABELS: Record<TabKey, string> = {
  ringkasan: "Ringkasan",
  varian: "Varian",
  spesifikasi: "Spesifikasi",
  media: "Media",
}

/** Tabel Varian: tiap kolom berdiri sendiri, angka rata kanan dengan tabular-nums. */
function VariantTable({ rows }: { rows: VariantRowData[] }) {
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon name="package" className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Varian</h2>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              <span className="tabular-nums">{formatNumber(tersaring.length)}</span>
              {tersaring.length === rows.length ? "" : ` dari ${formatNumber(rows.length)}`} entri
            </p>
          </div>
        </div>
      </div>

      <div className="px-4">
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
        <div className="px-4 py-12 text-center">
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
                <TableHead className="px-4">Varian</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4 text-right">Harga</TableHead>
                <TableHead className="px-4 text-right">Stok</TableHead>
                <TableHead className="px-4">SKU</TableHead>
                <TableHead className="w-[1%] px-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tersaring.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="px-4 font-medium">{row.label}</TableCell>
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
                  <TableCell className="w-[1%] whitespace-nowrap px-4 text-right">
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

/** Tabel Spesifikasi: nama, nilai, waktu ubah. Satuan tidak ada di schema. */
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
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
              <TableHead className="px-4">Nama</TableHead>
              <TableHead className="px-4">Nilai</TableHead>
              <TableHead className="px-4">Diperbarui</TableHead>
              <TableHead className="w-[1%] px-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/40">
                <TableCell className="px-4 font-medium">{row.name}</TableCell>
                <TableCell className="px-4 text-muted-foreground">{row.value}</TableCell>
                <TableCell className="whitespace-nowrap px-4 tabular-nums text-muted-foreground">
                  {row.updated_at ?? "-"}
                </TableCell>
                <TableCell className="w-[1%] whitespace-nowrap px-4 text-right">
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

/** Tabel Media: thumbnail kecil, tipe, status, publikasi, dan berkas dipisah. */
function MediaTable({
  rows,
  editHref,
  importHref,
}: {
  rows: MediaRowData[]
  editHref: string
  importHref: string
}) {
  const [publikasi, setPublikasi] = React.useState("")
  const [query, setQuery] = React.useState("")

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
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon name="image" className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Media</h2>
            <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
              <span className="tabular-nums">{formatNumber(tersaring.length)}</span>
              {tersaring.length === rows.length ? "" : ` dari ${formatNumber(rows.length)}`} entri
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={editHref}>Kelola media</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={importHref}>Import</Link>
          </Button>
        </div>
      </div>

      <div className="px-4">
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
        <div className="px-4 py-12 text-center">
          <Icon name="image" className="mx-auto size-6 text-muted-foreground/70" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            {adaFilter ? "Tidak ada media yang cocok" : "Belum ada media"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {adaFilter
              ? "Ubah kata kunci atau kosongkan filter untuk melihat semua media."
              : "Media ditambahkan dari tab Media di halaman edit produk atau lewat import."}
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
                <TableHead className="w-[1%] px-4">Preview</TableHead>
                <TableHead className="px-4">Nama media</TableHead>
                <TableHead className="px-4">Tipe</TableHead>
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="px-4">Publikasi</TableHead>
                <TableHead className="px-4">Berkas</TableHead>
                <TableHead className="px-4">Diperbarui</TableHead>
                <TableHead className="w-[1%] px-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tersaring.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40">
                  <TableCell className="w-[1%] px-4">
                    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                      {row.thumb_url ? (
                        <img
                          src={row.thumb_url}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Icon
                          name={row.kind === "video" ? "video-camera" : "image"}
                          className="size-4 text-muted-foreground/70"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 font-medium">{row.name}</TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {row.kind === "video" ? "Video" : "Foto"}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {statusMeta(row.status).label}
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusBadge status={row.visibility === "visible" ? "active" : "archived"} />
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate px-4 font-mono text-[11px] text-muted-foreground">
                    {row.file ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 tabular-nums text-muted-foreground">
                    {row.updated_at ?? "-"}
                  </TableCell>
                  <TableCell className="w-[1%] whitespace-nowrap px-4 text-right">
                    <RowActions>
                      <Button asChild variant="secondary" size="xs">
                        <Link href={editHref}>Kelola</Link>
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

export default function ProductShow({
  product,
  metadata,
  activeTab = "ringkasan",
  counts,
  variants = [],
  attributes = [],
  media = [],
  links,
}: {
  product: ProductHeader
  metadata: DetailField[]
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

  const propTab: TabKey = (TAB_KEYS as readonly string[]).includes(activeTab)
    ? (activeTab as TabKey)
    : "ringkasan"

  // Tab aktif disimpan lokal supaya perpindahan tab instan (tanpa muat ulang),
  // sementara URL tetap mencatat tab aktif agar reload dan back/forward konsisten.
  const [tab, setTab] = React.useState<TabKey>(propTab)

  const description = (product.description ?? "").trim()
  const descriptionIsLong = description.length > 240

  React.useEffect(() => {
    // Tab awal datang dari server lewat prop saat pindah produk via Inertia.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(propTab)
  }, [propTab])

  function pilihTab(next: TabKey) {
    if (typeof window === "undefined" || next === tab) return

    const url = new URL(window.location.href)
    if (next === "ringkasan") {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", next)
    }

    window.history.pushState({}, "", url.toString())
    setTab(next)
  }

  // Back/forward browser mengembalikan tab sesuai URL, tanpa memuat ulang halaman.
  React.useEffect(() => {
    function onPopState() {
      const dari = new URL(window.location.href).searchParams.get("tab") ?? "ringkasan"
      setTab((TAB_KEYS as readonly string[]).includes(dari) ? (dari as TabKey) : "ringkasan")
    }

    window.addEventListener("popstate", onPopState)

    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const tabBadge: Record<TabKey, number | null> = {
    ringkasan: null,
    varian: counts.varian,
    spesifikasi: counts.spesifikasi,
    media: counts.media,
  }

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
      <RowActionsMenu label="Lainnya">
        <DropdownMenuItem asChild>
          <Link href={links.import}>Import data</Link>
        </DropdownMenuItem>
        <ConfirmAction
          trigger={
            <button
              type="button"
              className={cn(
                "w-full px-2 py-1.5 text-left text-xs",
                archived ? "text-foreground hover:bg-muted" : "text-destructive hover:bg-destructive/10",
              )}
            >
              {archived ? "Pulihkan produk" : "Arsipkan produk"}
            </button>
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
      </RowActionsMenu>
    </>
  )

  return (
    <AdminLayout
      title={product.name}
      description={`Parent SKU · ${product.parent_sku}`}
      actions={actions}
      backUrl={routeUrl("admin.products.index")}
    >
      <Head title={`${product.name} | Admin`} />

      <div className="space-y-4">
        {/* Metadata produk: grid tanpa kartu per field, garis pemisah saja */}
        <section className="border-y border-border bg-card" aria-label="Metadata produk">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {metadata.map((field, index) => (
              <div
                key={`${field.label}-${index}`}
                className="border-b border-r border-border px-4 py-3 last:border-r-0"
              >
                <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                <div className="mt-1 text-[13px] font-medium leading-5 text-foreground">
                  {field.label === "Status" ? (
                    <StatusBadge status={field.value} />
                  ) : field.value ? (
                    String(field.value)
                  ) : (
                    <span className="font-normal text-muted-foreground">Belum tersedia</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tab utama: hanya isi tab aktif yang dirender */}
        <div
          role="tablist"
          aria-label="Bagian detail produk"
          className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1"
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
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium transition",
                  isActive
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent",
                )}
              >
                {TAB_LABELS[key]}
                {jumlah ? (
                  <span className="tabular-nums text-[11px] text-muted-foreground">{jumlah}</span>
                ) : null}
              </button>
            )
          })}
        </div>

        {tab === "ringkasan" ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Deskripsi</h2>
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
              <div className="px-4 py-3.5">
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

            <section className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3.5">
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Data katalog</h2>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface/80">
                    <TableHead className="px-4">Jenis data</TableHead>
                    <TableHead className="px-4 text-right">Jumlah</TableHead>
                    <TableHead className="px-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="px-4 font-medium">Varian</TableCell>
                    <TableCell className="px-4 text-right tabular-nums">{formatNumber(counts.varian)}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {counts.varian ? "Tersedia" : "Belum ada data"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-4 font-medium">Spesifikasi</TableCell>
                    <TableCell className="px-4 text-right tabular-nums">
                      {formatNumber(counts.spesifikasi)}
                    </TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {counts.spesifikasi ? "Tersedia" : "Belum ada data"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-4 font-medium">Media</TableCell>
                    <TableCell className="px-4 text-right tabular-nums">{formatNumber(counts.media)}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">
                      {counts.media ? "Tersedia" : "Belum ada data"}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </section>
          </div>
        ) : null}

        {tab === "varian" ? <VariantTable rows={variants} /> : null}

        {tab === "spesifikasi" ? (
          <SpecificationTable rows={attributes} manageHref={links.attributes} />
        ) : null}

        {tab === "media" ? (
          <MediaTable rows={media} editHref={links.media} importHref={links.import} />
        ) : null}
      </div>
    </AdminLayout>
  )
}
