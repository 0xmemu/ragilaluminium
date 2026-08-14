// Suara notifikasi + badge counter "media siap" untuk polling upload media.
// Dipakai bersama oleh halaman media produk & Media Library; badge counter
// dibaca oleh AdminNavigation (sidebar) lewat event bus + sessionStorage.

const STORAGE_KEY = "ragil.media.readyCount"
const READY_EVENT = "ragil:media-ready"

let audioCtx: AudioContext | null = null

/** Chime dua nada (A5 -> D6) via Web Audio — tanpa file aset. */
export function playReadySound(): void {
  try {
    if (typeof window === "undefined") return
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!audioCtx) audioCtx = new Ctx()
    if (audioCtx.state === "suspended") void audioCtx.resume()
    const now = audioCtx.currentTime
    const notes = [880, 1174.66] // A5, D6
    notes.forEach((freq, index) => {
      const osc = audioCtx!.createOscillator()
      const gain = audioCtx!.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      const t = now + index * 0.12
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.connect(gain)
      gain.connect(audioCtx!.destination)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // Audio diblokir autoplay/kebijakan browser — abaikan, badge tetap jalan.
  }
}

export function getReadyCount(): number {
  if (typeof window === "undefined") return 0
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Tambah ke counter "media siap" dan beri tahu sidebar (event bus). */
export function addReadyCount(amount: number): void {
  if (typeof window === "undefined" || amount <= 0) return
  const next = getReadyCount() + amount
  window.sessionStorage.setItem(STORAGE_KEY, String(next))
  window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: next }))
}

export function clearReadyCount(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(READY_EVENT, { detail: 0 }))
}

/** Subscribe perubahan counter; balikan fungsi cleanup. */
export function onReadyCountChange(callback: (count: number) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = () => callback(getReadyCount())
  window.addEventListener(READY_EVENT, handler)
  return () => window.removeEventListener(READY_EVENT, handler)
}
