import * as React from "react"

export const SEARCH_PLACEHOLDER_ROTATIONS = [
  "cari: jendela sliding / 120x80...",
  "jendela jungkit...",
  "100x50...",
  "boven zigzag...",
  "pintu sliding...",
  "120x80...",
  "kaca mati...",
  "warna hitam...",
] as const

/**
 * Rotating search-bar placeholder.
 * Pauses when `paused` is true or when prefers-reduced-motion is set.
 */
export function useRotatingPlaceholder(
  paused = false,
  phrases: readonly string[] = SEARCH_PLACEHOLDER_ROTATIONS,
  intervalMs = 2800,
): string {
  const [index, setIndex] = React.useState(0)
  const [reduceMotion, setReduceMotion] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  React.useEffect(() => {
    if (paused || reduceMotion || phrases.length <= 1) return

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % phrases.length)
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [paused, reduceMotion, phrases, intervalMs])

  return phrases[index] ?? "cari produk..."
}
