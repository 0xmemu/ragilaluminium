import * as React from "react"

/**
 * Drag & drop baris tabel untuk mode urut admin (HTML5 DnD, tanpa
 * dependensi). Aktif hanya bila `enabled` (mode geser), sehingga di luar
 * mode urut seleksi teks dan klik tidak terganggu. Ia tidak mengubah
 * urutan sendiri: panggil `onReorder(from, to)` untuk memindahkan baris,
 * lalu styling baris aktif memakai `draggingIndex`/`targetIndex`.
 */
export function useRowDragSort({
  enabled,
  count,
  onReorder,
}: {
  enabled: boolean
  count: number
  onReorder: (from: number, to: number) => void
}) {
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
  const [targetIndex, setTargetIndex] = React.useState<number | null>(null)
  const dragIndexRef = React.useRef<number | null>(null)

  const reset = React.useCallback(() => {
    setDraggingIndex(null)
    setTargetIndex(null)
  }, [])

  const rowProps = React.useCallback(
    (index: number) => {
      if (!enabled) return {}
      return {
        draggable: true,
        onDragStart: (event: React.DragEvent) => {
          dragIndexRef.current = index
          setDraggingIndex(index)
          event.dataTransfer.effectAllowed = "move"
          event.dataTransfer.setData("text/plain", String(index))
        },
        onDragOver: (event: React.DragEvent) => {
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
          setTargetIndex(index)
        },
        onDrop: (event: React.DragEvent) => {
          event.preventDefault()
          const from = dragIndexRef.current
          reset()
          if (from === null || from === index || from < 0 || index < 0) return
          if (from >= count || index >= count) return
          onReorder(from, index)
        },
        onDragEnd: reset,
      }
    },
    [enabled, count, onReorder, reset],
  )

  return { rowProps, draggingIndex, targetIndex }
}
