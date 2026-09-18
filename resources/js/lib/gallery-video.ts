/**
 * Kapan video galeri produk boleh berputar.
 *
 * Video boleh berputar HANYA bila keempat syarat terpenuhi sekaligus:
 *   1. slide video memang sedang aktif ditampilkan,
 *   2. galeri produk sedang terlihat di layar (tidak tergulir keluar),
 *   3. mode preview (lightbox) tidak sedang dibuka,
 *   4. tab atau jendela pembeli sedang aktif.
 *
 * Syarat 2 sampai 4 mencegah video berjalan terus di latar belakang saat
 * pembeli menggulir halaman, membuka preview foto lain, atau pindah tab.
 * Kontrak owner 2026-09-18: autoplay boleh, tetapi jangan berputar saat video
 * tidak terlihat.
 */
export function shouldPlayGalleryVideo({
  isActive,
  galleryInView,
  isPreviewOpen,
  pageVisible,
}: {
  isActive: boolean
  galleryInView: boolean
  isPreviewOpen: boolean
  pageVisible: boolean
}): boolean {
  return isActive && galleryInView && !isPreviewOpen && pageVisible
}

/**
 * Kapan video di lightbox (mode preview) boleh berputar.
 * Hanya saat slide video di preview sedang aktif. Video wajib diam ketika
 * pembeli sedang melihat foto di lightbox yang sama.
 */
export function shouldPlayPreviewVideo(isActive: boolean): boolean {
  return isActive
}
