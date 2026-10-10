import { Head, Link, router } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import { EmptyState, ErrorState } from "@/components/admin/ui/empty-state"
import { Input } from "@/components/admin/ui/input"
import { ListToolbar } from "@/components/admin/ui/list-toolbar"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { navigateFilter } from "@/lib/filter-url"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { Pagination as PaginationData } from "@/types"

interface LogRow {
  id: number
  loggable_type: string
  loggable_id: number
  entity_label: string | null
  event: string
  message: string | null
  retry_url?: string | null
  delete_url?: string | null
  created_at?: string | null
  created_at_label?: string | null
  /** Tautan ke medianya; null bila tidak ada tujuan yang wajar. */
  media_href?: string | null
  /** Aset tujuan penggabungan duplikat; null bila kejadian ini bukan penggabungan. */
  merged_into?: { asset_id: number; label: string; href: string | null } | null
}

/**
 * Keterangan aset TUJUAN pada baris penggabungan duplikat.
 *
 * Dipakai bersama oleh tabel desktop dan kartu mobile: dua markup terpisah untuk
 * hal yang sama gampang berbeda saat salah satunya disunting (lihat pengalaman
 * pada kartu ulasan yang punya dua implementasi).
 */
function MergedIntoNote({ merged }: { merged: LogRow["merged_into"] }) {
  if (!merged) return null

  return (
    <p className="mt-1 text-[11px] text-muted-foreground">
      Digabungkan ke{" "}
      {merged.href ? (
        <Link href={merged.href} className="font-medium text-primary hover:underline">
          {merged.label}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{merged.label}</span>
      )}
    </p>
  )
}

const EVENT_META: Record<string, { label: string; tone: string }> = {
  queued: { label: "Antre", tone: "neutral-soft" },
  processing: { label: "Diproses", tone: "info" },
  success: { label: "Siap", tone: "success" },
  failed: { label: "Gagal", tone: "danger" },
  dedup: { label: "Duplikat", tone: "warning" },
}

/**
 * Urutan tab filter, disusun menurut kepentingan audit: yang perlu ditindak
 * lebih dulu.
 *
 * Labelnya SENGAJA dibaca dari EVENT_META, bukan ditulis ulang di sini. Dulu
 * keduanya berupa daftar terpisah dan sempat berbeda satu huruf di ujung kata,
 * sehingga badge status dan label tab menyebut hal yang sama dengan ejaan
 * berbeda. Satu sumber membuat selisih seperti itu tidak mungkin terulang.
 *
 * Empat jenis event TIDAK punya tab, karena tiga sebab yang berbeda, dan semuanya
 * bermuara pada satu hal: tab hanya layak untuk keadaan yang bisa DISARING.
 *
 * - Duplikat: penjagaan berkas kembar sudah berjalan di halaman Media Library
 *   SEBELUM berkas dikirim, jadi tidak perlu disaring sehari-hari. Labelnya tetap
 *   ada di EVENT_META karena event ini masih ditulis oleh penggabungan di server.
 * - Terunduh: bukan event sama sekali. "downloaded" adalah STATUS pada tabel
 *   lampiran media, dan tidak ada satu pun kode yang pernah menuliskannya sebagai
 *   event riwayat. Labelnya ikut dibuang supaya tidak menyisakan pemetaan mati.
 * - Antre dan Diproses: KEDUANYA bukan keadaan yang bertahan. Setiap tahap
 *   pemrosesan MENAMBAH baris barunya sendiri dan tidak pernah memperbarui yang
 *   lama, jadi baris "Diproses" tetap tinggal walau pekerjaannya selesai tiga detik
 *   kemudian (terukur: jarak Diproses ke Siap hanya 3 detik). Menyaring dengan tab
 *   itu karena itu tidak menyaring apa pun, dan pemantauan pekerjaan berjalan sudah
 *   ditangani badge Live serta penyegaran otomatis di tab Semua. Labelnya tetap
 *   dipetakan di EVENT_META karena baris lama masih perlu tampil bernada benar.
 */
const EVENT_TABS = ["failed", "success"] as const

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  return (
    date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
  )
}

export default function MediaHistory({
  logs = [],
  pagination,
  filters,
  activeDatePreset,
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
  periodLabel,
  prune,
  backUrl,
}: {
  logs: LogRow[]
  pagination: PaginationData | null
  filters: { event: string; q: string }
  activeDatePreset: string
  dateFrom: string
  dateTo: string
  periodLabel: string
  prune?: { days: number; count: number } | null
  backUrl?: string | null
}) {
  const [q, setQ] = React.useState(filters.q)
  const [rangeFrom, setRangeFrom] = React.useState(initialDateFrom)
  const [rangeTo, setRangeTo] = React.useState(initialDateTo)

  /**
   * Satu jalur navigasi filter, memakai pembangun query bersama supaya nilai
   * kosong dan kunci yang tidak berlaku tidak ikut masuk URL.
   *
   * Rentang tanggal hanya ditulis saat periode "range" yang aktif, sama seperti
   * halaman daftar admin lain. Kalau tidak, tanggal sisa pilihan lama akan
   * terbawa dan menyaring daftar tanpa terlihat di kontrol mana pun.
   */
  function visit(params: Record<string, string | undefined>) {
    navigateFilter(
      "admin.media.history",
      {
        event: filters.event,
        q: filters.q,
        date_preset: activeDatePreset,
        date_from: activeDatePreset === "range" ? rangeFrom : undefined,
        date_to: activeDatePreset === "range" ? rangeTo : undefined,
      },
      params,
      {
        shouldDrop: (key, _value, merged) =>
          (key === "date_from" || key === "date_to") && merged.date_preset !== "range",
      },
    )
  }

  function applyDateRange(event: React.FormEvent) {
    event.preventDefault()
    visit({ date_preset: "range", date_from: rangeFrom || undefined, date_to: rangeTo || undefined })
  }

  // ---- Live: polling status entitas yang masih queued/processing ----
  // Overrides per log id (hanya di-set dari callback async polling, bukan di
  // body effect) sehingga tidak memicu peringatan setState-in-effect.
  const [liveOverrides, setLiveOverrides] = React.useState<Record<number, Partial<LogRow>>>({})
  // Galat polling status: dulu ditelan diam-diam, sehingga baris yang masih
  // "Antre" terlihat sama seperti antrean normal. Sekarang muncul sebagai
  // ErrorState di atas daftar, dengan tombol untuk mencoba lagi.
  const [pollError, setPollError] = React.useState<string | null>(null)
  const [pollNonce, setPollNonce] = React.useState(0)

  const liveRows = logs.map((row) => ({ ...row, ...liveOverrides[row.id] }))
  const liveActive = liveRows.some((r) => r.event === "queued" || r.event === "processing")

  React.useEffect(() => {
    const pending = logs.filter((r) => r.event === "queued" || r.event === "processing")
    if (pending.length === 0) return
    let cancelled = false

    async function tick() {
      if (cancelled) return
      try {
        const assetIds = [
          ...new Set(
            pending
              .filter((r) => r.loggable_type.includes("MediaAsset"))
              .map((r) => r.loggable_id),
          ),
        ]
        const productIds = [
          ...new Set(
            pending
              .filter((r) => r.loggable_type.includes("ProductMedia"))
              .map((r) => r.loggable_id),
          ),
        ]
        const statuses: Record<string, { status: string; error_reason?: string | null }> = {}
        let gagal = false

        async function poll(kind: string, ids: number[]) {
          if (ids.length === 0) return
          const params = new URLSearchParams()
          params.set("kind", kind)
          ids.forEach((id) => params.append("ids[]", String(id)))
          const res = await fetch(`${route("admin.media.status")}?${params.toString()}`, {
            headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
          })
          if (!res.ok) {
            gagal = true
            return
          }
          const body = (await res.json()) as {
            statuses: { id: number; status: string; error_reason?: string | null }[]
          }
          for (const item of body.statuses ?? []) statuses[`${kind}:${item.id}`] = item
        }

        await Promise.all([poll("asset", assetIds), poll("product", productIds)])
        if (cancelled) return

        // Hanya baris non-terminal TERBARU per entitas yang di-update; baris
        // historis (mis. "Antre" lama) tetap seperti riwayat aslinya.
        const latestPerEntity = new Map<string, LogRow>()
        for (const row of pending) {
          const key = `${row.loggable_type}:${row.loggable_id}`
          if (!latestPerEntity.has(key)) latestPerEntity.set(key, row)
        }

        const next: Record<number, Partial<LogRow>> = {}
        for (const row of latestPerEntity.values()) {
          const kind = row.loggable_type.includes("MediaAsset") ? "asset" : "product"
          const info = statuses[`${kind}:${row.loggable_id}`]
          if (!info) continue
          if (info.status === "ready" || info.status === "downloaded") {
            next[row.id] = {
              event: "success",
              message: "Derivatif WebP siap (thumb/card/pdp).",
              retry_url: null,
            }
          } else if (info.status === "failed") {
            next[row.id] = {
              event: "failed",
              message: info.error_reason ?? "Pemrosesan media gagal.",
              retry_url: routeUrl("admin.media.logs.retry", { log: row.id }),
            }
          }
        }
        if (Object.keys(next).length > 0) {
          setLiveOverrides((prev) => ({ ...prev, ...next }))
        }
        setPollError(gagal ? "Status pemrosesan media belum dapat dimuat." : null)
      } catch {
        // Jaringan putus sesaat: tandai gagal, interval berikutnya mencoba lagi.
        if (!cancelled) setPollError("Status pemrosesan media belum dapat dimuat.")
      }
    }

    void tick()
    const interval = window.setInterval(() => void tick(), 3000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [logs, pollNonce])

  return (
    <AdminLayout title="Riwayat Media" backUrl={backUrl} description="Audit pemrosesan media: Antre, Diproses, lalu Siap atau Gagal">
      <Head title="Riwayat Media | Admin" />

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-border bg-muted/40 p-1">
        {[
          { key: "", label: "Semua" },
          ...EVENT_TABS.map((key) => ({ key, label: EVENT_META[key].label })),
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => visit({ event: tab.key })}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
              filters.event === tab.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
        </div>
        {liveActive ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        ) : null}
      </div>

      <ListToolbar
        search={{
          value: q,
          onChange: setQ,
          onSubmit: () => visit({ q }),
          placeholder: "Cari berdasarkan label media atau pesan",
        }}
        className="mb-4"
        summary={pagination ? `${pagination.total} log` : undefined}
        actions={
          prune && prune.count > 0 ? (
            <ConfirmAction
              trigger={
                <Button type="button" variant="secondary" size="sm">
                  <Icon name="trash" className="size-4" aria-hidden="true" />
                  Bersihkan log lama ({prune.count})
                </Button>
              }
              title="Hapus log riwayat lama"
              description={`Hapus permanen ${prune.count} log riwayat yang lebih tua dari ${prune.days} hari. Tindakan ini tidak dapat dibatalkan.`}
              confirmLabel="Hapus"
              onConfirm={() =>
                router.post(routeUrl("admin.media.logs.prune"), undefined, {
                  preserveScroll: true,
                  preserveState: true,
                })
              }
            />
          ) : undefined
        }
      >
        {/* Periode memakai pola yang sama dengan halaman daftar admin lain: satu
            pilihan periode, dan rentang tanggal baru muncul setelah "Rentang
            tanggal" dipilih. Sebelumnya dua kolom tanggal tampil terus sehingga
            baris kontrolnya berbeda dari halaman lain dan terlihat seperti filter
            yang sedang berlaku padahal belum tentu. */}
        <Select
          value={activeDatePreset || "all"}
          onChange={(event) => {
            const value = event.target.value
            if (value === "all") {
              visit({ date_preset: undefined, date_from: undefined, date_to: undefined })
              return
            }
            if (value === "range") {
              visit({ date_preset: "range", date_from: rangeFrom || undefined, date_to: rangeTo || undefined })
              return
            }
            visit({ date_preset: value, date_from: undefined, date_to: undefined })
          }}
          className="w-auto"
          aria-label="Filter periode riwayat media"
        >
          <option value="all">Semua waktu</option>
          <option value="today">Hari ini</option>
          <option value="3d">3 hari terakhir</option>
          <option value="7d">7 hari terakhir</option>
          <option value="30d">30 hari terakhir</option>
          <option value="range">Rentang tanggal</option>
        </Select>
        {activeDatePreset === "range" ? (
          <form onSubmit={applyDateRange} className="flex flex-wrap items-center gap-2">
            <Input
              type="date"
              value={rangeFrom}
              onChange={(event) => setRangeFrom(event.target.value)}
              className="w-36"
              aria-label="Tanggal mulai"
            />
            <span className="text-xs text-muted-foreground">sampai</span>
            <Input
              type="date"
              value={rangeTo}
              onChange={(event) => setRangeTo(event.target.value)}
              className="w-36"
              aria-label="Tanggal akhir"
            />
            <Button type="submit" size="sm" variant="secondary">
              Terapkan
            </Button>
          </form>
        ) : null}
      </ListToolbar>

      {/* Chip periode aktif, sama seperti halaman Pengiriman dan Pembayaran,
          supaya periode yang sedang menyaring daftar selalu terbaca beserta jalan
          cepat untuk melepasnya. */}
      {activeDatePreset ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          <span className="text-[11px] font-medium text-muted-foreground">Periode</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {periodLabel}
            <button
              type="button"
              onClick={() => visit({ date_preset: undefined, date_from: undefined, date_to: undefined })}
              className="rounded-full p-0.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Hapus filter periode"
            >
              <Icon name="x" className="size-3" aria-hidden="true" />
            </button>
          </span>
        </div>
      ) : null}

      {pollError && liveActive ? (
        <ErrorState
          title="Status pemrosesan gagal dimuat"
          description={`${pollError} Baris di bawah mungkin masih menampilkan status lama.`}
          className="mb-4 min-h-0 p-6"
          action={
            <Button variant="outline" size="sm" onClick={() => setPollNonce((n) => n + 1)}>
              Coba lagi
            </Button>
          }
        />
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
        {liveRows.length ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs tracking-tight text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Waktu</th>
                    <th className="px-3 py-3 font-semibold">Media</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-3 py-3 font-semibold">Detail</th>
                    <th className="px-3 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {liveRows.map((row) => {
                    const meta = EVENT_META[row.event] ?? { label: row.event, tone: "neutral" }
                    return (
                      <tr key={row.id} className="border-t border-border align-top">
                        <td className="whitespace-nowrap px-3 py-3 text-[12px] tabular-nums text-muted-foreground">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="max-w-[16rem] px-3 py-3">
                          {row.media_href ? (
                            <Link
                              href={row.media_href}
                              className="block truncate font-medium text-primary hover:underline"
                              title={row.entity_label ?? undefined}
                            >
                              {row.entity_label ?? "-"}
                            </Link>
                          ) : (
                            <p className="truncate font-medium text-foreground">{row.entity_label ?? "-"}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {row.loggable_type.includes("ProductMedia") ? "Media produk" : "Aset"} #{row.loggable_id}
                          </p>
                          <MergedIntoNote merged={row.merged_into} />
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge status={meta.tone} label={meta.label} />
                        </td>
                        <td className="max-w-[24rem] px-3 py-3 text-[13px] text-muted-foreground">
                          {row.message ?? "-"}
                        </td>
                        <td className="w-[1%] whitespace-nowrap px-3 py-3 text-right align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {row.retry_url ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="secondary"
                                onClick={() =>
                                  router.post(row.retry_url!, undefined, {
                                    preserveScroll: true,
                                    preserveState: true,
                                  })
                                }
                              >
                                <Icon name="refresh" className="size-3.5" aria-hidden="true" />
                                Coba lagi
                              </Button>
                            ) : null}
                            {row.delete_url ? (
                              <ConfirmAction
                                trigger={
                                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus log">
                                    <Icon name="trash" className="size-3.5" aria-hidden="true" />
                                  </Button>
                                }
                                title="Hapus log riwayat"
                                description={`Hapus permanen log "${row.entity_label ?? ""}". Tindakan ini tidak dapat dibatalkan.`}
                                confirmLabel="Hapus"
                                onConfirm={() =>
                                  router.delete(row.delete_url!, {
                                    preserveScroll: true,
                                    preserveState: true,
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {liveRows.map((row) => {
                const meta = EVENT_META[row.event] ?? { label: row.event, tone: "neutral" }
                return (
                  <div key={row.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      {row.media_href ? (
                        <Link
                          href={row.media_href}
                          className="block truncate text-sm font-medium text-primary hover:underline"
                        >
                          {row.entity_label ?? "-"}
                        </Link>
                      ) : (
                        <p className="truncate text-sm font-medium text-foreground">{row.entity_label ?? "-"}</p>
                      )}
                      <StatusBadge status={meta.tone} label={meta.label} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(row.created_at)}</p>
                    {row.message ? (
                      <p className="mt-1 text-[13px] text-muted-foreground">{row.message}</p>
                    ) : null}
                    <MergedIntoNote merged={row.merged_into} />
                    <div className="mt-2 flex items-center gap-1.5">
                      {row.retry_url ? (
                        <Button
                          type="button"
                          size="xs"
                          variant="secondary"
                          onClick={() =>
                            router.post(row.retry_url!, undefined, {
                              preserveScroll: true,
                              preserveState: true,
                            })
                          }
                        >
                          <Icon name="refresh" className="size-3.5" aria-hidden="true" />
                          Coba lagi
                        </Button>
                      ) : null}
                      {row.delete_url ? (
                        <ConfirmAction
                          trigger={
                            <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus log">
                              <Icon name="trash" className="size-3.5" aria-hidden="true" />
                            </Button>
                          }
                          title="Hapus log riwayat"
                          description={`Hapus permanen log "${row.entity_label ?? ""}". Tindakan ini tidak dapat dibatalkan.`}
                          confirmLabel="Hapus"
                          onConfirm={() =>
                            router.delete(row.delete_url!, {
                              preserveScroll: true,
                              preserveState: true,
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <EmptyState
            icon="history"
            title="Belum ada riwayat pemrosesan"
            description={
              // Periode ikut dihitung: kalau hanya periode yang menyaring, pesan
              // "belum ada riwayat" akan menyesatkan karena datanya ada.
              filters.event || filters.q || activeDatePreset
                ? "Tidak ada log yang cocok dengan filter. Coba ubah pencarian, status, atau periode."
                : "Log pemrosesan media akan muncul di sini setelah media diunggah."
            }
            className="py-14"
          />
        )}
      </section>

      <div className="mt-4">
        <Pagination pagination={pagination} />
      </div>
    </AdminLayout>
  )
}
