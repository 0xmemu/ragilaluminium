import * as React from "react"

/**
 * Lebar viewport saat ini.
 *
 * Dipakai halaman katalog untuk menentukan jumlah kartu per halaman: server
 * tidak bisa tahu lebar layar, jadi klien yang mengirim `per_page`.
 *
 * Nilai awal 0 bermakna "belum terukur", dan `resolveCatalogPageSize` memetakan
 * 0 ke ukuran desktop. Dengan begitu render pertama di klien selalu memakai
 * ukuran yang sama dengan yang sudah dikirim server (desktop), sehingga tidak
 * ada permintaan ulang yang tidak perlu sebelum lebar benar-benar terbaca.
 */
export function useCatalogViewportWidth(): number {
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    const sync = () => setWidth(window.innerWidth)

    sync()
    window.addEventListener("resize", sync)

    return () => window.removeEventListener("resize", sync)
  }, [])

  return width
}
