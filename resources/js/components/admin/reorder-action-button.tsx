import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { HintTip } from "@/components/admin/ui/hint-tip"

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
 *
 * Tombol yang nonaktif dibungkus hint (permintaan owner 2026-09-28): tombol mati
 * tanpa alasan membuat admin menebak, sedangkan `title` bawaan peramban baru
 * muncul setelah jeda dan mudah terlewat.
 *
 * Ketiga tombol di sini ditandai `data-reorder-allow` (kontrak owner 2026-09-30):
 * saat mode urut aktif, halaman mengunci seluruh kontrol lewat kelas
 * `admin-reorder-lock`, dan hanya kontrol bertanda ini (plus pegangan geser)
 * yang tetap bisa diklik.
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
  /** Alasan tombol nonaktif, tampil sebagai hint saat kursor atau fokus ke tombol. */
  disabledReason?: string
  /** Ukuran tombol, mengikuti ukuran tombol lain di header halaman. */
  size?: "sm" | "md"
  onToggle: () => void
  onCancel: () => void
  onSave: () => void
}) {
  // Kontrak owner 2026-09-29: tombol Urutkan TIDAK DITAMPILKAN saat mode urut
  // memang belum bisa dipakai (daftar kosong, atau filter/cakupan belum memenuhi
  // syarat). Tombol mati plus keterangan masih menyisakan kontrol yang tidak bisa
  // dipakai dan membuat admin menerka; menyembunyikannya membuat header bersih.
  // Tombol muncul sendiri begitu syaratnya terpenuhi. Keadaan mode aktif tetap
  // dirender supaya admin selalu punya jalan menyimpan atau mengurungkan.
  if (!active && disabled) return null

  // Tombol nonaktif memakai pointer-events-none, jadi pemicu hover harus span
  // pembungkus dari hint. Garis putus dimatikan supaya tampilan tombol tidak
  // berubah dari tombol lain di header.
  function denganHint(tombol: React.ReactNode, nonaktif: boolean): React.ReactNode {
    if (!nonaktif || !disabledReason) return tombol

    return (
      <HintTip label={tombol} hint={disabledReason} side="bottom" align="right" className="no-underline" />
    )
  }

  if (!active) {
    return (
      <Button type="button" data-reorder-allow variant="secondary" size={size} onClick={onToggle}>
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
      <>
        {denganHint(
          <Button
            type="button"
            data-reorder-allow
            size={size}
            disabled={processing || disabled}
            title={disabled ? disabledReason : undefined}
            onClick={onSave}
          >
            {processing ? "Menyimpan..." : "Simpan urutan"}
          </Button>,
          disabled && !processing,
        )}
      </>
    )
  }

  return (
    <Button type="button" data-reorder-allow variant="secondary" size={size} onClick={onCancel}>
      <Icon name="arrow-counter-clockwise" className="size-4" aria-hidden="true" />
      Urungkan
    </Button>
  )
}
