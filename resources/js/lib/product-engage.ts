/**
 * Catat klik kartu produk (fire-and-forget) sebelum navigasi ke PDP.
 */
export function trackProductClick(productId: number, csrfToken: string): void {
  if (!productId || !csrfToken || typeof fetch !== "function") {
    return
  }

  void fetch(`/product/${productId}/engage`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": csrfToken,
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({ action: "click" }),
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    // Metrics must not block UX.
  })
}
