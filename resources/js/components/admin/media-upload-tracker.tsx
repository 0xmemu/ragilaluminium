import * as React from "react"

import { Icon } from "@/components/shared/icon"
import {
  adaUnggahanBerjalan,
  bersihkanUnggahan,
  snapshotUnggahan,
  subscribeUnggahan,
  type UploadItem,
} from "@/lib/media-upload-queue"

/**
 * Panel progress unggah media yang tampil di SELURUH halaman admin.
 *
 * Dulu panel ini hidup di dalam halaman Media Library, sehingga hilang begitu
 * admin berpindah halaman padahal unggahannya masih berjalan (owner 2026-10-15).
 * Sekarang keadaannya dibaca dari antrean tingkat modul (`lib/media-upload-queue`),
 * dan komponennya dipasang di shell admin, jadi panelnya ikut terlihat di
 * halaman mana pun, termasuk Riwayat Media.
 */
export function MediaUploadTracker() {
  const { items } = React.useSyncExternalStore(
    subscribeUnggahan,
    snapshotUnggahan,
    snapshotUnggahan,
  )
  const [disembunyikan, setDisembunyikan] = React.useState(false)

  const berjalan = adaUnggahanBerjalan(items)
  const jumlah = items.length
  const jumlahSebelumnya = React.useRef(jumlah)

  // Panel muncul kembali begitu ada berkas baru, walau sebelumnya ditutup admin.
  React.useEffect(() => {
    if (jumlah > jumlahSebelumnya.current) setDisembunyikan(false)
    jumlahSebelumnya.current = jumlah
  }, [jumlah])

  // Setelah semua selesai, panel menutup sendiri supaya tidak menutupi layar.
  React.useEffect(() => {
    if (berjalan || jumlah === 0) return
    const timer = window.setTimeout(() => setDisembunyikan(true), 5000)

    return () => window.clearTimeout(timer)
  }, [berjalan, jumlah])

  // Peringatan keluar hanya saat benar-benar ada unggahan berjalan: menutup tab
  // di tengah unggahan membatalkan permintaannya, dan berkas yang belum selesai
  // tidak akan pernah sampai ke server.
  React.useEffect(() => {
    if (!berjalan) return

    const jaga = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", jaga)

    return () => window.removeEventListener("beforeunload", jaga)
  }, [berjalan])

  if (jumlah === 0 || disembunyikan) return null

  const jumlahSukses = items.filter((u) => u.status === "sukses").length
  const jumlahGagal = items.filter((u) => u.status === "gagal").length
  const jumlahKembar = items.filter((u) => u.status === "ditolak").length
  const jumlahAktif = items.filter(
    (u) => u.status === "memeriksa" || u.status === "mengantre" || u.status === "uploading",
  ).length

  return (
    <div
      className="fixed bottom-4 right-4 z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-3 shadow-float"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold">Unggah Media</p>
        <button
          type="button"
          onClick={() => setDisembunyikan(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Tutup panel unggah"
        >
          <Icon name="x" className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {items.map((u) => (
          <BarisUnggahan key={u.id} item={u} />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
        <p className="text-xs text-muted-foreground">
          {berjalan
            ? `Mengunggah ${jumlahAktif} media…`
            : `${jumlahSukses} berhasil${jumlahGagal ? `, ${jumlahGagal} gagal` : ""}${
                jumlahKembar ? `, ${jumlahKembar} kembar dilewati` : ""
              }`}
        </p>
        {!berjalan ? (
          <button
            type="button"
            onClick={() => bersihkanUnggahan()}
            className="shrink-0 text-xs font-medium text-muted-foreground underline hover:text-foreground"
          >
            Bersihkan
          </button>
        ) : null}
      </div>
    </div>
  )
}

function BarisUnggahan({ item }: { item: UploadItem }) {
  return (
    <div className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate" title={item.name}>
          {item.name}
        </span>
        {item.status === "memeriksa" ? (
          <span className="shrink-0 text-muted-foreground">memeriksa…</span>
        ) : item.status === "mengantre" ? (
          <span className="shrink-0 text-muted-foreground">menunggu</span>
        ) : item.status === "uploading" ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">{item.progress}%</span>
        ) : item.status === "sukses" ? (
          <span className="shrink-0 text-success">✓</span>
        ) : item.status === "ditolak" ? (
          <span className="shrink-0 text-muted-foreground" title={item.error ?? ""}>
            kembar
          </span>
        ) : (
          <span className="shrink-0 text-destructive" title={item.error ?? ""}>
            ✗
          </span>
        )}
      </div>
      {item.status === "uploading" ? (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all duration-150"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}
