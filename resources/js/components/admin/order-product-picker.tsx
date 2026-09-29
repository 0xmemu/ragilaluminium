import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Field, FieldAction } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { QuantityInput } from "@/components/admin/ui/quantity-input"
import { Icon } from "@/components/shared/icon"
import { formatCurrency, formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

/** Varian sebagaimana dikirim OrderController@productPicker. */
export interface PickerVariant {
  variant_sku: string
  label: string
  price: number
  stock: number
}

/** Produk aktif beserta varian aktifnya. */
export interface PickerProduct {
  id: number
  name: string
  parent_sku: string
  image: string | null
  variants: PickerVariant[]
}

/**
 * Hasil pilih produk. Kiriman ke server tetap memakai kontrak lama (induk SKU,
 * SKU varian, jumlah); nama dan label varian hanya dipakai untuk menampilkan
 * baris yang baru ditambahkan supaya admin bisa memastikan produknya benar.
 */
export interface PickedOrderProduct {
  parent_sku: string
  variant_sku: string
  qty: number
  name: string
  variant_label: string
  /** Gambar kartu produk dari hasil pencarian; null bila produk belum punya. */
  image: string | null
}

/**
 * Pemilih produk untuk mengubah isi pesanan (permintaan owner 2026-09-29:
 * pemilihan produk dibuat sesederhana pemilih media dan bisa dicari).
 *
 * Sebelumnya admin harus mengetik kode induk SKU dan SKU varian dari ingatan.
 * Sekarang: cari produk lewat nama atau SKU, klik produknya, pilih varian, lalu
 * tentukan jumlah. Varian wajib dipilih bila produknya punya varian, karena
 * baris pesanan tanpa varian tidak mengurangi stok varian.
 */
export function OrderProductPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (item: PickedOrderProduct) => void
}) {
  const [query, setQuery] = React.useState("")
  const [products, setProducts] = React.useState<PickerProduct[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const [terbuka, setTerbuka] = React.useState<number | null>(null)
  const [variantSku, setVariantSku] = React.useState("")
  const [qty, setQty] = React.useState(1)

  React.useEffect(() => {
    if (!open) return

    const timer = window.setTimeout(() => {
      setLoading(true)
      setError("")
      fetch(`${routeUrl("admin.orders.product-picker")}?q=${encodeURIComponent(query)}`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      })
        .then((res) => res.json())
        .then((data: { products?: PickerProduct[] }) => setProducts(data.products ?? []))
        .catch(() => setError("Gagal memuat produk. Coba lagi."))
        .finally(() => setLoading(false))
    }, 300)

    return () => window.clearTimeout(timer)
  }, [open, query])

  /**
   * Tutup popup sekaligus bersihkan pencarian dan pilihan sebelumnya, supaya
   * pembukaan berikutnya mulai dari kondisi kosong tanpa perlu effect.
   */
  function tutup() {
    setQuery("")
    setTerbuka(null)
    setVariantSku("")
    setQty(1)
    setError("")
    onClose()
  }

  const produkTerbuka = products.find((p) => p.id === terbuka) ?? null
  const varianTerpilih = produkTerbuka?.variants.find((v) => v.variant_sku === variantSku) ?? null

  // Produk ber varian wajib memilih varian; produk tanpa varian (mis. jasa)
  // tetap bisa ditambahkan apa adanya.
  const butuhVarian = (produkTerbuka?.variants.length ?? 0) > 0
  const stokCukup = varianTerpilih === null || varianTerpilih.stock >= qty
  const bisaTambah = produkTerbuka !== null && (!butuhVarian || varianTerpilih !== null) && stokCukup

  function bukaProduk(produk: PickerProduct) {
    if (terbuka === produk.id) {
      setTerbuka(null)
      return
    }
    setTerbuka(produk.id)
    setVariantSku(produk.variants[0]?.variant_sku ?? "")
    setQty(1)
  }

  function tambah() {
    if (!produkTerbuka || !bisaTambah) return
    onPick({
      parent_sku: produkTerbuka.parent_sku,
      variant_sku: varianTerpilih?.variant_sku ?? "",
      qty,
      name: produkTerbuka.name,
      variant_label: varianTerpilih?.label ?? "tanpa varian",
      image: produkTerbuka.image,
    })
    tutup()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : tutup())}>
      <DialogContent className="w-[min(calc(100vw-2rem),48rem)] bg-card text-card-foreground">
        <DialogTitle>Pilih produk</DialogTitle>
        <DialogDescription>
          Cari lewat nama produk atau kode SKU, lalu pilih variannya.
        </DialogDescription>

        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="pl-9"
            placeholder="Cari nama produk atau SKU"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {loading && products.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">Memuat produk...</p>
          ) : null}

          {error ? <p className="px-1 py-2 text-xs text-destructive">{error}</p> : null}

          {!loading && !error && products.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              Produk tidak ditemukan. Coba kata kunci lain.
            </p>
          ) : null}

          <ul className="space-y-1.5">
            {products.map((produk) => {
              const sedangTerbuka = produk.id === terbuka
              const hargaMulai = produk.variants.length
                ? Math.min(...produk.variants.map((v) => v.price))
                : 0

              return (
                <li
                  key={produk.id}
                  className={cn(
                    "rounded-lg border border-border bg-surface transition",
                    sedangTerbuka && "border-primary/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => bukaProduk(produk)}
                    aria-expanded={sedangTerbuka}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {produk.image ? (
                        <img src={produk.image} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <Icon name="image" className="size-4" aria-hidden="true" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {produk.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{produk.parent_sku}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {produk.variants.length > 0
                            ? `${formatNumber(produk.variants.length)} varian · mulai ${formatCurrency(hargaMulai)}`
                            : "tanpa varian"}
                        </span>
                      </span>
                    </span>
                    <Icon
                      name={sedangTerbuka ? "chevron-up" : "chevron-down"}
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>

                  {sedangTerbuka ? (
                    <div className="space-y-3 border-t border-border px-3 py-3">
                      {produk.variants.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                            Varian
                          </p>
                          <ul className="grid gap-1.5 sm:grid-cols-2">
                            {produk.variants.map((varian) => {
                              const dipilih = varian.variant_sku === variantSku
                              return (
                                <li key={varian.variant_sku}>
                                  <button
                                    type="button"
                                    onClick={() => setVariantSku(varian.variant_sku)}
                                    aria-pressed={dipilih}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition",
                                      dipilih
                                        ? "border-primary bg-primary/10 text-foreground"
                                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                                    )}
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate font-medium text-foreground">
                                        {varian.label || varian.variant_sku}
                                      </span>
                                      <span className="font-mono text-[11px]">{varian.variant_sku}</span>
                                    </span>
                                    <span className="shrink-0 text-right">
                                      <span className="block tabular-nums font-semibold text-foreground">
                                        {formatCurrency(varian.price)}
                                      </span>
                                      <span className="text-[11px]">stok {formatNumber(varian.stock)}</span>
                                    </span>
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Produk ini tidak punya varian, langsung tambahkan jumlahnya.
                        </p>
                      )}

                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Field id={`picker-jumlah-${produk.id}`} label="Jumlah">
                          <QuantityInput
                            id={`picker-jumlah-${produk.id}`}
                            value={qty}
                            onChange={setQty}
                            min={1}
                            max={999}
                            ariaLabel={`Jumlah yang ditambahkan untuk ${produk.name}`}
                          />
                        </Field>
                        <FieldAction>
                          <Button type="button" size="sm" onClick={tambah} disabled={!bisaTambah}>
                            Tambah ke pesanan
                          </Button>
                        </FieldAction>
                      </div>
                      {!stokCukup && varianTerpilih ? (
                        <p role="alert" className="text-xs text-destructive">
                          Stok varian ini hanya {formatNumber(varianTerpilih.stock)}.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  )
}
