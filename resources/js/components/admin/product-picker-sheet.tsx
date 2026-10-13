import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Sheet, SheetContent } from "@/components/admin/ui/sheet"
import { ProductPicker, type PickerProduct } from "@/components/admin/ui/ProductPicker"

export type { PickerProduct }

/**
 * Pemilih produk siap pakai: satu komponen yang mengemas pemicu, panel samping,
 * dan ProductPicker di dalamnya (pola sama dengan MediaLibrarySelect, owner
 * 2026-09-29).
 *
 * Sebelum ini tiga form (Promo Toko, Voucher, Ulasan) masing-masing menulis
 * ulang rangkaian yang sama: tombol pemicu, state buka/tutup, Sheet dengan
 * judul + keterangan, lalu ProductPicker dan deretan tombol penutup. Selain
 * boros, tiap salinan bisa berbeda sendiri. Sekarang cukup satu komponen.
 *
 * Pemicu diserahkan lewat `trigger` (render prop) supaya tiap halaman tetap
 * bebas menentukan bentuk tombolnya (mis. label yang memuat jumlah produk
 * terpilih), sementara bagian panelnya seragam.
 */
export function ProductPickerSheet({
  title,
  description,
  maxSelection = 100,
  initialSelection = [],
  onSelect,
  endpoint,
  trigger,
  closeLabel = "Tutup",
  footer,
}: {
  /** Judul panel; dipakai juga sebagai nama aksesibel drawer. */
  title: string
  /** Satu kalimat keterangan di bawah judul. */
  description: string
  maxSelection?: number
  initialSelection?: PickerProduct[]
  onSelect: (products: PickerProduct[]) => void
  /** Endpoint katalog; kosong berarti memakai bawaan ProductPicker. */
  endpoint?: string
  /** Tombol pemicu; terima fungsi pembuka panel. */
  trigger: (open: () => void) => React.ReactNode
  /** Label tombol tutup kiri (tombol ghost). */
  closeLabel?: string
  /** Tombol tambahan di kanan; terima fungsi penutup panel. */
  footer?: (close: () => void) => React.ReactNode
}) {
  const [terbuka, setTerbuka] = React.useState(false)
  const tutup = () => setTerbuka(false)

  return (
    <>
      {trigger(() => setTerbuka(true))}
      <Sheet open={terbuka} onOpenChange={setTerbuka}>
        <SheetContent side="right" title={title} className="w-full overflow-y-auto sm:max-w-3xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="mt-4 space-y-4">
            <ProductPicker
              endpoint={endpoint}
              maxSelection={maxSelection}
              initialSelection={initialSelection}
              onSelect={onSelect}
            />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={tutup}>
                {closeLabel}
              </Button>
              {footer?.(tutup)}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
