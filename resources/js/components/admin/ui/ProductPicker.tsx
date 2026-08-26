import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Checkbox } from "@/components/admin/ui/checkbox"
import { EmptyState } from "@/components/admin/ui/empty-state"
import { Field } from "@/components/admin/ui/field"
import { Pagination } from "@/components/admin/ui/pagination"
import { Select } from "@/components/admin/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui/table"
import type { Pagination as PaginationData } from "@/types"
import { cn } from "@/lib/utils"

export interface PickerProduct {
  id: number
  parent_sku: string
  name: string
  category: string
  model: string
  sub_model: string
  price: number
  dimensions: string
}

interface ProductPickerProps {
  onSelect: (products: PickerProduct[]) => void
  maxSelection?: number
  initialSelection?: PickerProduct[]
  endpoint?: string
  className?: string
}

function formatCurrency(value: number): string {
  return "Rp " + value.toLocaleString("id-ID")
}

/**
 * Product Picker untuk target promo: search (debounce 300ms), filter
 * kategori + model, bulk selection dengan counter & max limit, pagination.
 */
export function ProductPicker({
  onSelect,
  maxSelection = 100,
  initialSelection = [],
  endpoint = "/admin/promotions/products",
  className,
}: ProductPickerProps) {
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [model, setModel] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<PickerProduct[]>(initialSelection)
  const [products, setProducts] = React.useState<PickerProduct[]>([])
  const [pagination, setPagination] = React.useState<PaginationData | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const selectedIds = React.useMemo(() => new Set(selected.map((p) => p.id)), [selected])

  React.useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setError("")
      try {
        const query = new URLSearchParams({ q: search, category, model, page: String(page), per_page: "20" })
        const res = await fetch(`${endpoint}?${query.toString()}`, { signal: controller.signal, headers: { Accept: "application/json" } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setProducts(data.data ?? [])
        setPagination((data as PaginationData) ?? null)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Gagal memuat produk. Coba lagi.")
        }
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [search, category, model, page, endpoint])

  function toggleSelect(product: PickerProduct) {
    let next: PickerProduct[]
    if (selectedIds.has(product.id)) {
      next = selected.filter((p) => p.id !== product.id)
    } else {
      if (selected.length >= maxSelection) return
      next = [...selected, product]
    }
    setSelected(next)
    onSelect(next)
  }

  function toggleSelectAll() {
    const visible = products.filter((p) => !selectedIds.has(p.id))
    if (visible.length === 0 || selected.length === products.length) {
      // Hapus hanya yang terlihat
      const visibleIds = new Set(products.map((p) => p.id))
      const next = selected.filter((p) => !visibleIds.has(p.id))
      setSelected(next)
      onSelect(next)
      return
    }
    const room = maxSelection - selected.length
    const next = [...selected, ...visible.slice(0, room)]
    setSelected(next)
    onSelect(next)
  }

  function clearSelection() {
    setSelected([])
    onSelect([])
  }

  const allVisibleSelected = products.length > 0 && products.every((p) => selectedIds.has(p.id))
  const atLimit = selected.length >= maxSelection

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search & Filter */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field id="picker-search" label="Cari produk" className="md:col-span-1">
          <input
            type="search"
            className="h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="Nama produk, SKU..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </Field>
        <Field id="picker-category" label="Kategori">
          <Select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}>
            <option value="">Semua kategori</option>
            <option value="JENDELA">Jendela</option>
            <option value="PINTU">Pintu</option>
            <option value="BOVEN">Boven</option>
          </Select>
        </Field>
        <Field id="picker-model" label="Model">
          <Select value={model} onChange={(event) => { setModel(event.target.value); setPage(1) }}>
            <option value="">Semua model</option>
            <option value="JUNGKIT">Jungkit</option>
            <option value="SLIDING">Sliding</option>
            <option value="SWING">Swing</option>
            <option value="KACA MATI">Kaca Mati</option>
            <option value="ZIGZAG">Zigzag</option>
          </Select>
        </Field>
      </div>

      {/* Counter & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{selected.length}</span> produk terpilih
          {maxSelection > 0 ? ` (maks ${maxSelection})` : ""}
        </p>
        <div className="flex items-center gap-2">
          {selected.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Hapus pilihan
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">{pagination?.total ?? 0} produk</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  disabled={loading || products.length === 0}
                  aria-label="Pilih semua produk di halaman ini"
                />
              </TableHead>
              <TableHead>Produk</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Harga</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Memuat produk...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-4">
                  <EmptyState
                    title={error ? "Gagal memuat produk" : "Tidak ada produk"}
                    description={error ?? "Coba ubah kata kunci atau filter."}
                    className="min-h-40 border-0 bg-transparent"
                  />
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const isSelected = selectedIds.has(product.id)
                const disabled = !isSelected && atLimit
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelect(product)}
                        disabled={disabled}
                        aria-label={`Pilih ${product.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.parent_sku}
                        {product.dimensions ? ` · ${product.dimensions}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{product.category}</TableCell>
                    <TableCell className="text-sm">{product.model}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {product.price > 0 ? formatCurrency(product.price) : "-"}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {atLimit ? (
        <p className="text-xs text-muted-foreground">
          Batas {maxSelection} produk tercapai. Hapus sebagian pilihan untuk menambah lagi.
        </p>
      ) : null}

      {/* Pagination */}
      {pagination && <Pagination pagination={pagination} />}
    </div>
  )
}
