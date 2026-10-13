export type BreadcrumbBackItem = { label: string; href?: string | null }

/**
 * Tujuan cadangan untuk tombol kembali di breadcrumb.
 *
 * Dipakai saat riwayat browser tidak bisa diandalkan. `window.history.length`
 * TIDAK bisa dipercaya untuk menjawab "bisa kembali atau tidak": membuka tab
 * baru, mengetik alamat langsung, atau datang dari browser dalam aplikasi
 * (Instagram, TikTok, Facebook) bisa melaporkan 1 walau pembeli sebenarnya
 * datang dari halaman lain. Beberapa browser juga membatasi nilai itu demi
 * privasi, sehingga hasilnya berbeda antar browser.
 *
 * Karena itu tombol kembali selalu ditampilkan, dan saat riwayat kosong ia
 * mengarah ke href induk terdekat dari breadcrumb (mis. halaman model sebelum
 * halaman produk), lalu ke beranda bila breadcrumb hanya berisi satu item.
 *
 * Item terakhir adalah halaman yang sedang dibuka, jadi hrefnya dilewati:
 * menuju ke sana hanya memuat ulang halaman yang sama.
 */
export function backFallbackHref(
  items: BreadcrumbBackItem[],
  homeHref: string,
): string {
  for (let index = items.length - 2; index >= 0; index -= 1) {
    const href = items[index]?.href
    if (href) return href
  }

  return homeHref
}

/** Apakah tombol kembali boleh memakai riwayat browser. */
export function shouldUseHistoryBack(historyLength: number): boolean {
  return Number.isFinite(historyLength) && historyLength > 1
}
