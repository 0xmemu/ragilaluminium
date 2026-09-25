import * as React from "react"

/**
 * Mode Urutkan untuk daftar admin: menyalakan mode, menggeser baris, menyimpan,
 * dan membatalkan. Sebelumnya blok ini disalin di sembilan halaman, sehingga
 * aturan snapshot dan penomoran ulang bercabang, dan perbaikan bug sinkronisasi
 * harus diulang di setiap halaman.
 *
 * Hook ini tidak menggambar apa pun dan tidak menyimpan sendiri ke server. Ia
 * memegang salinan urutan yang sedang disunting (`orderedRows`), menyusun
 * payload form Inertia, lalu menyerahkan pengiriman ke form halaman.
 */

/** Opsi kirim Inertia yang dipakai mode urut. */
export interface ReorderSubmitOptions {
  preserveScroll?: boolean
  preserveState?: boolean
  onSuccess?: () => void
}

/**
 * Bagian form Inertia yang dibutuhkan hook ini: `useForm` dari halaman sudah
 * memenuhi bentuk ini, jadi tidak perlu pembungkus tambahan.
 */
export interface ReorderFormLike<Item> {
  setData: (field: "rows", value: Item[]) => void
  setDefaults: (field: "rows", value: Item[]) => void
  put: (url: string, options?: ReorderSubmitOptions) => void
  post: (url: string, options?: ReorderSubmitOptions) => void
}

/** Baris minimal yang bisa diurutkan: punya kunci dan nomor urut. */
export interface ReorderRow {
  id: number | string
  sort_order?: number | null
  no?: number
}

/** Item payload urutan yang dikirim ke server. */
export interface ReorderItem {
  id: number | string
  sort_order: number
}

/**
 * Geser satu baris dari posisi `from` ke posisi `to`. Indeks di luar rentang
 * dan geseran ke posisi yang sama dikembalikan apa adanya, supaya pemanggil
 * bisa mengenali "tidak ada perubahan" dari identitas array.
 */
export function moveRow<Row>(rows: Row[], from: number, to: number): Row[] {
  if (from === to) return rows
  if (from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows
  const next = [...rows]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Tulis ulang kolom nomor tampil (`no`) dan nomor urut sesuai posisi sekarang. */
export function numberRows<Row>(rows: Row[]): Row[] {
  return rows.map((row, index) => ({ ...row, no: index + 1, sort_order: index }))
}

/** Susun payload urutan dari daftar baris saat ini. */
export function buildReorderItems(rows: Array<{ id: number | string }>): ReorderItem[] {
  return rows.map((row, index) => ({ id: row.id, sort_order: index }))
}

export interface UseReorderModeOptions<Row extends ReorderRow, Item> {
  /** Urutan terakhir dari server; jadi titik pulang tombol Urungkan. */
  snapshot: Row[]
  form: ReorderFormLike<Item>
  /** Alamat simpan urutan, misalnya `reorderUrl` dari controller. */
  url: string
  /** Bangun payload form dari daftar baris saat ini. */
  buildItems: (rows: Row[]) => Item[]
  /** Simpan memakai POST, bukan PUT. Halaman Sub Model memakai POST. */
  method?: "put" | "post"
  /** Tulis ulang kolom nomor tampil setiap baris digeser. */
  numbering?: boolean
  /** Opsi kirim yang sama seperti sebelumnya per halaman. */
  submitOptions?: ReorderSubmitOptions
  /** Aksi tambahan tepat sebelum kirim, misalnya menitipkan kunci lain. */
  beforeSave?: () => void
  /** Efek sinkronisasi dari server boleh dilewati, misalnya di tab lain. */
  syncEnabled?: boolean
  /** Aksi tambahan saat snapshot server tiba, misalnya menutup editor baris. */
  onSync?: () => void
}

/**
 * Pegang keadaan mode Urutkan. Nilai baliknya dipakai halaman dengan nama yang
 * sudah ada sebelumnya (`reorderMode`, `reorderRows`, `saveReorder`, dan
 * seterusnya) supaya JSX tidak perlu berubah.
 */
export function useReorderMode<Row extends ReorderRow, Item>({
  snapshot,
  form,
  url,
  buildItems,
  method = "put",
  numbering = false,
  submitOptions,
  beforeSave,
  syncEnabled = true,
  onSync,
}: UseReorderModeOptions<Row, Item>) {
  const [mode, setMode] = React.useState(false)
  const [orderedRows, setOrderedRows] = React.useState<Row[]>(snapshot)

  React.useEffect(() => {
    if (!syncEnabled) return
    // Snapshot server baru: salinan yang disunting dan titik pulang tombol
    // Urungkan harus sama, karena `isDirty` membandingkan data dengan defaults.
    // Kalau hanya salah satu yang pindah, tombol Simpan urutan muncul sendiri
    // tanpa ada geseran.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderedRows(snapshot)
    form.setData("rows", buildItems(snapshot))
    form.setDefaults("rows", buildItems(snapshot))
    onSync?.()
    // `useForm` menghasilkan facade baru tiap render, jadi snapshot server
    // satu-satunya dependensi yang sah. `buildItems` dan `form` sengaja tidak
    // masuk daftar dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, syncEnabled])

  /** Geser baris dan bawa perubahan ke payload form. */
  function move(from: number, to: number) {
    const moved = moveRow(orderedRows, from, to)
    if (moved === orderedRows) return
    const next = numbering ? numberRows(moved) : moved
    setOrderedRows(next)
    form.setData("rows", buildItems(next))
  }

  /** Kirim urutan baru, lalu keluar dari mode begitu server menerimanya. */
  function save() {
    beforeSave?.()
    form[method](url, {
      ...submitOptions,
      onSuccess: () => setMode(false),
    })
  }

  /** Kembalikan urutan ke snapshot server lalu keluar dari mode. */
  function cancel() {
    setOrderedRows(snapshot)
    form.setData("rows", buildItems(snapshot))
    form.setDefaults("rows", buildItems(snapshot))
    setMode(false)
  }

  return { mode, setMode, orderedRows, move, save, cancel }
}
