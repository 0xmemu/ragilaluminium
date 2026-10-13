/**
 * Kunci pembanding data ulasan untuk form ulasan pelanggan.
 *
 * Halaman lacak pesanan memperbarui data tiap 10 detik selama status pesanan
 * belum final (delivered belum termasuk final). Tiap pembaruan menghasilkan
 * objek `reviews` BARU, dan identitas objek itu saja sudah cukup memicu efek
 * penyelarasan di form. Akibatnya isian pembeli (bintang, teks, media yang
 * baru diunggah) terhapus sendiri tiap beberapa detik, seolah halaman dimuat
 * ulang, padahal datanya tidak berubah sama sekali.
 *
 * Kunci ini merangkum ISI data, bukan identitasnya. Efek penyelarasan cukup
 * dijalankan saat kuncinya berubah, yaitu saat benar-benar ada data baru
 * (mis. ulasan baru masuk atau status moderasinya berubah).
 */

/** Bentuk minimal yang dibutuhkan, sengaja tidak terikat tipe halaman. */
interface SyncableReview {
  id: number
  rating?: number | null
  message?: string | null
  moderation_status?: string | null
  media_items?: Array<{ url?: string | null }> | null
}

export function reviewSyncKey(
  reviews: SyncableReview[] | undefined,
  productIds: Array<number | string>,
  orderNumber: string,
): string {
  const reviewPart = (reviews ?? [])
    .map((review) => [
      review.id,
      review.rating ?? "",
      review.moderation_status ?? "",
      review.message ?? "",
      (review.media_items ?? []).map((item) => item.url ?? "").join(" "),
    ].join("~"))
    .join("|")

  return [orderNumber, productIds.join(","), reviewPart].join("||")
}
