import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { Card } from "@/components/admin/ui/card"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"
import { useRowDragSort } from "@/hooks/use-row-drag-sort"
import AdminLayout from "@/layouts/admin-layout"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PopularRow {
  id: number
  name: string
  parent_sku: string
  thumb_url: string | null
  href: string
  category_label: string
  model_label: string
  design_label: string
  is_eligible: boolean
  in_window: boolean
  since: string | null
  since_label: string | null
  views_before: number | null
  clicks_before: number | null
  views_after: number | null
  clicks_after: number | null
  delta_views: number | null
  delta_clicks: number | null
}

/** Angka views/clicks "sebelum → sesudah" dengan selisih berwarna. */
function EngagementCell({
  before,
  after,
  delta,
}: {
  before: number | null
  after: number | null
  delta: number | null
}) {
  if (before === null && after === null) {
    return <span className="text-xs text-muted-foreground">-</span>
  }

  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs tabular-nums">
      <span className="text-muted-foreground">{formatNumber(before ?? 0)}</span>
      <span className="text-muted-foreground" aria-hidden="true">
        →
      </span>
      <span className="font-semibold text-foreground">{formatNumber(after ?? 0)}</span>
      {delta !== null && delta !== 0 ? (
        <span
          className={cn("font-semibold", delta > 0 ? "text-success" : "text-destructive")}
          title="Selisih dibanding periode sebelumnya"
        >
          ({delta > 0 ? "+" : ""}
          {formatNumber(delta)})
        </span>
      ) : null}
    </span>
  )
}

/** Sel produk yang dipakai di kedua tabel (carousel & produk lain). */
function ProductCell({ row }: { row: PopularRow }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
        {row.thumb_url ? (
          <img src={row.thumb_url} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <Icon name="image" className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={row.href}
          className="truncate font-semibold text-primary hover:underline"
          title={`Lihat detail ${row.name}`}
          draggable={false}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {row.name}
        </Link>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">{row.parent_sku}</span>
          {row.in_window ? (
            <span
              className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
              title={
                row.since_label
                  ? `Masuk carousel sejak ${row.since_label}`
                  : "Masuk carousel dalam 24 jam terakhir"
              }
            >
              Carousel
            </span>
          ) : null}
          {!row.is_eligible ? (
            <span
              className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
              title="Belum tayang di toko: status bukan aktif atau belum punya varian aktif"
            >
              Belum aktif
            </span>
          ) : null}
        </span>
      </span>
    </div>
  )
}

/** Taksonomi digabung satu kolom supaya kolom lain tidak terdesak. */
function taxonomy(row: PopularRow): string {
  return [row.category_label, row.model_label, row.design_label].filter(Boolean).join(" · ")
}

/**
 * Pengaturan urutan "Paling Banyak Dipesan".
 *
 * Urutan baris = urutan galeri /products/all?from=paling-banyak-dipesan; 10
 * teratas mengisi carousel beranda & halaman katalog. Zona carousel dipisah
 * dari produk lain supaya batas 10 teratas langsung terlihat, dan daftar
 * sisanya bisa dicari (katalog bisa ratusan SKU).
 */
export default function BerandaPopular({
  title,
  description,
  products: initialProducts,
  carouselLimit,
  submitUrl,
}: {
  title: string
  description: string
  products: PopularRow[]
  carouselLimit: number
  submitUrl: string
}) {
  const [rows, setRows] = React.useState(initialProducts)
  const [reorderMode, setReorderMode] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [showAllOthers, setShowAllOthers] = React.useState(false)
  const form = useForm({ product_ids: initialProducts.map((row) => row.id) })

  React.useEffect(() => {
    // Inertia refresh mengganti daftar dengan snapshot server (setelah Simpan).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(initialProducts)
    // Data dan defaults dipindah bersama: `isDirty` membandingkan data dengan
    // defaults, jadi keduanya harus berisi snapshot server yang sama.
    form.setData(
      "product_ids",
      initialProducts.map((row) => row.id),
    )
    form.setDefaults(
      "product_ids",
      initialProducts.map((row) => row.id),
    )
    // `useForm` menghasilkan facade baru tiap render; snapshot server satu-satunya dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProducts])

  function syncRows(next: PopularRow[]) {
    setRows(next)
    form.setData(
      "product_ids",
      next.map((row) => row.id),
    )
  }

  const needle = query.trim().toLowerCase()
  const matches = React.useCallback(
    (row: PopularRow) =>
      needle === "" ||
      row.name.toLowerCase().includes(needle) ||
      row.parent_sku.toLowerCase().includes(needle) ||
      taxonomy(row).toLowerCase().includes(needle),
    [needle],
  )

  // Indeks asli (ke `rows`) dipertahankan supaya geser-urut tetap menulis
  // urutan global, bukan urutan hasil filter.
  const carousel = rows
    .map((row, index) => ({ row, index }))
    .slice(0, carouselLimit)
    .filter(({ row }) => matches(row))
  const others = rows
    .map((row, index) => ({ row, index }))
    .slice(carouselLimit)
    .filter(({ row }) => matches(row))

  const OTHERS_PREVIEW = 15
  // Mode urutkan otomatis membuka seluruh daftar: admin yang menekan "Urutkan"
  // pasti ingin menggeser, jadi jangan suruh dia membuka daftar dulu.
  const visibleOthers = reorderMode || showAllOthers ? others : others.slice(0, OTHERS_PREVIEW)

  // Geser-urut dimatikan saat daftar tersaring: posisi target tidak mewakili
  // urutan global, jadi hasil geser bisa salah tempat.
  const canReorder = reorderMode && needle === ""

  const dnd = useRowDragSort({
    enabled: canReorder,
    count: rows.length,
    onReorder: (from, to) => {
      if (from === to) return
      const next = [...rows]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      syncRows(next)
    },
  })

  function save() {
    form.put(submitUrl, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  /** Batalkan mode urut: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelReorder() {
    setRows(initialProducts)
    form.setData(
      "product_ids",
      initialProducts.map((row) => row.id),
    )
    form.setDefaults(
      "product_ids",
      initialProducts.map((row) => row.id),
    )
    setReorderMode(false)
  }

  const dirty = form.isDirty
  const carouselShown = carousel.length

  return (
    <AdminLayout
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Satu tombol yang berubah peran mengikuti keadaan (kontrak owner 2026-09-20):
              Urutkan -> Urungkan saat mode aktif -> Simpan urutan begitu ada urutan
              yang benar-benar digeser. */}
          <ReorderActionButton
            active={reorderMode}
            dirty={dirty}
            processing={form.processing}
            disabled={!rows.length}
            onToggle={() => {
              setReorderMode(true)
              // Urutan hanya bisa digeser saat daftar tidak tersaring, jadi
              // pencarian dibersihkan sekaligus saat mode urut dinyalakan.
              setQuery("")
            }}
            onCancel={cancelReorder}
            onSave={save}
          />
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari nama produk atau SKU"
          aria-label="Cari produk"
          className="w-full sm:max-w-xs"
        />
        <p className="text-xs text-muted-foreground">
          {carouselShown} baris carousel · {others.length} produk lain
        </p>
      </div>

      {reorderMode ? (
        <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Mode urutkan aktif: tarik ikon <span className="font-semibold text-foreground">titik enam</span> di kiri baris untuk memindahkan produk, lalu tekan Simpan urutan.
          {!canReorder ? (
            <span className="font-semibold text-foreground"> Kosongkan pencarian agar urutan bisa digeser.</span>
          ) : null}
        </p>
      ) : (
        <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Urutan baris di bawah ini sama persis dengan urutan produk di halaman daftar produk toko. {carouselLimit} baris pertama mengisi carousel beranda dan halaman katalog.
        </p>
      )}

      {/* Zona carousel: batas 10 teratas dibuat eksplisit. */}
      <Card className="overflow-hidden border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="trend-up" className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Tampil di carousel</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {carouselShown} dari {carouselLimit} slot
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs font-medium text-muted-foreground">
                <th className="w-12 px-3 py-2" />
                <th className="px-3 py-2">Nama produk</th>
                <th className="px-3 py-2 whitespace-nowrap">Taksonomi</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Views sebelum → sesudah</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Clicks sebelum → sesudah</th>
              </tr>
            </thead>
            <tbody>
              {carousel.length ? (
                carousel.map(({ row, index }) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0",
                      dnd.draggingIndex === index && "opacity-40",
                      dnd.targetIndex === index && canReorder && "bg-muted/50",
                    )}
                    {...(canReorder ? dnd.rowProps(index) : {})}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <ReorderDragHandle enabled={canReorder} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ProductCell row={row} />
                    </td>
                    <td className="px-3 py-2.5 align-middle text-[13px] whitespace-nowrap">
                      {taxonomy(row)}
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      <EngagementCell before={row.views_before} after={row.views_after} delta={row.delta_views} />
                    </td>
                    <td className="px-3 py-2.5 text-right align-middle">
                      <EngagementCell before={row.clicks_before} after={row.clicks_after} delta={row.delta_clicks} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Tidak ada produk carousel yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Zona produk lain: dilipat agar halaman tidak jadi belasan ribu piksel. */}
      <Card className="mt-4 overflow-hidden border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="list" className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Produk lain</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {others.length} produk di luar carousel
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs font-medium text-muted-foreground">
                <th className="w-12 px-3 py-2" />
                <th className="px-3 py-2">Nama produk</th>
                <th className="px-3 py-2 whitespace-nowrap">Taksonomi</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleOthers.map(({ row, index }) => (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border last:border-0",
                    dnd.draggingIndex === index && "opacity-40",
                    dnd.targetIndex === index && canReorder && "bg-muted/50",
                  )}
                  {...(canReorder ? dnd.rowProps(index) : {})}
                >
                  <td className="px-3 py-2 align-middle">
                    <ReorderDragHandle enabled={canReorder} />
                  </td>
                  <td className="px-3 py-2 align-middle">
                    <ProductCell row={row} />
                  </td>
                  <td className="px-3 py-2 align-middle text-[13px] text-muted-foreground whitespace-nowrap">
                    {taxonomy(row)}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    {row.is_eligible ? (
                      <span className="text-xs text-muted-foreground">Siap naik</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Belum aktif</span>
                    )}
                  </td>
                </tr>
              ))}
              {visibleOthers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    {others.length === 0
                      ? "Semua produk sudah masuk carousel."
                      : "Tidak ada produk yang cocok dengan pencarian."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {others.length > OTHERS_PREVIEW && !reorderMode ? (
          <div className="border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowAllOthers((value) => !value)}
            >
              <Icon name={showAllOthers ? "caret-up" : "caret-down"} className="size-4" aria-hidden="true" />
              {showAllOthers
                ? "Ringkas daftar"
                : `Tampilkan semua (${others.length - OTHERS_PREVIEW} lagi)`}
            </Button>
          </div>
        ) : null}
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Views &amp; clicks hanya dihitung untuk baris carousel, membandingkan rentang sama panjang sebelum dan sesudah produk masuk carousel. Produk yang belum pernah masuk carousel belum punya pembanding.
      </p>
    </AdminLayout>
  )
}
