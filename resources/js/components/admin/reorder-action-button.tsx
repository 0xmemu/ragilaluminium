import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"

/**
 * Tombol aksi mode urut untuk halaman daftar admin (kontrak owner 2026-09-20).
 *
 * Satu tombol yang berubah peran mengikuti keadaan, bukan dua tombol menumpuk:
 *   - belum aktif       : "Urutkan" (mengaktifkan mode urut)
 *   - aktif, belum geser: "Urungkan" (membatalkan, urutan kembali seperti semula)
 *   - aktif, sudah geser: "Simpan urutan" (satu-satunya primari di header)
 *
 * Alasannya: menampilkan "Simpan urutan" sebelum mode urut aktif itu tidak masuk
 * akal, karena belum ada yang perlu disimpan. Tombol simpan hanya muncul saat
 * memang ada perubahan urutan yang menunggu disimpan.
 *
 * Dipakai bersama oleh halaman daftar admin yang punya mode urut, supaya
 * perilakunya identik dan tidak ditulis ulang di tiap halaman.
 */
export function ReorderActionButton({
  active,
  dirty,
  processing = false,
  disabled = false,
  disabledReason,
  size = "md",
  onToggle,
  onCancel,
  onSave,
}: {
  /** Mode urut sedang aktif. */
  active: boolean
  /** Ada perubahan urutan yang belum disimpan. */
  dirty: boolean
  /** Permintaan simpan sedang berjalan. */
  processing?: boolean
  /** Tidak ada yang bisa diurutkan (daftar kosong atau filter belum memenuhi syarat). */
  disabled?: boolean
  /** Alasan tombol nonaktif, tampil sebagai tooltip. */
  disabledReason?: string
  /** Ukuran tombol, mengikuti ukuran tombol lain di header halaman. */
  size?: "sm" | "md"
  onToggle: () => void
  onCancel: () => void
  onSave: () => void
}) {
  if (!active) {
    return (
      <Button
        type="button"
        variant="secondary"
        size={size}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={onToggle}
      >
        <Icon name="dots-six-vertical" className="size-4" aria-hidden="true" />
        Urutkan
      </Button>
    )
  }

  if (dirty) {
    // `disabled` juga mengunci simpan: kalau daftar jadi tersaring saat mode urut
    // berjalan, payload simpan hanya memuat baris yang tampil dan urutan baris di
    // luar filter ikut tertimpa. Mengurungkan tetap boleh, jadi hanya simpan yang dikunci.
    return (
      <Button
        type="button"
        size={size}
        disabled={processing || disabled}
        title={disabled ? disabledReason : undefined}
        onClick={onSave}
      >
        {processing ? "Menyimpan..." : "Simpan urutan"}
      </Button>
    )
  }

  return (
    <Button type="button" variant="secondary" size={size} onClick={onCancel}>
      <Icon name="arrow-counter-clockwise" className="size-4" aria-hidden="true" />
      Urungkan
    </Button>
  )
}
