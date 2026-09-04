import { Head, Link, router, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { formatCurrency } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { SelectOption } from "@/types"

interface VariantDraft {
  variation_1_name: string
  variation_1_option: string
  variation_2_name: string
  variation_2_option: string
  variation_3_name: string
  variation_3_option: string
  variation_4_name: string
  variation_4_option: string
  variation_5_name: string
  variation_5_option: string
  price: string
  promo_price: string
  stock?: string | number
  weight_kg: string
  width_cm: string
  height_cm: string
  depth_cm: string
  status: string
}

interface VariantRecord extends VariantDraft {
  id: number
  variant_sku: string
}

interface ProductFormData {
  workflow: "wizard"
  wizard_step: WizardStep
  name: string
  short_name: string
  description: string
  product_category: string
  product_model: string
  design_variant: string
  status: string
  media_asset_ids?: number[]
  weight_kg?: string
  width_cm?: string
  height_cm?: string
  depth_cm?: string
}

interface ProductRecord extends Omit<ProductFormData, "workflow" | "wizard_step"> {
  id: number
  parent_sku: string
  media?: Array<{ media_asset_id: number; media_asset_label?: string | null; url?: string | null }>
}

type WizardStep = "identity" | "variants" | "media" | "review" | null

type VariationOption = { value: string; media_asset_id?: number | null; thumb_url?: string | null }
type VariantDef = { name: string; options: VariationOption[] }

const emptyOption = (): VariationOption => ({ value: "" })
type Combination = { options: string[]; price: string; stock: string }

/** Produk kartesian dari definisi varian: [Warna(Hitam,Putih) x Kaca(Bening,Es)] -> 4 kombinasi. */
function buildCombinations(defs: VariantDef[]): Array<{ options: string[]; label: string }> {
  if (!defs.length || defs.some((d) => !d.options.length)) return []
  // Opsi boleh masih kosong (baru diketik); kombinasi tetap dihitung.
  let combos: Array<{ options: string[]; label: string }> = [{ options: [], label: "" }]
  for (const def of defs) {
    const next: Array<{ options: string[]; label: string }> = []
    for (const combo of combos) {
      for (const option of def.options) {
        const value = option.value
        next.push({ options: [...combo.options, value], label: (combo.label ? combo.label + " / " : "") + value })
      }
    }
    combos = next
  }
  return combos
}

export default function ProductForm({
  product,
  variant_defs: incomingVariantDefs,
  variants: incomingVariants,
  submitUrl,
  publishUrl,
  options,
}: {
  backUrl?: string | null
  product: ProductRecord | null
  /** Definisi varian dari controller (hasil reconstruct import). */
  "variant_defs"?: Array<{ name: string; options: Array<{ value: string; media_asset_id?: number | null; thumb_url?: string | null }> }>
  /** Daftar varian eksisting (SKU, opsi, harga, stok). */
  "variants"?: Array<{ id: number; variant_sku: string; variation_1_name: string | null; variation_1_option: string | null; variation_2_name: string | null; variation_2_option: string | null; price: number; stock: number; status: string }>
  submitUrl: string
  publishUrl?: string
  options: {
    categories: SelectOption[]
    models: SelectOption[]
    designs: Array<SelectOption & { model: string }>
    statuses: SelectOption[]
  }
}) {
  const editing = Boolean(product)
  const form = useForm<ProductFormData>({
    workflow: "wizard",
    wizard_step: null,
    name: product?.name ?? "",
    short_name: product?.short_name ?? "",
    description: product?.description ?? "",
    product_category: product?.product_category ?? options.categories[0]?.value ?? "JENDELA",
    product_model: product?.product_model ?? options.models[0]?.value ?? "SLIDING",
    design_variant: product?.design_variant ?? options.designs[0]?.value ?? "POLOS",
    status: product?.status ?? "archived",
    weight_kg: (product as unknown as Record<string, unknown> & { weight_kg?: string })?.weight_kg as string ?? "",
    width_cm: (product as unknown as Record<string, unknown> & { width_cm?: string })?.width_cm as string ?? "",
    height_cm: (product as unknown as Record<string, unknown> & { height_cm?: string })?.height_cm as string ?? "",
    depth_cm: (product as unknown as Record<string, unknown> & { depth_cm?: string })?.depth_cm as string ?? "",
  })

  // ADR-021: media dipilih/diunggah langsung di form (upload atau Media Library),
  // dikirim bersama submit sebagai media_asset_ids. Foto pertama = gambar utama.
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pickedMedia, setPickedMedia] = React.useState<PickedMedia[]>([])
  const [optionPicker, setOptionPicker] = React.useState<{ defIndex: number; optionIndex: number } | null>(null)
  const [dragMediaIndex, setDragMediaIndex] = React.useState<number | null>(null)
  const reorderMedia = (from: number, to: number) => {
    if (from === to) return
    setPickedMedia((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  React.useEffect(() => {
    if (!editing) return
    // Kontrak props terkini: variant_defs & variants dikirim sebagai props
    // terpisah dari controller (bukan di dalam product).
    const raw = (incomingVariantDefs && incomingVariantDefs.length)
      ? incomingVariantDefs
      : (product as unknown as { variant_defs?: Array<{ name?: string; options?: Array<{ value?: string; media_asset_id?: number | null; thumb_url?: string | null }> }> } | null)?.variant_defs
    if (raw && raw.length) {
      setVariantDefs(raw.map((def) => ({
        name: def.name ?? "",
        options: (def.options ?? []).map((option) => ({
          value: option.value ?? "",
          media_asset_id: option.media_asset_id ?? null,
          thumb_url: option.thumb_url ?? null,
        })),
      })))
    }
  }, [editing])
  React.useEffect(() => {
    if (!editing || !product?.media) return
    setPickedMedia(product.media.map((m) => ({
      assetId: m.media_asset_id,
      label: m.media_asset_label ?? "",
      thumbUrl: m.url ?? "",
      kind: "image" as const,
    })))
  }, [editing])

  // ADR-021: definisi varian (nama bebas + opsi) diisi admin;
  // harga & stok diisi per kombinasi setelah definisi selesai.
  const [variantDefs, setVariantDefs] = React.useState<VariantDef[]>([])
  const [combinations, setCombinations] = React.useState<Record<string, { price: string; stock: string }>>({})

  const combos = buildCombinations(variantDefs)

  // Prefill harga & stok dari varian eksisting (hasil import) berdasarkan
  // pasangan opsi, sehingga step review menampilkan nilai tersimpan.
  React.useEffect(() => {
    if (!editing || !incomingVariants?.length || combos.length === 0) return
    setCombinations((prev) => {
      if (Object.keys(prev).length > 0) return prev
      const next: Record<string, { price: string; stock: string }> = {}
      const byOptionSet = new Map<string, { price: number; stock: number }>()
      for (const v of incomingVariants) {
        const pair = [v.variation_1_option, v.variation_2_option]
          .map((x) => (x ?? "").trim().toLowerCase())
          .filter(Boolean)
          .sort()
          .join("|")
        byOptionSet.set(pair, { price: v.price, stock: v.stock })
      }
      combos.forEach((combo, index) => {
        const pair = [...combo.options].map((x) => x.trim().toLowerCase()).sort().join("|")
        const hit = byOptionSet.get(pair)
        if (hit) {
          next[String(index)] = { price: String(hit.price), stock: String(hit.stock) }
        }
      })
      return next
    })
  }, [editing, incomingVariants, combos.length])

  const combinationKey = (options: string[]) => options.join("|")
  // Ketikan opsi mengubah key teks; simpan nilai harga/stok per INDEX kombinasi agar tidak hilang saat mengetik.



  const [saving, setSaving] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const publishForm = useForm({})

  React.useEffect(() => {
    if (!form.isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [form.isDirty])

  function buildPayload(status: "active" | "archived") {
    return {
      ...form.data,
      status,
      media_asset_ids: pickedMedia.map((m) => m.assetId),
      variant_defs: variantDefs.map((def) => ({
        name: def.name,
        options: def.options.map((option) => ({
          value: option.value,
          media_asset_id: option.media_asset_id ?? null,
        })),
      })),
      combinations: combos.map((combo, comboIndex) => ({
        options: combo.options,
        price: combinations[String(comboIndex)]?.price ?? "",
        stock: combinations[String(comboIndex)]?.stock ?? "",
      })),
    }
  }

  // Status produk saat ini: Simpan mempertahankannya (tidak dipaksa arsip).
  const preserveStatus: "active" | "archived" = (product?.status === "active") ? "active" : "archived"
  const isActive = product?.status === "active"

  function submit(status: "active" | "archived", event: React.FormEvent, addAnother = false) {
    event.preventDefault()
    setSaving(true)
    const payload = buildPayload(status)
    // ADR-021: create = POST store; edit = PUT update (405 kalau POST).
    const options = {
      onSuccess: () => {
        if (addAnother) {
          router.visit(routeUrl("admin.products.create"))
        }
      },
      onFinish: () => setSaving(false),
    }
    if (editing) {
      router.put(submitUrl, payload, options)
    } else {
      router.post(submitUrl, payload, options)
    }
  }

  // Enter di kolom varian tidak meng-submit form (pemicu 405 lama).
  const blockEnter = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") event.preventDefault()
  }

  function publish(event: React.FormEvent) {
    event.preventDefault()
    if (!publishUrl) return
    setPublishing(true)
    publishForm.post(publishUrl, { onFinish: () => setPublishing(false) })
  }

  return (
    <AdminLayout
      backUrl={routeUrl("admin.products.index")}
      title={editing ? "Edit produk" : "Tambah produk"}
      description={editing ? `Lengkapi ${product?.parent_sku}. Semua tahap di satu halaman.` : "Isi dari atas ke bawah, lalu simpan. Semua tahap di satu halaman."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" form="product-edit-form" variant="secondary" disabled={saving}>
            {saving ? "Menyimpan..." : (isActive ? "Simpan" : "Simpan draf")}
          </Button>
          {publishUrl && !isActive ? (
            <Button type="button" disabled={publishing} onClick={publish}>
              {publishing ? "Mempublikasikan..." : "Aktifkan produk"}
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Produk | Admin`} />

      <div className="mx-auto max-w-6xl space-y-6">
        <FormErrorSummary errors={form.errors} />
        <FormErrorSummary errors={publishForm.errors} />

        <form id="product-edit-form" onSubmit={(event) => submit(preserveStatus, event)} className="space-y-6">
          {/* 1. IDENTITAS + TAKSONOMI + DIMENSI J&T */}
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Identitas produk</h2>
                <p className="mt-1 text-sm text-muted-foreground">Informasi yang dipakai admin dan katalog publik.</p>
              </div>
              {product ? <StatusBadge status={product.status} /> : <StatusBadge status="archived" label="Draf baru" />}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field id="product-parent-sku" label="Parent SKU">
                <Input value={product?.parent_sku ?? "(otomatis saat disimpan)"} readOnly disabled className="font-mono" />
              </Field>
              <Field id="product-name" label="Nama produk" required error={form.errors.name}>
                <Input value={form.data.name} onChange={(event) => form.setData("name", event.target.value as never)} />
              </Field>
              <Field id="product-description" label="Deskripsi" error={form.errors.description} className="sm:col-span-2">
                <Textarea rows={5} value={form.data.description} onChange={(event) => form.setData("description", event.target.value as never)} />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field id="product-category" label="Kategori" required error={form.errors.product_category}>
                <Select value={form.data.product_category} onChange={(event) => form.setData("product_category", event.target.value as never)}>
                  {options.categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <Field id="product-model" label="Model" required error={form.errors.product_model}>
                <Select value={form.data.product_model} onChange={(event) => form.setData("product_model", event.target.value as never)}>
                  {options.models.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
              <Field id="product-design" label="Sub Model" error={form.errors.design_variant}>
                <Select value={form.data.design_variant} onChange={(event) => form.setData("design_variant", event.target.value as never)}>
                  <option value="">Tanpa sub model</option>
                  {options.designs
                    .filter((option) => option.model === form.data.product_model)
                    .map((option) => (
                      <option key={option.model + ":" + option.value} value={option.value}>{option.label}</option>
                    ))}
                </Select>
              </Field>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">Pengiriman (J&amp;T Cargo)</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Berat dan dimensi paket milik produk, bukan per varian. Dipakai untuk ongkir &amp; kubikasi.</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-4">
                <Field id="product-weight" label="Berat (kg)" required error={form.errors.weight_kg}>
                  <Input type="number" min="0" step="0.01" value={form.data.weight_kg ?? ""} onChange={(event) => form.setData("weight_kg", event.target.value as never)} />
                </Field>
                <Field id="product-height" label="Tinggi (cm)" required error={form.errors.height_cm}>
                  <Input type="number" min="0" step="0.1" value={form.data.height_cm ?? ""} onChange={(event) => form.setData("height_cm", event.target.value as never)} />
                </Field>
                <Field id="product-width" label="Panjang (cm)" required error={form.errors.width_cm}>
                  <Input type="number" min="0" step="0.1" value={form.data.width_cm ?? ""} onChange={(event) => form.setData("width_cm", event.target.value as never)} />
                </Field>
                <Field id="product-depth" label="Lebar (cm)" required error={form.errors.depth_cm}>
                  <Input type="number" min="0" step="0.1" value={form.data.depth_cm ?? ""} onChange={(event) => form.setData("depth_cm", event.target.value as never)} />
                </Field>
              </div>
            </div>
          </section>

          {/* 2. VARIAN: nama bebas + opsi; lalu matriks harga & stok per kombinasi */}
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Varian</h2>
                <p className="mt-1 text-sm text-muted-foreground">Beri nama varian (mis. Warna, Kaca), lalu isi opsinya. Harga &amp; stok diisi setelah ini, per kombinasi.</p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {variantDefs.map((def, defIndex) => (
                <div key={defIndex} className="rounded-lg border border-border bg-surface-muted/40 p-4">
                  <div className="flex items-center gap-2">
                    <Field id={`variant-def-name-${defIndex}`} label="Nama varian" className="w-44 shrink-0">
                      <Input
                        value={def.name}
                        onChange={(event) => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, name: event.target.value } : d)))}
                        onKeyDown={blockEnter}
                        placeholder="Mis. Warna"
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-4"
                      onClick={() => setVariantDefs((prev) => prev.filter((_, i) => i !== defIndex))}
                    >
                      Hapus varian
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {def.options.map((option, optionIndex) => (
                      <span key={optionIndex} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setOptionPicker({ defIndex, optionIndex })}
                          className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted"
                          aria-label={`Gambar untuk ${option.value || "opsi " + (optionIndex + 1)}`}
                          title="Pilih gambar opsi"
                        >
                          {option.thumb_url ? (
                            <img src={option.thumb_url} alt="" className="size-full object-cover" />
                          ) : (
                            <svg className="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          )}
                        </button>
                        <input
                          value={option.value}
                          onChange={(event) => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.map((o, oi) => (oi === optionIndex ? { ...o, value: event.target.value } : o)) } : d)))}
                          onKeyDown={blockEnter}
                          className="w-32 bg-transparent text-sm text-foreground outline-none"
                          aria-label={`Opsi ${optionIndex + 1} dari ${def.name || "varian"}`}
                        />
                        <button
                          type="button"
                          onClick={() => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.filter((_, oi) => oi !== optionIndex) } : d)))}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label={`Hapus opsi ${option}`}
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: [...d.options, emptyOption()] } : d)))}
                      className="inline-flex h-7 items-center rounded-md border border-dashed border-border px-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                    >
                      + Tambah opsi
                    </button>
                  </div>
                </div>
              ))}
              {variantDefs.length < 5 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setVariantDefs((prev) => [...prev, { name: "", options: [emptyOption()] }])}
                >
                  Tambah varian
                </Button>
              ) : null}
            </div>

            {combos.length ? (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="text-sm font-bold text-foreground">Harga &amp; stok per kombinasi</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Stok bisa diisi angka atau rentang acak, mis. random 8000-9000.</p>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 font-semibold">Kombinasi</th>
                      <th className="py-2 font-semibold">Harga (Rp)</th>
                      <th className="py-2 font-semibold">Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {combos.map((combo, comboIndex) => {
                      const key = String(comboIndex)
                      const value = combinations[key] ?? { price: "", stock: "" }
                      return (
                        <tr key={key} className="border-t border-border">
                          <td className="py-2 pr-3 font-medium text-foreground">{combo.label}</td>
                          <td className="py-2 pr-3">
                            <Input
                              type="number"
                              min="0"
                              value={value.price}
                              onChange={(event) => setCombinations((prev) => ({ ...prev, [key]: { ...value, price: event.target.value } }))}
                              aria-label={`Harga untuk ${combo.label}`}
                              className="h-8 w-36"
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="text"
                              value={value.stock}
                              onChange={(event) => setCombinations((prev) => ({ ...prev, [key]: { ...value, stock: event.target.value } }))}
                              placeholder="angka atau random 8000-9000"
                              aria-label={`Stok untuk ${combo.label}`}
                              className="h-8 w-48"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>


          {/* 3. FOTO: paling atas (pola Shopee/Shopify) */}
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Foto produk</h2>
                <p className="mt-1 text-sm text-muted-foreground">Unggah langsung atau pilih dari Media Library. Foto pertama jadi gambar utama katalog.</p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setPickerOpen(true)}>
                {pickedMedia.length ? "Kelola media" : "Tambah media"}
              </Button>
            </div>
            {pickedMedia.length ? (
              <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {pickedMedia.map((media, index) => (
                  <li
                    key={media.assetId}
                    className="relative cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(event) => setDragMediaIndex(index)}
                    onDragOver={(event) => {
                      if (dragMediaIndex !== null && dragMediaIndex !== index) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (dragMediaIndex !== null) reorderMedia(dragMediaIndex, index)
                      setDragMediaIndex(null)
                    }}
                    onDragEnd={() => setDragMediaIndex(null)}
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
                      {media.thumbUrl ? (
                        <img src={media.thumbUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                        </span>
                      )}
                      {index === 0 ? (
                        <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background">Utama</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickedMedia((prev) => prev.filter((m) => m.assetId !== media.assetId))}
                      className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
                      aria-label={`Hapus ${media.label || "media"}`}
                    >
                      <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="mt-4 flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface-muted/40 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              >
                <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                <span className="text-sm font-medium">Unggah atau pilih media</span>
                <span className="text-xs">Gambar/video langsung masuk Media Library</span>
              </button>
            )}
          </section>

          {/* 4. SIMPAN / PUBLISH: tombol ada di toolbox atas */}
        </form>

        {editing ? (
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-semibold">Aktifkan produk</h2>
            <p className="mt-2 text-sm text-muted-foreground">Periksa syarat berikut. Semua siap berarti produk bisa diaktifkan.</p>
            <div className="mt-6 space-y-3">
              <ReviewRow label="Nama produk" ready={Boolean(product?.name)} />
              <ReviewRow label="Foto utama terpasang" ready={pickedMedia.length > 0} />
              <ReviewRow label="Berat & dimensi (pengiriman)" ready={Boolean(form.data.weight_kg && form.data.width_cm && form.data.height_cm && form.data.depth_cm)} />
              <ReviewRow label="Varian aktif" ready={combos.length === 0 ? true : Boolean((incomingVariants?.length ?? 0) > 0)} />
            </div>

          </section>
        ) : null}
      </div>

      <MediaPicker
        open={optionPicker !== null}
        onClose={() => setOptionPicker(null)}
        multiple={false}
        title="Gambar opsi varian"
        onPick={(media) => {
          if (optionPicker === null || media.length === 0) return
          const { defIndex, optionIndex } = optionPicker
          const picked = media[0]
          setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.map((o, oi) => (oi === optionIndex ? { ...o, media_asset_id: picked.assetId, thumb_url: picked.thumbUrl } : o)) } : d)))
          setOptionPicker(null)
        }}
      />
      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        multiple
        title="Media produk"
        onPick={(media) => setPickedMedia((prev) => {
          const seen = new Set(prev.map((m) => m.assetId))
          return [...prev, ...media.filter((m) => !seen.has(m.assetId))]
        })}
      />
    </AdminLayout>
  )
}

function ReviewRow({ label, ready, detail }: { label: string; ready: boolean; detail?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-b-0">
      <span className="text-sm">{label}</span>
      <span className={`text-sm font-semibold ${ready ? "text-success" : "text-warning"}`}>{ready ? "Siap" : "Perlu dilengkapi"}{detail ? ` · ${detail}` : ""}</span>
    </div>
  )
}
