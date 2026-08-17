import { usePage } from "@inertiajs/react"
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
import type { WilayahOption } from "@/components/public/wilayah-search-select"
import type { SharedPageProps } from "@/types"

export interface PickedLocation {
  display_name: string
  lat: number
  lon: number
  postal_code?: string | null
  province?: string
  city?: string
  district?: string
  village?: string
  province_id?: string
  city_id?: string
  district_id?: string
  village_id?: string
}

interface GoogleLocationResult {
  place_id?: string
  display_name: string
  lat: number
  lon: number
  province?: string | null
  city?: string | null
  district?: string | null
  village?: string | null
}

interface GoogleMapsResponse {
  state: "ready" | "not_found" | "unavailable"
  results?: GoogleLocationResult[]
}

function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(kab\.?|kota|kec\.?|kel\.?|desa|kelurahan|kecamatan)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function matchOption(options: WilayahOption[], name?: string | null): WilayahOption | undefined {
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

function embedUrl(lat: number, lon: number, browserKey?: string | null): string | null {
  if (!browserKey) return null
  return "https://www.google.com/maps/embed/v1/view?key=" +
    encodeURIComponent(browserKey) + "&center=" + lat + "," + lon + "&zoom=16"
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
  const { googleMaps } = usePage<SharedPageProps>().props
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GoogleLocationResult[]>([])
  const [searching, setSearching] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<GoogleLocationResult | null>(null)
  const [resolving, setResolving] = React.useState(false)
  const searchAbortRef = React.useRef<AbortController | null>(null)
  const reverseAbortRef = React.useRef<AbortController | null>(null)

  function abortInFlight(): void {
    searchAbortRef.current?.abort()
    reverseAbortRef.current?.abort()
  }

  async function request(params: string, signal: AbortSignal): Promise<GoogleMapsResponse> {
    const response = await fetch(
      (googleMaps?.geocode_url ?? "/api/maps/geocode") + "?" + params,
      { headers: { Accept: "application/json" }, signal },
    )
    const payload = (await response.json()) as GoogleMapsResponse
    if (!response.ok && payload.state !== "unavailable") {
      throw new Error("maps request failed")
    }
    return payload
  }

  async function search(event: React.FormEvent) {
    event.preventDefault()
    const value = query.trim()
    if (value.length < 3) {
      setError("Ketik minimal 3 huruf untuk mencari lokasi.")
      return
    }

    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    setSearching(true)
    setError(null)
    try {
      const payload = await request("query=" + encodeURIComponent(value), controller.signal)
      const nextResults = payload.state === "ready" ? payload.results ?? [] : []
      setResults(nextResults)
      if (payload.state === "unavailable") {
        setError("Maps sedang tidak tersedia. Pilih desa/kelurahan dari daftar wilayah.")
      } else if (!nextResults.length) {
        setError("Lokasi tidak ditemukan. Coba kata kunci lain.")
      }
    } catch (requestError) {
      if ((requestError as Error)?.name !== "AbortError") {
        setError("Maps sedang tidak tersedia. Pilih desa/kelurahan dari daftar wilayah.")
        setResults([])
      }
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }

  async function pick(result: GoogleLocationResult) {
    reverseAbortRef.current?.abort()
    const controller = new AbortController()
    reverseAbortRef.current = controller
    setSelected(result)
    setResolving(true)
    setError(null)
    try {
      const payload = await request(
        "lat=" + encodeURIComponent(String(result.lat)) +
          "&lon=" + encodeURIComponent(String(result.lon)),
        controller.signal,
      )
      const resolved = payload.state === "ready" ? payload.results?.[0] : null
      if (!resolved) {
        setError("Detail lokasi dari Google Maps belum tersedia. Coba titik lain.")
        return
      }

      const province = matchOption(provinces, resolved.province)
      const regency = matchOption(regencies, resolved.city)
      const district = matchOption(districts, resolved.district)
      const village = matchOption(villages, resolved.village)
      onApply({
        display_name: resolved.display_name,
        lat: resolved.lat,
        lon: resolved.lon,
        // Postal codes come only from the validated desa/kelurahan dataset, never from Maps.
        postal_code: village?.postal_code ?? null,
        province: province?.name ?? resolved.province ?? undefined,
        city: regency?.name ?? resolved.city ?? undefined,
        district: district?.name ?? resolved.district ?? undefined,
        village: village?.name ?? resolved.village ?? undefined,
        province_id: province?.id,
        city_id: regency?.id,
        district_id: district?.id,
        village_id: village?.id,
      })
      setSelected(null)
      setQuery("")
      setResults([])
      onOpenChange(false)
    } catch (requestError) {
      if ((requestError as Error)?.name !== "AbortError") {
        setError("Detail lokasi dari Google Maps gagal diambil. Coba lagi.")
      }
    } finally {
      if (!controller.signal.aborted) setResolving(false)
    }
  }

  React.useEffect(() => {
    if (!open) {
      abortInFlight()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("")
      setResults([])
      setSelected(null)
      setError(null)
    }
    return () => abortInFlight()
  }, [open])

  const preview = selected ? embedUrl(selected.lat, selected.lon, googleMaps?.browser_key) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <div>
          <DialogTitle>Pilih lokasi di Google Maps</DialogTitle>
          <DialogDescription className="mt-2">
            Google Maps hanya membantu menemukan titik dan alamat (opsional). Kode pos selalu
            mengikuti desa/kelurahan dari dataset tervalidasi; peta bukan sumber kode pos.
          </DialogDescription>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama jalan, kecamatan, atau kotk§uçâçf"
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
              <li key={result.place_id ?? String(result.lat) + "-" + String(result.lon)}>
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
            {preview ? (
              <iframe
                title="Pratinjau Google Maps"
                src={preview}
                className="h-56 w-full rounded-lg border border-border"
                loading="lazy"
              />
            ) : (
              <a
                href={"https://www.google.com/maps/search/?api=1&query=" + selected.lat + "," + selected.lon}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-border bg-surface-muted p-4 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Buka titik ini di Google Maps
              </a>
            )}
            <p className="text-xs text-muted-foreground">{selected.display_name}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[11px] leading-4 text-muted-foreground">
            Jika Maps tidak tersedia, gunakan daftar desa/kelurahan. Jangan mengganti kode pos
            otomatis dengan data peta yang belum terverifikasi.
          </p>
          <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
