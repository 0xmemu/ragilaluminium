import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"

export type { PickedMedia }

/**
 * Pemilih media siap pakai: satu komponen yang mengemas pemicu dan panel
 * MediaPicker sekaligus (pola sama dengan ProductPickerSheet, owner 2026-09-29
 * untuk pemilih produk). Sebelum ini tiap halaman menulis ulang rangkaian yang
 * sama: tombol pemicu, state buka/tutup, lalu modal MediaPicker; salinannya
 * bisa berbeda sendiri antar halaman.
 *
 * Pemicu diserahkan lewat `trigger` (render prop) supaya tiap halaman tetap
 * bebas menentukan bentuk tombolnya (mis. label yang memuat jumlah foto
 * terpilih), sementara panelnya seragam dan langsung tertutup setelah pilihan
 * dikirim ke `onPick`.
 */
export function MediaPickerSheet({
  title,
  multiple = false,
  kind,
  onPick,
  trigger,
}: {
  /** Judul panel; dipakai juga sebagai nama aksesibel modal. */
  title: string
  multiple?: boolean
  /** Batasi daftar ke satu jenis media; penyaringan dilakukan di server. */
  kind?: "image" | "video"
  onPick: (media: PickedMedia[]) => void
  /** Tombol pemicu; terima fungsi pembuka panel. */
  trigger: (open: () => void) => React.ReactNode
}) {
  const [terbuka, setTerbuka] = React.useState(false)

  return (
    <>
      {trigger(() => setTerbuka(true))}
      <MediaPicker
        open={terbuka}
        onClose={() => setTerbuka(false)}
        multiple={multiple}
        kind={kind}
        title={title}
        onPick={(media) => {
          onPick(media)
          setTerbuka(false)
        }}
      />
    </>
  )
}
