import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { WilayahOption } from "@/components/public/wilayah-search-select"

export interface PickedLocation {
  display_name: string
  lat: number
  lon: number
  postcode?: string
  province?: string
  city?: string
  district?: string
  village?: string
  province_id?: string
  city_id?: string
  district_id?: string
  village_id?: string
}

interface NominatimAddress {
  road?: string
  suburb?: string
  village?: string
  town?: string
  city?: string
  municipality?: string
  county?: string
  state?: string
  postcode?: string
}

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

const NOMINATIM = "https://nominatim.openstreetmap.org"

function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(kab\.?|kota|kec\.?|kel\.?|desa|kelurahan|kecamatan)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function matchOption(options: WilayahOption[], name?: string): WilayahOption | undefined {
  if (!name) return undefined
  const needle = normName(name)
  if (!needle) return undefined
  return (
    options.find((option) => normName(option.name) === needle) ??
    options.find(
      (option) =>
        normName(option.name).includes(needle) || needle.includes(normName(option.name)),
    )
  )
}

function embedUrl(lat: number, lon: number): string {
  const dLat = 0.004
  const dLon = 0.006
  return `${NOMINATIM.replace("nominatim", "www.openstreetmap")}/export/embed.html?bbox=${lon - dLon}%2C${lat - dLat}%2C${lon + dLon}%2C${lat + dLat}&layer=mapnik&marker=${lat}%2C${lon}`
}

export function LocationPickerModal({
  open,
  onOpenChange,
  provinces,
  regencies,
  districts,
  villages,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provinces: WilayahOption[]
  regencies: WilayahOption[]
  districts: WilayahOption[]
  villages: WilayahOption[]
  onApply: (location: PickedLocation) => void
}) {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<NominatimResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<NominatimResult | null>(null)
  const [resolving, setResolving] = React.useState(false)

  // AbortController per operasi: membatalkan request lama saat pencarian baru
  // dimulai atau modal ditutup — mencegah response lama menimpa hasil baru (race).
  const searchAbortRef = React.useRef<AbortController | null>(null)
  const reverseAbortRef = React.useRef<AbortController | null>(null)

  function abortInFlight(): void {
    searchAbortRef.current?.abort()
    reverseAbortRef.current?.abort()
  }

  async function search(event: React.FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (value.length < 3) {
      setError("Ketik minimal 3 huruf untuk mencari lokasi (misal nama kecamatan atau kota).")
      return
    }

    // Batalkan pencarian sebelumnya yang masih berjalan.
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    setSearching(true)
    setError(null)
    try {
      const response = await fetch(
        `${NOMINATIM}/search?format=jsonv2&countrycodes=id&limit=6&accept-language=id&q=${encodeURIComponent(value)}`,
        { signal: controller.signal },
      )
      if (!response.ok) throw new Error(`nominatim ${response.status}`)
      const payload = (await response.json()) as NominatimResult[]
      setResults(Array.isArray(payload) ? payload : [])
      if (!payload.length) setError("Lokasi tidak ditemukan. Coba kata kunci lain.")
    } catch (error) {
      // Abort (pencarian baru / modal ditutup) bukan kegagalan — jangan tampilkan error.
      if ((error as Error)?.name !== "AbortError") {
        setError("Pencarian lokasi gagal. Periksa koneksi lalu coba lagi.")
        setResults([])
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  async function pick(result: NominatimResult) {
    // Batalkan reverse yang masih berjalan dari pilihan sebelumnya.
    reverseAbortRef.current?.abort()
    const controller = new AbortController()
    reverseAbortRef.current = controller

    setSelected(result)
    setResolving(true)
    setError(null)
    try {
      const response = await fetch(
        `${NOMINATIM}/reverse?format=jsonv2&lat=${result.lat}&lon=${result.lon}&accept-language=id`,
        { signal: controller.signal },
      )
      if (!response.ok) throw new Error(`nominatim ${response.status}`)
      const payload = (await response.json()) as { address?: NominatimAddress }
      const address = payload.address ?? {}
      const cityName =
        address.city || address.municipality || address.town || address.county || ""
      const provinceName = address.state || ""

      // ID wilayah diisi bila nama cocok dengan daftar Kemendagri yang dimuat.
      const province = matchOption(provinces, provinceName)
      const regency = matchOption(regencies, cityName)
      const district = matchOption(districts, address.county || address.suburb || "")
      const village = matchOption(villages, address.village || address.suburb || "")

      onApply({
        display_name: result.display_name,
        lat: Number(result.lat),
        lon: Number(result.lon),
        postcode: address.postcode,
        province: province?.name ?? provinceName,
        city: regency?.name ?? cityName,
        district: district?.name ?? address.county ?? address.suburb,
        village: village?.name ?? address.village ?? address.suburb ?? address.town,
        province_id: province?.id,
        city_id: regency?.id,
        district_id: district?.id,
        village_id: village?.id,
      })
      setSelected(null)
      setQuery("")
      setResults([])
      onOpenChange(false)
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        setError("Gagal mengambil detail lokasi. Coba lagi.")
      }
    } finally {
      if (!controller.signal.aborted) setResolving(false)
    }
  }

  React.useEffect(() => {
    if (!open) {
      // Modal ditutup: batalkan semua request yang masih berjalan.
      abortInFlight()
      // Reset state pencarian saat modal ditutup — bukan derived state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("")
      setResults([])
      setSelected(null)
      setError(null)
    }
    // Unmount saat request berjalan: batalkan agar tidak ada setState setelah unmount.
    return () => abortInFlight()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div>
          <DialogTitle>Pilih lokasi di peta</DialogTitle>
          <DialogDescription className="mt-2">
            Cari alamat Anda, lalu pilih. Kode pos dan wilayah akan terisi otomatis — Anda cukup
            menambahkan alamat rumah dan patokan.
          </DialogDescription>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama jalan, kecamatan, atau kota…"
            aria-label="Cari lokasi"
            className="min-h-11 flex-1"
          />
          <Button type="submit" className="shrink-0" disabled={searching}>
            <Icon name="search" className="size-4" aria-hidden="true" />
            {searching ? "Mencari..." : "Cari"}
          </Button>
        </form>

        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

        {results.length ? (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {results.map((result) => (
              <li key={`${result.lat}-${result.lon}`}>
                <button
                  type="button"
                  onClick={() => void pick(result)}
                  disabled={resolving}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-accent disabled:opacity-60"
                >
                  <Icon name="map-pin" className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 break-words leading-5">{result.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {selected ? (
          <div className="space-y-2">
            <iframe
              title="Pratinjau peta lokasi"
              src={embedUrl(Number(selected.lat), Number(selected.lon))}
              className="h-56 w-full rounded-lg border border-border"
              loading="lazy"
            />
            <p className="text-xs text-muted-foreground">{selected.display_name}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[11px] leading-4 text-muted-foreground">
            Data lokasi dari OpenStreetMap. Periksa kembali kebenarannya sebelum lanjut.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={cn("shrink-0")}
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
