import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ReorderActionButton } from "@/components/admin/reorder-action-button"
import { Input } from "@/components/admin/ui/input"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { cn } from "@/lib/utils"

interface GroupRow {
  key: string
  kind: "model" | "standalone"
  label: string
  category: string
  model: string
  media_count: number
  video_count: number
  sku_count: number
  cover: string
  visibility: "visible" | "hidden" | "archived"
  sort_order: number
  detailUrl: string
}

interface StatusTab {
  key: string
  label: string
  count: number
}

interface IndexProps {
  title: string
  description: string
  projects: {
    data: GroupRow[]
    total: number
  }
  tabs: StatusTab[]
  activeStatus: string
  viewMode: "list" | "grid"
  sort: string
  q: string
  createUrl: string
  reorderUrl: string
  previewUrl: string
}

export default function InstallationGalleryIndex({
  title,
  description,
  projects,
  tabs = [],
  activeStatus = "all",
  viewMode = "list",
  sort = "order",
  q = "",
  createUrl,
  reorderUrl,
  previewUrl,
}: IndexProps) {
  const [search, setSearch] = React.useState(q)
  const [currentView, setCurrentView] = React.useState<"list" | "grid">(viewMode)
  const [reorderMode, setReorderMode] = React.useState(false)

  const initialRows = projects.data ?? []
  const [rows, setRows] = React.useState<GroupRow[]>(initialRows)

  const reorderForm = useForm({
    rows: initialRows.map((r) => ({ key: r.key })),
  })

  React.useEffect(() => {
    // Inertia refresh replaces the editable group list with the server snapshot.
    const next = projects.data ?? []
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(next)
    // Data dan defaults dipindah bersama: `isDirty` membandingkan data dengan
    // defaults, jadi keduanya harus berisi snapshot server yang sama supaya
    // tombol Simpan urutan tidak muncul tanpa ada geseran.
    reorderForm.setData("rows", next.map((r) => ({ key: r.key })))
    reorderForm.setDefaults("rows", next.map((r) => ({ key: r.key })))
    // `useForm` returns a new facade on every render; the server snapshot is the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.data])

  // Drag-and-drop grup (mode geser).
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [dragTarget, setDragTarget] = React.useState<number | null>(null)

  function moveRow(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setRows(next)
    reorderForm.setData("rows", next.map((r) => ({ key: r.key })))
  }

  // Geser-urut hanya sahih saat daftar memuat seluruh grup: payload simpan
  // memakai indeks baris yang tampil, jadi daftar tersaring menulis urutan salah.
  // Pencarian dan sortir dibersihkan sendiri oleh tombol Urutkan, jadi hanya tab
  // status yang mengunci tombolnya.
  const listTersaring = activeStatus !== "all" || search.trim() !== "" || sort !== "order"
  const filterKunci = activeStatus !== "all"

  function handleReorderSubmit() {
    reorderForm.put(reorderUrl, {
      preserveScroll: true,
      onSuccess: () => setReorderMode(false),
    })
  }

  /** Batalkan mode geser: kembalikan urutan ke snapshot server lalu keluar. */
  function cancelReorder() {
    const snapshot = projects.data ?? []
    setRows(snapshot)
    reorderForm.setData("rows", snapshot.map((r) => ({ key: r.key })))
    reorderForm.setDefaults("rows", snapshot.map((r) => ({ key: r.key })))
    setReorderMode(false)
  }


  function handleFilter(newParams: Record<string, string | number | null | undefined>) {
    router.get(
      route("admin.hasil-pemasangan.index"),
      {
        status: activeStatus !== "all" ? activeStatus : undefined,
        q: search || undefined,
        sort: sort !== "order" ? sort : undefined,
        view: currentView !== "list" ? currentView : undefined,
        ...newParams,
      },
      { preserveState: true, preserveScroll: true },
    )
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    handleFilter({ q: search || null })
  }

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
            dirty={reorderForm.isDirty}
            processing={reorderForm.processing}
            disabled={!rows.length || filterKunci}
            disabledReason="Pilih tab Semua Hasil Pemasangan dulu supaya urutan bisa digeser."
            onToggle={() => {
              setReorderMode(true)
              // Urutan hanya bisa digeser saat daftar lengkap, jadi pencarian
              // dan sortir dikosongkan sekaligus saat mode geser dinyalakan.
              if (listTersaring) handleFilter({ q: null, sort: null })
            }}
            onCancel={cancelReorder}
            onSave={handleReorderSubmit}
          />
          <Button asChild variant="outline">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Icon name="external-link" className="size-4" aria-hidden="true" />
              Lihat Publik
            </a>
          </Button>
          {!reorderMode ? (
            <Button asChild>
              <Link href={createUrl}>
                <Icon name="plus" className="size-4" aria-hidden="true" />
                Tambah
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <div className="space-y-6">
        {/* Filter Status Tabs */}
        <nav
          className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3"
          aria-label="Filter status hasil pemasangan"
        >
          {tabs.map((tab) => {
            const active = tab.key === activeStatus
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleFilter({ status: tab.key })}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Toolbar & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={submitSearch} className="relative w-full max-w-sm">
            <Input
              type="search"
              placeholder="Cari nama model / grup..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            <Icon
              name="search"
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  handleFilter({ q: null })
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Hapus pencarian"
              >
                <Icon name="x" className="size-3.5" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Urutan:</span>
              <select
                value={sort}
                onChange={(e) => handleFilter({ sort: e.target.value })}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="order">A-Z (Nama)</option>
                <option value="latest">Terbaru</option>
              </select>
            </div>

            <div className="flex items-center rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => {
                  setCurrentView("list")
                  handleFilter({ view: "list" })
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  currentView === "list"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Tampilan tabel"
              >
                <Icon name="menu" className="size-3.5" />
                <span className="hidden sm:inline">Daftar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentView("grid")
                  handleFilter({ view: "grid" })
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  currentView === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-label="Tampilan grid"
              >
                <Icon name="layout-grid" className="size-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>
          </div>
        </div>

        {/* Konten Utama */}
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon name="image" className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-foreground">
              Belum ada grup hasil pemasangan
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {q
                ? `Tidak ditemukan grup yang cocok dengan "${q}".`
                : "Tambahkan media hasil pemasangan untuk membuat grup baru."}
            </p>
            <div className="mt-5">
              <Button asChild size="sm">
                <Link href={createUrl}>
                  <Icon name="plus" className="size-3.5" />
                  Tambah
                </Link>
              </Button>
            </div>
          </div>
        ) : currentView === "list" ? (
          /* Mode Tampilan Tabel */
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] table-fixed text-left text-xs">
                <colgroup>
                  {reorderMode ? <col className="w-8" /> : null}
                  <col className="w-20" />
                  <col />
                  <col className="w-24" />
                  <col className="w-24" />
                  <col className="w-32" />
                  <col className="w-24" />
                </colgroup>
                <thead className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                  <tr>
                    {reorderMode ? <th className="px-1 py-3" aria-label="Seret" /> : null}
                    <th className="px-3 py-3">Cover</th>
                    <th className="px-3 py-3">Grup</th>
                    <th className="px-3 py-3 text-center">Media</th>
                    <th className="px-3 py-3 text-center">SKU</th>
                    <th className="px-3 py-3 text-center">Jenis</th>
                    <th className="py-3 pl-2 pr-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((group, index) => (
                    <tr
                      key={group.key}
                      draggable={reorderMode && !listTersaring}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", String(index))
                        setDragIndex(index)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (reorderMode && !listTersaring && dragIndex !== null && dragIndex !== index) setDragTarget(index)
                      }}
                      onDragLeave={() => setDragTarget((current) => (current === index ? null : current))}
                      onDrop={(event) => {
                        event.preventDefault()
                        const from = dragIndex
                        setDragIndex(null)
                        setDragTarget(null)
                        if (from === null) return
                        moveRow(from, index)
                      }}
                      onDragEnd={() => {
                        setDragIndex(null)
                        setDragTarget(null)
                      }}
                      className={cn(
                        "transition-colors hover:bg-muted/30",
                        reorderMode && !listTersaring && "cursor-grab active:cursor-grabbing",
                        dragIndex === index && "opacity-40",
                        dragTarget === index && dragIndex !== index && "border-t-2 border-primary bg-primary/5",
                      )}
                    >
                      {reorderMode ? (
                        <td className="px-1 py-3">
                          <span
                            className="flex size-6 items-center justify-center rounded text-muted-foreground"
                            title="Seret untuk mengubah urutan"
                            aria-hidden="true"
                          >
                            <Icon name="dots-six-vertical" className="size-4" />
                          </span>
                        </td>
                      ) : null}
                      {/* Cover */}
                      <td className="px-3 py-3">
                        <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                          {group.cover ? (
                            <img
                              src={group.cover}
                              alt={group.label}
                              className="size-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <Icon name="image" className="size-5" />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Nama grup */}
                      <td className="px-3 py-3">
                        <Link
                          href={group.detailUrl}
                          className="font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {group.label}
                        </Link>
                      </td>

                      {/* Jumlah media */}
                      <td className="px-3 py-3 text-center">
                        <div className="font-semibold tabular-nums text-foreground">{group.media_count}</div>
                        {group.video_count > 0 && (
                          <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Icon name="play" className="size-2.5 fill-current" />
                            {group.video_count} video
                          </div>
                        )}
                      </td>

                      {/* Jumlah SKU */}
                      <td className="px-3 py-3 text-center">
                        {group.kind === "model" ? (
                          <span className="tabular-nums text-foreground">{group.sku_count}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Jenis grup */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            group.kind === "model"
                              ? "bg-sky-500/15 text-sky-800 dark:text-sky-300"
                              : "bg-purple-500/15 text-purple-800 dark:text-purple-300",
                          )}
                        >
                          {group.kind === "model" ? "Model produk" : "Mandiri"}
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                        <Button asChild variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs">
                          <Link href={group.detailUrl}>
                            <Icon name="eye" className="size-3.5" />
                            Detail
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Mode Tampilan Grid */
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((group) => (
              <article
                key={group.key}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:shadow-md"
              >
                <Link href={group.detailUrl} className="relative block aspect-video w-full overflow-hidden bg-muted">
                  {group.cover ? (
                    <img
                      src={group.cover}
                      alt={group.label}
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <Icon name="image" className="size-8" />
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-foreground line-clamp-1">
                      <Link href={group.detailUrl} className="hover:text-primary transition-colors">
                        {group.label}
                      </Link>
                    </h4>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        group.kind === "model"
                          ? "bg-sky-500/15 text-sky-800 dark:text-sky-300"
                          : "bg-purple-500/15 text-purple-800 dark:text-purple-300",
                      )}
                    >
                      {group.kind === "model" ? "Model" : "Mandiri"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="images" className="size-3" />
                      {group.media_count} media
                    </span>
                    {group.video_count > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="play" className="size-2.5 fill-current" />
                        {group.video_count} video
                      </span>
                    )}
                    {group.kind === "model" && (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="cube" className="size-3" />
                        {group.sku_count} SKU
                      </span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3 mt-4">
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      <Link href={group.detailUrl}>
                        <Icon name="eye" className="size-3" />
                        Kelola media
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
