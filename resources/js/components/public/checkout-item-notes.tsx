import { usePage } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"

export interface CheckoutNoteItem {
  line_id: string
  name: string
  quantity: number
  unit_price?: number
  line_total?: number
  image?: string | null
  variation_1_name?: string | null
  variation_1_option?: string | null
  variation_2_name?: string | null
  variation_2_option?: string | null
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
  const [showNoteInput, setShowNoteInput] = React.useState(Boolean(item.note))
  const timer = React.useRef<number | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    setValue(item.note ?? "")
    if (item.note) setShowNoteInput(true)
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

  const variantLabel = [item.variation_1_option, item.variation_2_option].filter(Boolean).join(" • ")

  return (
    <div className="py-3.5 space-y-2.5">
      <div className="flex gap-3 items-start">
        <div className="size-16 sm:size-18 shrink-0 overflow-hidden rounded-md border border-border/80 bg-surface-muted">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Icon name="image" className="size-6 opacity-40" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold text-foreground leading-snug sm:text-sm">
            {item.name}
          </p>
          {variantLabel ? (
            <p className="text-xs text-muted-foreground">{variantLabel}</p>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="tabular-nums text-xs font-bold text-primary sm:text-sm">
              {formatCurrency(item.unit_price ?? item.line_total ?? 0)}
            </span>
            <span className="text-xs text-muted-foreground">{item.quantity} pcs</span>
          </div>
        </div>
      </div>

      {!showNoteInput && !value ? (
        <div className="pl-[4.75rem]">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            onClick={() => setShowNoteInput(true)}
          >
            <Icon name="pen-line" className="size-3" aria-hidden="true" />
            Tulis catatan
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-muted/50 px-2.5 py-1.5 focus-within:border-primary/60 focus-within:bg-surface">
          <Icon name="pen-line" className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            id={`checkout-note-${item.line_id}`}
            type="text"
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            value={value}
            onChange={(event) => update(event.target.value)}
            placeholder="Catatan untuk produk ini (opsional)"
            maxLength={2000}
          />
          {saving ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">Menyimpan...</span>
          ) : error ? (
            <span className="shrink-0 text-[10px] text-destructive">{error}</span>
          ) : null}
        </div>
      )}
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
    <section className="surface-panel min-w-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-bold text-foreground">Daftar Pesanan</h2>
          <span className="text-xs text-muted-foreground">({items.length} item)</span>
        </div>
      </div>
      <div className="divide-y divide-border/60">
        {items.map((item) => (
          <CheckoutItemNoteRow key={item.line_id} item={item} onChange={onChange} />
        ))}
      </div>
    </section>
  )
}
