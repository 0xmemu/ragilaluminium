import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { ProductPicker, type PickerProduct } from "@/components/admin/ui/ProductPicker"
import { Sheet, SheetContent } from "@/components/admin/ui/sheet"

interface TargetDraft {
  target_type: "model" | "sub_model" | "product"
  target_id: string
  excluded: boolean
  override_discount_percent: string
}

interface Option {
  value: string
  label: string
  model?: string
}

interface PromotionFormData {
  id?: number
  type: string
  name: string
  discount_percent: number
  starts_at: string
  ends_at: string
  targets: TargetDraft[]
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function nowLocalInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function addHoursLocalInput(base: string | null | undefined, hours: number): string {
  const date = base ? new Date(base) : new Date()
  if (Number.isNaN(date.getTime())) return ""
  const target = new Date(date.getTime() + hours * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`
}

export default function PromotionForm({
  title,
  promotion,
  submitUrl,
  indexUrl,
  options,
  backUrl,
}: {
  backUrl?: string | null
  title: string
  promotion: PromotionFormData | null
  submitUrl: string
  indexUrl: string
  options: {
    type: string
    modelOptions: Array<{ value: string; label: string }>
    subModelOptions: Option[]
    productOptions: Option[]
  }
}) {
  const editing = Boolean(promotion?.id)
  const [periodMode, setPeriodMode] = React.useState<"now" | "scheduled" | "indefinite">(() => {
    if (!promotion?.id) {
      return "now"
    }
    if (!promotion.starts_at && !promotion.ends_at) {
      return "indefinite"
    }
    if (promotion.starts_at) {
      const startTime = new Date(promotion.starts_at).getTime()
      if (startTime <= Date.now() + 10 * 60 * 1000) {
        return "now"
      }
    }
    return "scheduled"
  })

  const form = useForm<PromotionFormData>({
    type: promotion?.type ?? options.type,
    name: promotion?.name ?? "",
    discount_percent: promotion?.discount_percent ?? 10,
    starts_at: promotion?.starts_at ? toLocalInput(promotion.starts_at) : nowLocalInput(),
    ends_at: promotion?.ends_at ? toLocalInput(promotion.ends_at) : addHoursLocalInput(nowLocalInput(), 24),
    targets: promotion?.targets?.map((target) => ({
      target_type: target.target_type,
      target_id: String(target.target_id),
      excluded: Boolean(target.excluded),
      override_discount_percent: target.override_discount_percent ? String(target.override_discount_percent) : "",
    })) ?? [],
  })
  const [excludeSearch, setExcludeSearch] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)


  const [pickerProducts, setPickerProducts] = React.useState<PickerProduct[]>(() =>
    options.productOptions
      .filter((option) => form.data.targets.some((t) => t.target_type === "product" && !t.excluded && t.target_id === option.value))
      .map((option) => ({
        id: Number(option.value),
        parent_sku: option.label.split(" (")[0] ?? "",
        name: option.label,
        category: "",
        model: "",
        sub_model: "",
        price: 0,
        dimensions: "",
      })),
  )

  function applyPickerSelection(products: PickerProduct[]) {
    setPickerProducts(products)
    const ids = new Set(products.map((product) => product.id))
    const kept = form.data.targets.filter((target) => target.target_type !== "product" || target.excluded || ids.has(Number(target.target_id)))
    const existingIds = new Set(form.data.targets.filter((t) => t.target_type === "product" && !t.excluded).map((t) => t.target_id))
    const added = products.filter((product) => !existingIds.has(String(product.id))).map((product) => ({
      target_type: "product" as const,
      target_id: String(product.id),
      excluded: false,
      override_discount_percent: "",
    }))
    form.setData("targets", [...kept, ...added])
  }

  function addTarget(target_type: TargetDraft["target_type"], value: string) {
    if (!value) return
    if (form.data.targets.some((t) => t.target_type === target_type && t.target_id === value && !t.excluded)) return
    form.setData("targets", [
      ...form.data.targets,
      { target_type, target_id: value, excluded: false, override_discount_percent: "" },
    ])
  }

  function addExcluded(value: string) {
    if (!value) return
    if (form.data.targets.some((t) => t.target_type === "product" && t.target_id === value && t.excluded)) return
    form.setData("targets", [
      ...form.data.targets,
      { target_type: "product", target_id: value, excluded: true, override_discount_percent: "" },
    ])
  }

  function removeTarget(index: number) {
    form.setData("targets", form.data.targets.filter((_, i) => i !== index))
  }


  async function submit(event: React.FormEvent) {
    event.preventDefault()
    let finalStartsAt = form.data.starts_at || null
    if (periodMode === "now") {
      finalStartsAt = form.data.starts_at || nowLocalInput()
    } else if (periodMode === "indefinite") {
      finalStartsAt = null
    }

    let finalEndsAt = form.data.ends_at || null
    if (periodMode === "indefinite") {
      finalEndsAt = null
    }

    const payload = {
      ...form.data,
      starts_at: finalStartsAt,
      ends_at: finalEndsAt,
    }
    if (editing) {
      form.put(submitUrl, { ...payload, onError: () => undefined } as never)
    } else {
      form.post(submitUrl, payload as never)
    }
  }

  const included = form.data.targets.filter((t) => !t.excluded)
  const excluded = form.data.targets.filter((t) => t.excluded)
  const filteredExclude = options.productOptions.filter((option) => option.label.toLowerCase().includes(excludeSearch.toLowerCase()))

  return (
    <AdminLayout
      title={title}
      backUrl={backUrl}
      description={editing ? "Perubahan berlaku setelah disimpan; kampanye draft baru dapat diaktifkan dari daftar." : "Kampanye dibuat sebagai draft, lalu diaktifkan dari daftar."}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" form="promotion-form" disabled={form.processing}>
            {form.processing ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan sebagai draft"}
          </Button>
        </div>
      }
    >
      <Head title={title} />
      <form id="promotion-form" onSubmit={submit} className="w-full space-y-5">
        <FormErrorSummary errors={form.errors} />

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Informasi kampanye</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="promotion-name" label="Nama kampanye" required error={form.errors.name} className="sm:col-span-2">
              <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value)} placeholder={form.data.type === "flash_sale" ? "contoh: Flash Sale 8.8" : "contoh: Promo Akhir Tahun"} />
            </Field>
            <Field id="promotion-discount" label="Diskon (%)" required error={form.errors.discount_percent}>
              <Input type="number" min="1" max="90" value={form.data.discount_percent} onChange={(event) => form.setData("discount_percent", Number(event.target.value))} />
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold">Waktu berlaku</h2>
              <p className="text-xs text-muted-foreground">
                Tentukan waktu mulai kampanye dan batas waktu berakhir.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPeriodMode("now")
                  const now = nowLocalInput()
                  form.setData("starts_at", now)
                  if (!form.data.ends_at || form.data.ends_at <= now) {
                    form.setData("ends_at", addHoursLocalInput(now, 24))
                  }
                }}
                className={`rounded px-2.5 py-1 transition-colors ${
                  periodMode === "now"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mulai Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodMode("scheduled")
                  if (!form.data.starts_at) {
                    form.setData("starts_at", nowLocalInput())
                  }
                }}
                className={`rounded px-2.5 py-1 transition-colors ${
                  periodMode === "scheduled"
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Jadwalkan Waktu
              </button>
              {form.data.type === "store" && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriodMode("indefinite")
                    form.setData("starts_at", "")
                    form.setData("ends_at", "")
                  }}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    periodMode === "indefinite"
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Tanpa Batas
                </button>
              )}
            </div>
          </div>

          {periodMode === "indefinite" ? (
            <div className="rounded-md border border-dashed border-border bg-surface/50 p-4 text-center text-xs text-muted-foreground">
              Promo Toko berlaku terus menerus tanpa batas waktu hingga dinonaktifkan secara manual dari daftar promo.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="promotion-starts" className="text-xs font-semibold">
                    Waktu Mulai
                  </label>
                  {periodMode === "now" && (
                    <button
                      type="button"
                      onClick={() => form.setData("starts_at", nowLocalInput())}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Update menit ini
                    </button>
                  )}
                </div>

                {periodMode === "now" ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold">Mulai Sekarang</span>
                        <span className="text-[11px] opacity-80">(Langsung Aktif)</span>
                      </div>
                      <span className="font-mono text-xs font-medium">
                        {form.data.starts_at ? form.data.starts_at.replace("T", " ") : nowLocalInput().replace("T", " ")}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Kampanye langsung aktif seketika setelah disimpan atau diaktifkan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Input
                      id="promotion-starts"
                      type="datetime-local"
                      value={form.data.starts_at}
                      onChange={(event) => form.setData("starts_at", event.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Kampanye akan berstatus Terjadwal dan otomatis aktif pada waktu di atas.
                    </p>
                  </div>
                )}
                {form.errors.starts_at && <p className="text-xs text-destructive">{form.errors.starts_at}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="promotion-ends" className="text-xs font-semibold">
                    Waktu Selesai (Kustom)
                  </label>
                  <span className="text-[10px] text-muted-foreground">Pilih bebas tanggal dan jam</span>
                </div>

                <Input
                  id="promotion-ends"
                  type="datetime-local"
                  value={form.data.ends_at}
                  onChange={(event) => form.setData("ends_at", event.target.value)}
                  placeholder="Pilih tanggal dan jam selesai kustom"
                />

                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-muted-foreground">Preset cepat:</span>
                  {[
                    { label: "+2 Jam", hours: 2 },
                    { label: "+6 Jam", hours: 6 },
                    { label: "+12 Jam", hours: 12 },
                    { label: "+24 Jam", hours: 24 },
                    { label: "+3 Hari", hours: 72 },
                    { label: "+7 Hari", hours: 168 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        const base = (periodMode === "now" ? nowLocalInput() : form.data.starts_at) || nowLocalInput()
                        form.setData("ends_at", addHoursLocalInput(base, preset.hours))
                      }}
                      className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {form.data.ends_at && (
                    <button
                      type="button"
                      onClick={() => form.setData("ends_at", "")}
                      className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {form.errors.ends_at && <p className="text-xs text-destructive">{form.errors.ends_at}</p>}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {form.data.type === "flash_sale"
              ? "Flash Sale membutuhkan tanggal dan jam berakhir. Kampanye otomatis selesai saat waktu habis."
              : "Kosongkan periode jika ingin promo toko berjalan terus sampai dihentikan manual."}
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Target produk</h2>
          <p className="text-sm text-muted-foreground">
            Pilih model, sub model, atau produk tertentu. Produk yang dikecualikan tidak kena diskon meski masuk target model/sub model.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="promotion-model" label="Seluruh produk model">
              <Select value="" onChange={(event) => addTarget("model", event.target.value)}>
                <option value="">Pilih model</option>
                {options.modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field id="promotion-submodel" label="Sub model">
              <Select value="" onChange={(event) => addTarget("sub_model", event.target.value)}>
                <option value="">Pilih sub model</option>
                {options.subModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="promotion-product" label="Produk tertentu">
              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} className="w-full sm:w-auto">
                  <Icon name="package" className="mr-2 size-4" aria-hidden="true" />
                  {pickerProducts.length > 0 ? `Ubah pilihan (${pickerProducts.length} produk)` : "Pilih Produk"}
                </Button>
                {pickerProducts.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pickerProducts.slice(0, 12).map((product) => (
                      <span key={product.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground">
                        <span className="truncate">{product.name}</span>
                      </span>
                    ))}
                    {pickerProducts.length > 12 ? (
                      <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground">
                        +{pickerProducts.length - 12} lainnya
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Field>
            <Field id="promotion-exclude" label="Kecualikan produk">
              <Input value={excludeSearch} onChange={(event) => setExcludeSearch(event.target.value)} placeholder="Cari nama/SKU…" />
              {excludeSearch.trim() ? (
                <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-surface">
                  {filteredExclude.slice(0, 50).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        addExcluded(option.value)
                        setExcludeSearch("")
                      }}
                      className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60"
                    >
                      <span className="min-w-0">{option.label}</span>
                      <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Kecualikan</span>
                    </button>
                  ))}
                  {filteredExclude.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Tidak ada produk yang cocok.</p>
                  ) : null}
                </div>
              ) : null}
              <Select value="" onChange={(event) => addExcluded(event.target.value)}>
                <option value="">Pilih produk</option>
                {filteredExclude.slice(0, 50).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="space-y-2">
            {included.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada target dipilih.</p>
            ) : (
              included.map((target, index) => {
                const option = [...options.modelOptions, ...options.subModelOptions, ...options.productOptions].find((o) => o.value === target.target_id)
                const typeLabel = target.target_type === "model" ? "Model" : target.target_type === "sub_model" ? "Sub Model" : "Produk"
                return (
                  <div key={`${target.target_type}-${target.target_id}`} className="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                    <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {typeLabel}
                    </span>
                    <span className="flex-1 truncate font-medium text-foreground">
                      {option?.label ?? target.target_id}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-primary">
                      Diskon {form.data.discount_percent || 0}%
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-destructive transition hover:underline"
                      onClick={() => removeTarget(index)}
                    >
                      Hapus
                    </button>
                  </div>
                )
              })
            )}
            {excluded.map((target, index) => {
              const option = options.productOptions.find((o) => o.value === target.target_id)
              return (
                <div key={`excluded-${target.target_id}`} className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <span className="flex-1 truncate line-through text-destructive">{option?.label ?? target.target_id}</span>
                  <button type="button" className="shrink-0 text-destructive" onClick={() => removeTarget(index + included.length)}>
                    Hapus
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        
            <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold">Pilih Produk untuk Promo</h2>
            <p className="text-sm text-muted-foreground">Cari, filter, lalu centang produk. Maksimal 100 produk per promo.</p>
          </div>
          <div className="mt-4 space-y-4">
            <ProductPicker
              endpoint="/admin/promotions/products"
              maxSelection={100}
              initialSelection={pickerProducts}
              onSelect={applyPickerSelection}
            />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={() => setPickerOpen(false)}>
                Selesai ({pickerProducts.length} produk)
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </form>
    </AdminLayout>
  )
}
