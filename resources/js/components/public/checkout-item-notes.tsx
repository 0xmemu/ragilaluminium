import { usePage } from "@inertiajs/react"
import * as React from "react"

import { Textarea } from "@/components/ui/textarea"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

export interface CheckoutNoteItem {
  line_id: string
  name: string
  quantity: number
  note?: string | null
}

function CheckoutItemNoteRow({
  item,
  onChange,
}: {
  item: CheckoutNoteItem
  onChange: (lineId: string, note: string) => void
}) {
  const page = usePage<SharedPageProps>()
  const [value, setValue] = React.useState(item.note ?? "")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const timer = React.useRef<number | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(item.note ?? "")
  }, [item.note])

  React.useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    abortRef.current?.abort()
  }, [])

  function save(next: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSaving(true)
    fetch(routeUrl("cart.update"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": page.props.csrf,
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify({
        line_id: item.line_id,
        quantity: item.quantity,
        note: next.trim(),
      }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("save failed")
        onChange(item.line_id, next.trim())
        setError(null)
      })
      .catch((reason: unknown) => {
        if ((reason as Error)?.name !== "AbortError") setError("Catatan gagal disimpan. Coba lagi.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setSaving(false)
      })
  }

  function update(next: string) {
    setValue(next)
    setError(null)
    onChange(item.line_id, next)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      save(next)
    }, 450)
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={`checkout-note-${item.line_id}`} className="min-w-0 truncate text-sm font-semibold">
          {item.name}
        </label>
        <span className="shrink-0 text-xs text-muted-foreground">{item.quantity} item</span>
      </div>
      <Textarea
        id={`checkout-note-${item.line_id}`}
        className="mt-2 min-h-20 text-sm"
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder="Catatan untuk produk ini (opsional)"
        maxLength={2000}
      />
      <div className="mt-1 flex min-h-4 justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{saving ? "Menyimpan..." : error ?? "Catatan akan ikut pesanan ini."}</span>
        <span>{value.length}/2000</span>
      </div>
    </div>
  )
}

export function CheckoutItemNotes({
  items,
  onChange,
}: {
  items: CheckoutNoteItem[]
  onChange: (lineId: string, note: string) => void
}) {
  return (
    <section className="surface-panel min-w-0 p-5 sm:p-7">
      <div>
        <p className="font-mono text-xs font-semibold text-primary">01</p>
        <h2 className="mt-2 text-lg font-semibold">Produk yang akan di-checkout</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Produk yang dipilih akan masuk ke pesanan ini. Tambahkan catatan per produk sebelum mengisi alamat pengiriman.
        </p>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <CheckoutItemNoteRow key={item.line_id} item={item} onChange={onChange} />
        ))}
      </div>
    </section>
  )
}
