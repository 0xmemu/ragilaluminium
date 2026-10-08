import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { CopyButton } from "@/components/admin/ui/copy-button"
import { Dialog, DialogContent, DialogTitle } from "@/components/admin/ui/dialog"
import { Icon } from "@/components/shared/icon"
import { formatDateTime, productName } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Data satu ulasan yang dibutuhkan popup detail.
 *
 * Bentuknya sengaja memuat SEMUA yang ditampilkan popup, supaya daftar bisa
 * mengirimnya langsung dari baris yang sudah dimuat dan popup tidak perlu
 * meminta data kedua kalinya.
 */
export interface TestimonialDetailTarget {
  id: number
  customer_name: string
  rating?: number | null
  message?: string | null
  created_at?: string | null
  location?: string | null
  source_label?: string | null
  /** Nama LENGKAP produk katalog; `short_name` hanya berisi dimensi. */
  product_name?: string | null
  product_sku?: string | null
  product_image?: string | null
  /** Semua media ulasan berurutan, termasuk sampul (imagesPayload). */
  photos?: string[] | null
  admin_reply?: string | null
  admin_replied_at?: string | null
  has_reply?: boolean
  /** Ulasan marketplace murni screenshot tidak punya teks untuk dibalas. */
  can_reply?: boolean
}

function Bagian({
  judul,
  bagian,
  children,
}: {
  judul: string
  /** Penanda urutan bagian (produk, pelanggan, ulasan, media, balasan). */
  bagian: string
  children: React.ReactNode
}) {
  return (
    <section data-bagian={bagian} className="min-w-0">
      <p className="text-xs font-semibold text-muted-foreground">{judul}</p>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/**
 * Popup detail satu ulasan (owner 2026-10-06).
 *
 * Menggantikan halaman detail ulasan. Urutannya ditetapkan owner: produk yang
 * diulas paling atas, lalu detail pelanggan, ulasan pelanggan, media dari
 * pelanggan, dan balasan toko paling bawah.
 *
 * Popup ini MURNI BACA. Membalas tetap lewat satu dialog bersama
 * (`ReviewReplyDialog`) supaya hanya ada satu tempat menulis balasan; tombol di
 * section terakhir hanya memanggil `onReply`, tidak menyimpan apa pun sendiri.
 */
export function TestimonialDetailDialog({
  row,
  onClose,
  onReply,
}: {
  row: TestimonialDetailTarget | null
  onClose: () => void
  /** Buka dialog balasan bersama dari section "Balasan toko". */
  onReply?: (row: TestimonialDetailTarget) => void
}) {
  const foto = row?.photos ?? []
  const meta = [row?.source_label, row?.location].filter(Boolean).join(" · ")
  // Nama produk dilewatkan formatter standar rumah (lib/format), sama dengan
  // kartu produk publik, baris keranjang, dan baris isi pesanan, supaya rapat
  // angka satuannya seragam di seluruh panel.
  const namaProduk = row?.product_name ? productName(row.product_name) : ""

  return (
    <Dialog open={Boolean(row)} onOpenChange={(next) => (next ? undefined : onClose())}>
      {/* aria-describedby={undefined}: popup ini sengaja tanpa kalimat
          pengantar, jadi kehadirannya dinyatakan kosong secara eksplisit
          (pola resmi Radix) supaya pembaca layar tidak menebak-nebak. */}
      <DialogContent aria-describedby={undefined} className="max-w-2xl bg-card text-card-foreground">
        <DialogTitle>Detail ulasan</DialogTitle>

        {row ? (
          <div className="space-y-5">
            {/* 1. Produk yang diulas: paling atas (permintaan owner 2026-10-06) */}
            <Bagian judul="Produk yang diulas" bagian="produk">
              {namaProduk ? (
                <div className="flex gap-3.5 rounded-lg border border-border p-4">
                  <div className="size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {row.product_image ? (
                      <img src={row.product_image} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Icon name="image" className="size-4" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-1.5">
                      <p className="text-sm font-normal leading-5 text-foreground">{namaProduk}</p>
                      <CopyButton text={namaProduk} label="Salin nama produk" compact showTextInTitle />
                    </div>
                    {row.product_sku ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">SKU {row.product_sku}</span>
                        <CopyButton text={row.product_sku} label="Salin SKU produk" compact showTextInTitle />
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ulasan umum, tidak ditautkan ke produk tertentu di katalog.
                </p>
              )}
            </Bagian>

            {/* 2. Detail pelanggan */}
            <Bagian judul="Pelanggan" bagian="pelanggan">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                    {row.customer_name.trim() ? row.customer_name.trim()[0].toUpperCase() : "P"}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-foreground">{row.customer_name}</h3>
                    <p className="text-xs text-muted-foreground">{meta || "Pelanggan website"}</p>
                    {row.created_at ? (
                      <p className="text-[11px] text-muted-foreground">
                        Dikirim {formatDateTime(row.created_at)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {row.rating ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-0.5 text-warning"
                      aria-label={`${row.rating} dari 5 bintang`}
                    >
                      {Array.from({ length: 5 }, (_, index) => (
                        <Icon
                          key={index}
                          name="star"
                          weight="fill"
                          className={cn("size-4", index < Number(row.rating) ? "text-warning" : "text-muted/30")}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <span className="font-mono text-sm font-bold text-foreground">{row.rating} / 5</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Tanpa rating</span>
                )}
              </div>
            </Bagian>

            {/* 3. Ulasan pelanggan */}
            <Bagian judul="Ulasan pelanggan" bagian="ulasan">
              {/* Ulasan pelanggan diberi KOTAK, dengan warna panel baca.
                  Jangan pakai bg-surface untuk ini: di tema admin gelap token
                  surface bernilai SAMA dengan latar kartu popup (#1d1d22), dan
                  itulah latar yang dipakai kolom isian. Jadi kotak berlatar
                  surface terbaca seperti input kosong (owner 2026-10-06 dua
                  kali: "agar ulasan ga kelihatan kaya text ui", lalu "ga ada
                  frame sama sekali" setelah kotaknya dicabut). Panel baca
                  memakai bg-surface-muted (#27272c, lebih terang dari kartu),
                  sama dengan panel info read-only di InstallationGallery. */}
              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
                  {row.message?.trim() || (
                    <span className="italic text-muted-foreground">
                      Tidak menulis ulasan teks, hanya mengirim media.
                    </span>
                  )}
                </p>
              </div>
            </Bagian>

            {/* 4. Media dari pelanggan */}
            <Bagian bagian="media" judul={foto.length > 0 ? `Media dari pelanggan (${foto.length})` : "Media dari pelanggan"}>
              {foto.length > 0 ? (
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4" aria-label="Media ulasan">
                  {foto.map((url, index) => (
                    <li
                      key={url}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-muted"
                    >
                      <img
                        src={url}
                        alt={`Media ${index + 1}`}
                        className="size-full object-cover transition duration-150 group-hover:scale-105"
                      />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white opacity-0 transition-opacity hover:opacity-100"
                        title="Buka media ukuran penuh"
                      >
                        Lihat
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Pelanggan tidak melampirkan media.</p>
              )}
            </Bagian>

            {/* 5. Balasan toko: paling bawah (permintaan owner 2026-10-06) */}
            <Bagian judul="Balasan toko" bagian="balasan">
              {row.has_reply && row.admin_reply ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Icon name="storefront" className="size-3.5" aria-hidden="true" />
                      <span>Ragil Aluminium</span>
                    </p>
                    {row.admin_replied_at ? (
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(row.admin_replied_at)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {row.admin_reply}
                  </p>
                  {row.can_reply && onReply ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => onReply(row)}
                    >
                      Edit balasan
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    {row.can_reply
                      ? "Belum dibalas."
                      : "Ulasan marketplace tanpa teks, jadi tidak bisa dibalas."}
                  </p>
                  {row.can_reply && onReply ? (
                    <Button type="button" size="sm" onClick={() => onReply(row)}>
                      Balas ulasan
                    </Button>
                  ) : null}
                </div>
              )}
            </Bagian>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
