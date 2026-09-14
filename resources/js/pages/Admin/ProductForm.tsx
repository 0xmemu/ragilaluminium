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
  media?: Array<{ media_asset_id: number; media_asset_label?: string | null; url?: string | null; kind?: string | null; video_url?: string | null }>
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

function StatusCheck({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-foreground">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold",
          ready ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
        )}
      >
        {ready ? "Siap" : "Belum lengkap"}
      </span>
    </div>
  )
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
      kind: (m.kind === "video" ? "video" : "image") as PickedMedia["kind"],
      videoUrl: m.video_url ?? null,
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
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const requestedStatus = !editing && submitter?.textContent?.includes("aktifkan") ? "active" : status
    const payload = buildPayload(requestedStatus)
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
    if (!editing) return
    setPublishing(true)
    // Aktivkan harus menyimpan field yang sedang ada di form terlebih dahulu.
    // Memanggil endpoint publish terpisah membuat berat/dimensi yang baru
    // diketik belum masuk database.
    const payload = buildPayload("active")
    router.put(submitUrl, payload, {
      onFinish: () => setPublishing(false),
    })
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
          {!editing ? (
            <Button type="submit" form="product-edit-form" disabled={saving}>
              {saving ? "Mengaktifkan..." : "Simpan & aktifkan"}
            </Button>
          ) : null}
          {publishUrl && !isActive ? (
            <Button type="button" disabled={publishing} onClick={publish}>
              {publishing ? "Mempublikasikan..." : "Aktifkan produk"}
            </Button>
          ) : null}
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Produk | Admin`} />

      <div className="w-full space-y-6">
        <FormErrorSummary errors={form.errors} />

        <form id="product-edit-form" onSubmit={(event) => submit(preserveStatus, event)} className="space-y-6">
          {/* 1. IDENTITAS + TAKSONOMI + DIMENSI J&T (Table-First) */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Identitas & Taksonomi Produk</h2>
                <p className="text-xs text-muted-foreground">Informasi katalog, kategori, dan dimensi pengiriman J&T Cargo.</p>
              </div>
              {product ? <StatusBadge status={product.status} /> : <StatusBadge status="archived" label="Draf baru" />}
            </div>
            <table className="w-full">
              <tbody className="divide-y divide-border text-sm">
                <tr>
                  <th className="w-56 bg-muted/15 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground align-middle">
                    Parent SKU
                  </th>
                  <td className="px-4 py-2.5">
                    <Input
                      value={product?.parent_sku ?? "(otomatis saat disimpan)"}
                      readOnly
                      disabled
                      className="h-8 max-w-xs font-mono text-xs"
                    />
                  </td>
                </tr>
                <tr>
                  <th className="w-56 bg-muted/15 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground align-top pt-3">
                    Nama produk <span className="text-destructive">*</span>
                  </th>
                  <td className="px-4 py-2.5">
                    <Input
                      value={form.data.name}
                      onChange={(event) => form.setData("name", event.target.value as never)}
                      className="h-8 text-xs font-normal"
                      placeholder="Nama lengkap produk..."
                    />
                    {form.errors.name ? <p className="mt-1 text-xs text-destructive">{form.errors.name}</p> : null}
                  </td>
                </tr>
                <tr>
                  <th className="w-56 bg-muted/15 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground align-top pt-3">
                    Deskripsi
                  </th>
                  <td className="px-4 py-2.5">
                    <Textarea
                      rows={4}
                      value={form.data.description}
                      onChange={(event) => form.setData("description", event.target.value as never)}
                      className="text-xs"
                      placeholder="Deskripsi produk untuk katalog..."
                    />
                    {form.errors.description ? <p className="mt-1 text-xs text-destructive">{form.errors.description}</p> : null}
                  </td>
                </tr>
                <tr>
                  <th className="w-56 bg-muted/15 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground align-top pt-3">
                    Taksonomi katalog <span className="text-destructive">*</span>
                  </th>
                  <td className="px-4 py-2.5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Kategori</label>
                        <Select
                          value={form.data.product_category}
                          onChange={(event) => form.setData("product_category", event.target.value as never)}
                          className="h-8 text-xs"
                        >
                          {options.categories.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        {form.errors.product_category ? <p className="mt-1 text-xs text-destructive">{form.errors.product_category}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Model</label>
                        <Select
                          value={form.data.product_model}
                          onChange={(event) => form.setData("product_model", event.target.value as never)}
                          className="h-8 text-xs"
                        >
                          {options.models.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                        {form.errors.product_model ? <p className="mt-1 text-xs text-destructive">{form.errors.product_model}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Sub Model</label>
                        <Select
                          value={form.data.design_variant}
                          onChange={(event) => form.setData("design_variant", event.target.value as never)}
                          className="h-8 text-xs"
                        >
                          <option value="">Tanpa sub model</option>
                          {options.designs
                            .filter((option) => option.model === form.data.product_model)
                            .map((option) => (
                              <option key={option.model + ":" + option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                        </Select>
                        {form.errors.design_variant ? <p className="mt-1 text-xs text-destructive">{form.errors.design_variant}</p> : null}
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th className="w-56 bg-muted/15 px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground align-top pt-3">
                    Pengiriman (J&T Cargo) <span className="text-destructive">*</span>
                  </th>
                  <td className="px-4 py-2.5 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Berat dan dimensi paket milik produk, bukan per varian. Dipakai untuk ongkir & kubikasi.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Berat (kg)</label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Contoh: 15 atau 15,5"
                          value={form.data.weight_kg ?? ""}
                          onChange={(event) => form.setData("weight_kg", event.target.value as never)}
                          className="h-8 text-xs font-mono"
                        />
                        {form.errors.weight_kg ? <p className="mt-1 text-xs text-destructive">{form.errors.weight_kg}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Tinggi (cm)</label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Contoh: 100 atau 100,5"
                          value={form.data.height_cm ?? ""}
                          onChange={(event) => form.setData("height_cm", event.target.value as never)}
                          className="h-8 text-xs font-mono"
                        />
                        {form.errors.height_cm ? <p className="mt-1 text-xs text-destructive">{form.errors.height_cm}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Panjang (cm)</label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Contoh: 100 atau 100,5"
                          value={form.data.width_cm ?? ""}
                          onChange={(event) => form.setData("width_cm", event.target.value as never)}
                          className="h-8 text-xs font-mono"
                        />
                        {form.errors.width_cm ? <p className="mt-1 text-xs text-destructive">{form.errors.width_cm}</p> : null}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Lebar (cm)</label>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Contoh: 100 atau 100,5"
                          value={form.data.depth_cm ?? ""}
                          onChange={(event) => form.setData("depth_cm", event.target.value as never)}
                          className="h-8 text-xs font-mono"
                        />
                        {form.errors.depth_cm ? <p className="mt-1 text-xs text-destructive">{form.errors.depth_cm}</p> : null}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* 2. DEFINISI VARIAN & MATRIKS KOMBINASI (Table-First) */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Definisi Varian & Kombinasi</h2>
                <p className="text-xs text-muted-foreground">Beri nama varian (mis. Warna, Kaca), opsi, serta harga & stok per kombinasi.</p>
              </div>
              {variantDefs.length < 5 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setVariantDefs((prev) => [...prev, { name: "", options: [emptyOption()] }])}
                >
                  + Tambah varian
                </Button>
              ) : null}
            </div>

            <div className="divide-y divide-border">
              {variantDefs.map((def, defIndex) => (
                <div key={defIndex} className="p-4 flex flex-col gap-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground w-20 shrink-0">Varian {defIndex + 1}</span>
                    <Input
                      value={def.name}
                      onChange={(event) => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, name: event.target.value } : d)))}
                      onKeyDown={blockEnter}
                      placeholder="Nama varian (mis. Warna)"
                      className="h-8 w-44 text-xs font-medium"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setVariantDefs((prev) => prev.filter((_, i) => i !== defIndex))}
                    >
                      Hapus varian
                    </Button>
                  </div>
                  <div className="ml-0 sm:ml-20 flex flex-wrap items-center gap-2 pt-1">
                    {def.options.map((option, optionIndex) => (
                      <span key={optionIndex} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setOptionPicker({ defIndex, optionIndex })}
                          className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted"
                          aria-label={`Gambar untuk ${option.value || "opsi " + (optionIndex + 1)}`}
                          title="Pilih gambar opsi"
                        >
                          {option.thumb_url ? (
                            <img src={option.thumb_url} alt="" className="size-full object-cover" />
                          ) : (
                            <svg className="size-3 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          )}
                        </button>
                        <input
                          value={option.value}
                          onChange={(event) => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.map((o, oi) => (oi === optionIndex ? { ...o, value: event.target.value } : o)) } : d)))}
                          onKeyDown={blockEnter}
                          className="w-28 bg-transparent text-xs text-foreground outline-none"
                          aria-label={`Opsi ${optionIndex + 1} dari ${def.name || "varian"}`}
                          placeholder="Nilai opsi..."
                        />
                        <button
                          type="button"
                          onClick={() => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.filter((_, oi) => oi !== optionIndex) } : d)))}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label={`Hapus opsi ${option.value}`}
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
            </div>

            {combos.length ? (
              <div className="border-t border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Harga &amp; Stok per Kombinasi</h3>
                    <p className="text-[11px] text-muted-foreground">Isi harga dan stok untuk setiap kombinasi varian di bawah (stok bisa angka atau rentang acak seperti random 8000-9000).</p>
                  </div>
                  <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-sm">
                    {combos.length} kombinasi
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/20 text-left text-xs font-semibold text-foreground">
                        <th className="px-4 py-2.5">Kombinasi</th>
                        <th className="px-4 py-2.5 w-48">Harga (Rp)</th>
                        <th className="px-4 py-2.5 w-72">Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {combos.map((combo, comboIndex) => {
                        const key = String(comboIndex)
                        const value = combinations[key] ?? { price: "", stock: "" }
                        return (
                          <tr key={key} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2 font-medium text-foreground">{combo.label}</td>
                            <td className="px-4 py-2">
                              <Input
                                type="number"
                                min="0"
                                value={value.price}
                                onChange={(event) => setCombinations((prev) => ({ ...prev, [key]: { ...value, price: event.target.value } }))}
                                aria-label={`Harga untuk ${combo.label}`}
                                className="h-8 w-36 font-mono text-xs"
                                placeholder="Rp"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="text"
                                value={value.stock}
                                onChange={(event) => setCombinations((prev) => ({ ...prev, [key]: { ...value, stock: event.target.value } }))}
                                placeholder="angka atau random 8000-9000"
                                aria-label={`Stok untuk ${combo.label}`}
                                className="h-8 w-60 font-mono text-xs"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>

          {/* 3. FOTO PRODUK */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Foto Produk ({pickedMedia.length} foto)</h2>
                <p className="text-xs text-muted-foreground">Foto pertama otomatis menjadi foto utama katalog. Urutan bisa digeser dengan cursor.</p>
              </div>
              <Button type="button" variant="secondary" size="xs" onClick={() => setPickerOpen(true)}>
                {pickedMedia.length ? "Kelola media" : "+ Tambah media"}
              </Button>
            </div>
            <div className="p-4">
              {pickedMedia.length ? (
                <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                  {pickedMedia.map((media, index) => (
                    <li
                      key={media.assetId}
                      className={cn(
                        "group relative cursor-grab select-none active:cursor-grabbing transition-transform",
                        dragMediaIndex === index ? "opacity-40 scale-95" : "opacity-100"
                      )}
                      draggable
                      onDragStart={(event) => {
                        setDragMediaIndex(index)
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", String(index))
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = "move"
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const transferIndexStr = event.dataTransfer?.getData("text/plain")
                        const fromIdx = dragMediaIndex !== null ? dragMediaIndex : (transferIndexStr ? parseInt(transferIndexStr, 10) : null)
                        if (fromIdx !== null && !isNaN(fromIdx) && fromIdx !== index) {
                          reorderMedia(fromIdx, index)
                        }
                        setDragMediaIndex(null)
                      }}
                      onDragEnd={() => setDragMediaIndex(null)}
                    >
                      <span className="pointer-events-none relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
                        {media.kind === "video" ? (
                          <video
                            src={media.videoUrl ?? media.thumbUrl}
                            poster={media.thumbUrl || undefined}
                            muted
                            playsInline
                            preload="metadata"
                            className="pointer-events-none size-full object-cover select-none"
                          />
                        ) : media.thumbUrl ? (
                          <img
                            src={media.thumbUrl}
                            alt=""
                            className="pointer-events-none size-full object-cover select-none"
                            draggable={false}
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          </span>
                        )}
                        {media.kind === "video" ? (
                          <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">Video</span>
                        ) : null}
                        {index === 0 ? (
                          <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">Utama</span>
                        ) : null}
                      </span>

                      {/* Tombol geser cepat kiri/kanan di hover */}
                      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation()
                            reorderMedia(index, index - 1)
                          }}
                          className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                          title="Geser ke kiri"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <button
                          type="button"
                          disabled={index === pickedMedia.length - 1}
                          onClick={(e) => {
                            e.stopPropagation()
                            reorderMedia(index, index + 1)
                          }}
                          className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                          title="Geser ke kanan"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPickedMedia((prev) => prev.filter((m) => m.assetId !== media.assetId))}
                        className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
                        aria-label={`Hapus ${media.label || "media"}`}
                        title="Hapus foto"
                      >
                        <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-surface-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  <span className="text-xs font-medium">Unggah atau pilih media dari Media Library</span>
                </button>
              )}
            </div>
          </section>
        </form>

        {/* 4. SYARAT AKTIVASI (Checklist Edit Mode) */}
        {editing ? (
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">Syarat Publikasi &amp; Aktivasi Produk</h2>
              <p className="text-xs text-muted-foreground">Periksa kelengkapan syarat berikut sebelum mempublikasikan produk ke katalog aktif.</p>
            </div>
            <div className="divide-y divide-border p-4">
              <StatusCheck label="Nama produk terisi" ready={Boolean(product?.name)} />
              <StatusCheck label="Foto utama terpasang" ready={pickedMedia.length > 0} />
              <StatusCheck label="Berat & dimensi pengiriman lengkap (Panjang, Lebar, Tinggi, Berat > 0)" ready={Boolean(form.data.weight_kg && form.data.width_cm && form.data.height_cm && form.data.depth_cm)} />
              <StatusCheck label="Varian aktif terisi" ready={combos.length === 0 ? true : Boolean((incomingVariants?.length ?? 0) > 0)} />
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
