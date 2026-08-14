/** Fokus ke input pencarian header (navbar) dari elemen mana pun.
 *  Header punya dua instance form pencarian (mobile & desktop); hanya satu
 *  yang visible per breakpoint, jadi cari yang sedang tampil lalu fokus.
 *  Dipakai mis. oleh ikon cari di baris judul halaman. */
export function focusSiteSearch(): void {
  const candidates = document.querySelectorAll<HTMLInputElement>("input[data-site-search]")
  const visible = [...candidates].find((el) => el.offsetParent !== null) ?? candidates[0]
  if (!visible) return
  visible.focus()
  visible.scrollIntoView({ behavior: "smooth", block: "nearest" })
}
