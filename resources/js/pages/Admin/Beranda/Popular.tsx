import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { ReorderDragHandle } from "@/components/admin/reorder-drag-handle"
import { Card } from "@/components/admin/ui/card"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Select } from "@/components/admin/ui/select"
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
  views_total: number
  clicks_total: number
  views_before: number | null
  clicks_before: number | null
  views_after: number | null
  clicks_after: number | null
  delta_views: number | null
  delta_clicks: number | null
}

/**
 * Keadaan baris terhadap sorotan toko.
 *
 * Slot carousel dihitung dari URUTAN YANG SEDANG TAMPIL, bukan bendera kiriman
 * server, supaya badge ikut bergerak begitu admin memindahkan produk ke atas dan
 * hasilnya terbaca sebelum disimpan.
 *
 * "Carousel" berarti produk menempati salah satu slot tayang di beranda dan
 * halaman katalog. "Tayang" berarti produk tidak menempati slot carousel
 * tetapi tetap tampil di halaman Paling Banyak Dipesan. "Belum aktif" berarti
 * produk belum bisa tayang sama sekali (status bukan aktif atau tanpa varian
 * aktif), sehingga tidak muncul di halaman itu.
 */
function StatusBadge({ row, inWindow }: { row: PopularRow; inWindow: boolean }) {
  if (inWindow) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
        title={
          !row.in_window
            ? "Perubahan belum disimpan. Produk ini menempati slot carousel setelah urutan disimpan"
            : row.since_label
              ? `Masuk carousel sejak ${row.since_label}`
              : "Masuk carousel dalam 24 jam terakhir"
        }
      >
        Carousel
      </span>
    )
  }

  if (row.is_eligible) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success"
        title="Tidak menempati slot carousel, tetapi tetap tampil di halaman Paling Banyak Dipesan"
      >
        Tayang
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
      title="Belum tayang di toko: status bukan aktif atau belum punya varian aktif"
    >
      Belum aktif
    </span>
  )
}

/** Sel produk: thumbnail, nama (tautan detail), SKU dengan tombol salin. */
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
          className="line-clamp-2 text-xs font-semibold text-primary hover:underline sm:line-clamp-1 sm:text-sm"
          title={`Lihat detail ${row.name}`}
          draggable={false}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {row.name}
        </Link>
        <span className="flex items-center gap-1">
          <span className="font-mono text-[11px] text-muted-foreground">{row.parent_sku}</span>
          <CopyButton text={row.parent_sku} label="Salin SKU" compact showTextInTitle />
        </span>
      </span>
    </div>
  )
}

/**
 * Sel views/clicks.
 *
 * Baris di dalam carousel punya dua rentang sama panjang (sebelum dan sesudah
 * produk masuk sorotan), jadi angkanya tampil "sebelum → sesudah (+selisih)".
 * Baris di luar carousel tidak punya tanggal masuk, sehingga tidak ada pembanding
 * yang adil: yang ditampilkan hanya total angka yang tercatat sampai hari ini.
 */
function MetricCell({
  row,
  metric,
  inWindow,
}: {
  row: PopularRow
  metric: "views" | "clicks"
  inWindow: boolean
}) {
  const total = metric === "views" ? row.views_total : row.clicks_total
  const before = metric === "views" ? row.views_before : row.clicks_before
  const after = metric === "views" ? row.views_after : row.clicks_after
  const delta = metric === "views" ? row.delta_views : row.delta_clicks

  if (before === null || after === null || delta === null) {
    // Tiga sebab angka tunggal: baris di luar carousel (tidak punya tanggal
    // masuk), baris yang baru masuk carousel (rentang "sebelum" belum punya
    // lebar yang sebanding), dan baris yang baru dipindah ke carousel tetapi
    // urutannya belum disimpan. Ketiganya diberi keterangan berbeda supaya
    // admin tidak menyangka pembandingnya hilang.
    const reason = inWindow
      ? "Baru masuk carousel, rentang pembanding belum tersedia"
      : "Total yang tercatat sampai hari ini, belum ada pembanding sebelum dan sesudah"

    return (
      <span className="text-xs tabular-nums text-foreground" title={reason}>
        {formatNumber(total)}
      </span>
    )
  }

  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs tabular-nums">
      <span className="text-muted-foreground">{formatNumber(before)}</span>
      <span className="text-muted-foreground" aria-hidden="true">
        →
      </span>
      <span className="font-semibold text-foreground">{formatNumber(after)}</span>
      {delta !== 0 ? (
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

/** Taksonomi digabung satu kolom supaya kolom lain tidak terdesak. */
function taxonomy(row: PopularRow): string {
  return [row.category_label, row.model_label, row.design_label].filter(Boolean).join(" · ")
}

/**
 * Pengaturan urutan "Paling Banyak Dipesan".
 *
 * SATU daftar untuk seluruh katalog, bukan dua tabel terpisah: urutan baris =
 * urutan galeri /products/all?from=paling-banyak-dipesan, dan sejumlah baris
 * teratas mengisi carousel beranda serta halaman katalog. Batas carousel tetap
 * ditandai di dalam daftar supaya admin tahu baris mana yang tayang.
 *
 * Kolom metrik sama untuk semua baris. Baris di dalam carousel menampilkan
 * sebelum → sesudah, baris di luar carousel menampilkan total yang tercatat.
 *
 * Menu "Pindahkan ke" menaruh produk langsung ke nomor 10 (slot carousel
 * terakhir) atau nomor 11 (urutan pertama di luar carousel), jadi produk lama
 * atau tidak populer bisa masuk carousel tanpa menyeretnya dari baris ke-150.
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
  const [statusFilter, setStatusFilter] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [movedId, setMovedId] = React.useState<number | null>(null)
  const tableRef = React.useRef<HTMLDivElement>(null)
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

  function pindahkanKe(targetIndex: number, tujuan: "carousel" | "halaman-1") {
    // Nomor tujuan memakai posisi 1-based: Carousel = nomor 10 (slot terakhir),
    // Halaman 1 = nomor 11 (urutan pertama di luar carousel).
    const nomorTujuan = tujuan === "carousel" ? 10 : 11
    if (targetIndex < 0) return
    const next = [...rows]
    const [item] = next.splice(targetIndex, 1)
    // Menyisipkan pada indeks 0-based (nomorTujuan - 1) selalu menempatkan
    // produk di posisi 1-based nomorTujuan, apa pun posisi asalnya.
    next.splice(Math.min(Math.max(nomorTujuan - 1, 0), next.length), 0, item)
    syncRows(next)
    // Kedua tujuan ada di halaman 1 (nomor 10 dan 11), jadi pindahkan pandangan
    // ke halaman 1 supaya admin melihat hasilnya, bukan halaman lama tempat
    // tombol itu ditekan.
    setPage(1)
    // Baris yang dipindah disorot sekilas lalu halaman digulir ke baris itu:
    // tanpa itu, admin yang memindahkan produk dari baris ke-150 tidak melihat
    // apa pun berubah karena hasilnya berada jauh di atas layar.
    setMovedId(item.id)
    // Tombol simpan hanya dirender saat mode urut aktif (kontrak
    // ReorderActionButton), jadi memindahkan produk sekaligus menyalakan mode itu.
    if (!reorderMode) setReorderMode(true)
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

  // Slot carousel dihitung dari URUTAN YANG SEDANG TAMPIL, bukan bendera kiriman
  // server. Kalau memakai bendera server, produk yang baru dipindah ke posisi 1
  // masih tertulis "Tayang" dan garis batasnya tidak bergerak, sehingga hasil
  // pemindahan tidak terbaca sebelum disimpan. Aturannya sama dengan server:
  // hanya baris yang lolos syarat tayang yang mengambil slot, dan hanya
  // `carouselLimit` slot pertama yang terisi.
  const slotIds = new Set<number>()
  let slotTerpakai = 0
  let lastSlotIndex = -1
  rows.forEach((row, index) => {
    if (!row.is_eligible || slotTerpakai >= carouselLimit) return
    slotIds.add(row.id)
    slotTerpakai += 1
    lastSlotIndex = index
  })
  const windowCount = slotIds.size
  const rowInWindow = (row: PopularRow) => slotIds.has(row.id)
  // Status baris mengikuti slot: Carousel = dalam jendela, Tayang = lolos syarat
  // tayang tapi di luar jendela, Belum aktif = tidak lolos syarat tayang sama
  // sekali. Dipakai badge, penghitung, dan filter status.
  const statusOf = (row: PopularRow) => (rowInWindow(row) ? "carousel" : row.is_eligible ? "tayang" : "belum-aktif")

  // Indeks asli (ke `rows`) dipertahankan supaya geser-urut tetap menulis
  // urutan global, bukan urutan hasil filter.
  const filtered = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => matches(row) && (statusFilter === "" || statusOf(row) === statusFilter))

  // Daftar dipaginasi di sisi klien: seluruh baris tetap dimuat karena geser
  // dan "Ke atas" menulis urutan global lewat indeks aslinya, tapi yang tampil
  // per halaman dibatasi supaya 183 baris tidak menumpuk.
  // 15 per halaman, selaras dengan galeri storefront (catalog_page_size).
  const PER_HALAMAN = 15
  const totalHalaman = Math.max(1, Math.ceil(filtered.length / PER_HALAMAN))
  const halamanKini = Math.min(page, totalHalaman)
  const awalBaris = (halamanKini - 1) * PER_HALAMAN
  const visible = filtered.slice(awalBaris, awalBaris + PER_HALAMAN)

  // Geser-urut dimatikan saat daftar tersaring: posisi target tidak mewakili
  // urutan global, jadi hasil geser bisa salah tempat.
  const canReorder = reorderMode && needle === "" && statusFilter === ""

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

  // Gulirkan pandangan ke baris yang baru dipindah, lalu lepas sorotannya.
  React.useEffect(() => {
    if (movedId === null) return
    const baris = tableRef.current?.querySelector<HTMLElement>(`[data-row-id="${movedId}"]`)
    baris?.scrollIntoView({ block: "center", behavior: "smooth" })
    const timer = window.setTimeout(() => setMovedId(null), 1800)
    return () => window.clearTimeout(timer)
  }, [movedId])

  const dirty = form.isDirty
  const columnCount = canReorder ? 8 : 7

  return (
    <AdminLayout
      title={title}
      description={description}
      lockInteraction={reorderMode}
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

      <ListToolbar
        search={{
          value: query,
          onChange: (value) => {
            setQuery(value)
            setPage(1)
          },
          placeholder: "Cari nama produk atau SKU",
          // Kotak cari sengaja tetap hidup saat mode Urutkan aktif: alur yang
          // dituju halaman ini adalah "cari produk lama, lalu pindahkan ke atas",
          // dan mengunci kotak cari membuat alur itu buntu di tengah jalan.
          inputProps: { "data-reorder-allow": "", "aria-label": "Cari produk" },
        }}
        summary={
          <span>
            {filtered.length} produk · {windowCount} baris carousel
          </span>
        }
        className="mb-4"
      >
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
          aria-label="Filter status tayang"
          className="w-44"
        >
          <option value="">Semua status</option>
          <option value="carousel">Carousel</option>
          <option value="tayang">Tayang</option>
          <option value="belum-aktif">Belum aktif</option>
        </Select>
      </ListToolbar>

      {reorderMode ? (
        <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Mode Urutkan aktif: pakai <span className="font-semibold text-foreground">ikon tarik</span> di tepi kiri baris atau menu <span className="font-semibold text-foreground">Pindahkan ke</span> untuk memindahkan produk, lalu tekan Simpan urutan.
          {!canReorder ? (
            <span className="font-semibold text-foreground"> Selagi daftar tersaring (pencarian atau filter status), hanya tombol Ke atas yang bisa memindahkan produk; kosongkan keduanya untuk menggeser bebas.</span>
          ) : null}
        </p>
      ) : null}

      <Card className="overflow-hidden border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="trend-up" className="size-4 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-foreground">Urutan paling banyak dipesan</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {windowCount} dari {carouselLimit} slot carousel terisi
          </span>
        </div>
        <div className="overflow-x-auto" ref={tableRef}>
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs font-medium text-muted-foreground">
                {canReorder ? <th className="w-12 px-3 py-2" aria-label="Seret" /> : null}
                <th className="w-10 px-3 py-2 text-center">No</th>
                <th className="px-3 py-2">Nama produk</th>
                <th className="hidden px-3 py-2 whitespace-nowrap md:table-cell">Taksonomi</th>
                <th className="px-3 py-2 whitespace-nowrap">Status</th>
                <th
                  className="px-3 py-2 text-right whitespace-nowrap"
                  title="Baris carousel: sebelum → sesudah masuk sorotan. Baris lain: total yang tercatat."
                >
                  Views
                </th>
                <th
                  className="px-3 py-2 text-right whitespace-nowrap"
                  title="Baris carousel: sebelum → sesudah masuk sorotan. Baris lain: total yang tercatat."
                >
                  Clicks
                </th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map(({ row, index }) => (
                  <React.Fragment key={row.id}>
                    {needle === "" && statusFilter === "" && windowCount > 0 && index === lastSlotIndex + 1 ? (
                      <tr className="bg-muted/30">
                        <td
                          colSpan={columnCount}
                          className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
                        >
                          Batas carousel · {carouselLimit} baris di atas tayang di beranda dan halaman katalog
                        </td>
                      </tr>
                    ) : null}
                    <tr
                      data-row-id={row.id}
                      className={cn(
                        "border-b border-border last:border-0 transition-colors duration-500",
                        dnd.draggingIndex === index && "opacity-40",
                        dnd.targetIndex === index && canReorder && "bg-muted/50",
                        movedId === row.id && "bg-primary/15",
                      )}
                      {...(canReorder ? dnd.rowProps(index) : {})}
                    >
                      {canReorder ? (
                        <td className="px-3 py-2.5 align-middle">
                          <ReorderDragHandle enabled />
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5 text-center align-middle text-xs text-muted-foreground tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <ProductCell row={row} />
                      </td>
                      <td className="hidden px-3 py-2.5 align-middle text-[13px] whitespace-nowrap md:table-cell">
                        {taxonomy(row)}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <StatusBadge row={row} inWindow={rowInWindow(row)} />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <MetricCell row={row} metric="views" inWindow={rowInWindow(row)} />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <MetricCell row={row} metric="clicks" inWindow={rowInWindow(row)} />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              data-reorder-allow
                              title="Pindahkan produk ini ke slot carousel terakhir atau ke urutan pertama di luar carousel"
                              className="inline-flex shrink-0 items-center gap-1 border-primary/30 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/10"
                            >
                              Pindahkan ke
                              <Icon name="caret-down" weight="bold" className="size-4 text-primary" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-[13rem]">
                            <DropdownMenuItem
                              disabled={!row.is_eligible}
                              onSelect={() => pindahkanKe(index, "carousel")}
                            >
                              Carousel
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => pindahkanKe(index, "halaman-1")}>
                              Halaman 1
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={columnCount} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Tidak ada produk yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalHalaman > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Halaman <span className="font-semibold text-foreground">{halamanKini}</span> dari{" "}
              <span className="font-semibold text-foreground">{totalHalaman}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={halamanKini <= 1}
                onClick={() => setPage(halamanKini - 1)}
              >
                Sebelumnya
              </Button>
              {Array.from({ length: totalHalaman }, (_, nomor) => nomor + 1).map((nomor) => (
                <Button
                  key={nomor}
                  type="button"
                  variant={nomor === halamanKini ? "primary" : "secondary"}
                  size="sm"
                  className="min-w-8 px-2"
                  aria-current={nomor === halamanKini ? "page" : undefined}
                  onClick={() => setPage(nomor)}
                >
                  {nomor}
                </Button>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={halamanKini >= totalHalaman}
                onClick={() => setPage(halamanKini + 1)}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Views &amp; clicks baris di dalam carousel membandingkan rentang sama panjang sebelum dan sesudah produk masuk carousel. Baris di luar carousel belum punya tanggal masuk, jadi yang ditampilkan hanya total yang tercatat.
      </p>
    </AdminLayout>
  )
}
