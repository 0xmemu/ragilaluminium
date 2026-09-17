import { Head, Link, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import type { SharedPageProps } from "@/types"
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
  media?: Array<{
    media_asset_id: number
    media_asset_label?: string | null
    url?: string | null
    kind?: string | null
    video_url?: string | null
    product_variant_id?: number | null
    variant_label?: string | null
  }>
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
  activeTab = 'identitas',
  installationMedia = [],
  mediaHref,
  mediaActionUrls,
}: {
  backUrl?: string | null
  product: ProductRecord | null
  /** Definisi varian dari controller (hasil reconstruct import). */
  "variant_defs"?: Array<{ name: string; options: Array<{ value: string; media_asset_id?: number | null; thumb_url?: string | null }> }>
  /** Daftar varian eksisting (SKU, opsi, harga, stok). */
  "variants"?: Array<{ id: number; variant_sku: string; variation_1_name: string | null; variation_1_option: string | null; variation_2_name: string | null; variation_2_option: string | null; price: number; stock: number; status: string }>
  library?: Array<{ id: number; label: string; kind: string; status: string; usage_count: number; thumb_url?: string | null; media_url?: string | null }>
  submitUrl: string
  publishUrl?: string
  /** Tab aktif (hanya edit mode): identitas | varian | media. */
  activeTab?: string
  /** Tautan ke halaman pengelolaan media produk. */
  mediaHref?: string
  /** Media hasil pemasangan (dikelola terpisah dari galeri katalog). */
  installationMedia?: Array<{
    id: number
    media_asset_id: number
    label?: string | null
    url?: string | null
    position: number
    show_in_catalog: boolean
    installation_caption?: string | null
    update_url: string
    archive_url: string
  }>
  /** URL aksi instan panel media. */
  mediaActionUrls?: import("@/components/admin/product-edit/types").MediaPanelUrls
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
  // Satu halaman penuh: semua section (identitas, varian, media) selalu tampil
  // bertumpuk, tanpa tab. Prop activeTab dipertahankan agar redirect lama
  // (?tab=media / ?tab=varian) tetap valid tanpa error, hanya diabaikan.
  const libraryAssets = ((usePage<SharedPageProps>().props as unknown as {
    library?: Array<{ id: number; label: string; kind: string; status: string; usage_count: number; thumb_url?: string | null; media_url?: string | null }>
  }).library) ?? []

  const [pickerOpen, setPickerOpen] = React.useState(false)
  // Media hasil pemasangan: tambah via MediaPicker (simpan instan lewat
  // admin.products.media.store dgn is_installation), geser urutan lokal,
  // lepas via endpoint arsip instan.
  const [pickerInstOpen, setPickerInstOpen] = React.useState(false)
  const [instRows, setInstRows] = React.useState(installationMedia)
  React.useEffect(() => {
    setInstRows(installationMedia)
  }, [installationMedia])
  // Mode create: hasil pemasangan dibuffer lokal dulu (produk belum ada),
  // ditempel ke database saat form disimpan via installation_media_asset_ids.
  const [pendingInst, setPendingInst] = React.useState<PickedMedia[]>([])

  function moveInst(from: number, to: number) {
    if (to < 0 || to >= instRows.length || from === to) return
    setInstRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((row, i) => ({ ...row, position: i + 1 }))
    })
  }

  function removeInst(rowId: number, archiveUrl: string) {
    router.post(
      archiveUrl,
      {},
      {
        preserveScroll: true,
        onSuccess: () => setInstRows((prev) => prev.filter((r) => r.id !== rowId)),
      },
    )
  }

  function attachInst(media: PickedMedia) {
    // Create: produk belum ada, buffer lokal saja. Edit: simpan instan.
    if (!editing) {
      setPendingInst((prev) => (prev.some((m) => m.assetId === media.assetId) ? prev : [...prev, media]))
      return
    }
    if (!mediaActionUrls) return
    router.post(
      mediaActionUrls.storeUrl,
      {
        media_asset_id: media.assetId,
        kind: media.kind,
        position: instRows.length + 1,
        is_main_image: false,
        show_in_catalog: false,
        is_installation: true,
        visibility: "visible",
      },
      { preserveScroll: true },
    )
  }
  const [pickedMedia, setPickedMedia] = React.useState<PickedMedia[]>([])
  const [optionPicker, setOptionPicker] = React.useState<{ defIndex: number; optionIndex: number } | null>(null)
  const [dragMediaIndex, setDragMediaIndex] = React.useState<number | null>(null)

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
      variantLabel: m.variant_label ?? null,
      productVariantId: m.product_variant_id ?? null,
    })))
  }, [editing])

  // ADR-021: definisi varian (nama bebas + opsi) diisi admin;
  // harga & stok diisi per kombinasi setelah definisi selesai.
  const [variantDefs, setVariantDefs] = React.useState<VariantDef[]>([])
  const [combinations, setCombinations] = React.useState<Record<string, { price: string; stock: string }>>({})

  const combos = buildCombinations(variantDefs)

  // Pratinjau langsung: gambar opsi varian ikut tampil di Foto Produk dengan
  // label varian, tanpa menunggu simpan. Edit mode tidak memakainya karena
  // media varian tersimpan sudah muncul lewat pickedMedia (variantLabel).
  const variantOptionMedia = React.useMemo(() => {
    if (editing) return []
    const byAsset = new Map<number, { label: string; thumbUrl: string }>()
    for (const def of variantDefs) {
      for (const option of def.options) {
        if (!option.media_asset_id || !option.thumb_url) continue
        const label = [def.name, option.value].filter(Boolean).join(" / ")
        const existing = byAsset.get(option.media_asset_id)
        byAsset.set(option.media_asset_id, {
          label: existing ? `${existing.label} · ${label}` : label,
          thumbUrl: option.thumb_url,
        })
      }
    }
    return [...byAsset].map(([assetId, value]) => ({ assetId, ...value }))
  }, [editing, variantDefs])

  // Grid gabungan: satu urutan visual berisi slot katalog (bisa digeser) dan
  // slot varian (terkunci, hanya jadi penanda posisi). Urutan katalog untuk
  // payload tetap diambil dari pickedMedia sesuai urutan slot katalog.
  type MediaGridSlot = { type: "catalog"; assetId: number } | { type: "variant"; assetId: number }
  const [gridSlots, setGridSlots] = React.useState<MediaGridSlot[] | null>(null)
  const mediaSlots = React.useMemo<MediaGridSlot[]>(() => {
    const base = gridSlots ?? []
    const out = base.filter((slot) =>
      slot.type === "catalog"
        ? pickedMedia.some((m) => m.assetId === slot.assetId)
        : variantOptionMedia.some((m) => m.assetId === slot.assetId),
    )
    for (const m of pickedMedia) {
      if (!out.some((s) => s.type === "catalog" && s.assetId === m.assetId)) out.push({ type: "catalog", assetId: m.assetId })
    }
    for (const m of variantOptionMedia) {
      if (!out.some((s) => s.type === "variant" && s.assetId === m.assetId)) out.push({ type: "variant", assetId: m.assetId })
    }
    return out
  }, [gridSlots, pickedMedia, variantOptionMedia])

  // Terapkan urutan slot katalog ke pickedMedia (sumber payload galeri).
  const applySlotOrder = (slots: MediaGridSlot[]) => {
    setGridSlots(slots)
    const byId = new Map(pickedMedia.map((m) => [m.assetId, m]))
    const next: PickedMedia[] = []
    for (const slot of slots) {
      if (slot.type !== "catalog") continue
      const media = byId.get(slot.assetId)
      if (media) next.push(media)
    }
    if (next.length === pickedMedia.length) setPickedMedia(next)
  }

  // Pindah slot katalog ke index gabungan (target boleh slot varian).
  // from < to: ditempatkan setelah target; from > to: sebelum target.
  const [orderNotice, setOrderNotice] = React.useState<string | null>(null)

  // Foto dari opsi varian membawa productVariantId. Dipakai untuk memisahkan
  // area katalog dan area varian saat mengurutkan (slot grid sendiri tidak
  // membedakannya di mode edit).
  const isVariantPhoto = (assetId: number) =>
    pickedMedia.find((m) => m.assetId === assetId)?.productVariantId != null ||
    variantOptionMedia.some((m) => m.assetId === assetId)

  const moveSlot = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= mediaSlots.length || to >= mediaSlots.length) return
    const fromSlot = mediaSlots[from]
    const toSlot = mediaSlots[to]
    if (!fromSlot || !toSlot) return

    const fromIsVariant = isVariantPhoto(fromSlot.assetId)
    const toIsVariant = isVariantPhoto(toSlot.assetId)

    // Kontrak band posisi: foto katalog 1-49, foto varian 50-79. Keduanya
    // disimpan terpisah, jadi memindahkan foto varian ke tengah foto katalog
    // (atau sebaliknya) tidak akan pernah tersimpan. Gerakan itu ditolak
    // dengan pesan, bukan diterima lalu diam-diam dikembalikan saat simpan.
    if (fromIsVariant !== toIsVariant) {
      setOrderNotice(
        fromIsVariant
          ? "Foto varian hanya bisa diurutkan sesama foto varian. Untuk memindahkannya ke urutan katalog, ubah fotonya di Definisi Varian."
          : "Foto katalog hanya bisa diurutkan sesama foto katalog. Foto varian menempel pada opsinya di Definisi Varian.",
      )
      return
    }

    setOrderNotice(null)
    const next = mediaSlots.filter((_, i) => i !== from)
    next.splice(to, 0, fromSlot)
    applySlotOrder(next)
  }

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
      installation_media_asset_ids: pendingInst.map((m) => m.assetId),
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
    // Create: Simpan utama otomatis mengaktifkan (publication gate menjaga
    // produk tetap draf bila checklist belum lengkap). Tombol "Simpan draf"
    // tetap tersedia untuk menyimpan tanpa mencoba aktifkan.
    const wantsDraft = submitter?.textContent?.includes("draf") ?? false
    const requestedStatus: "active" | "archived" = !editing && !wantsDraft ? "active" : status
    const payload = buildPayload(requestedStatus)

    // Kirim lewat instance useForm (form.transform + form.post/put), BUKAN
    // router.* : hanya jalur ini yang mengisi form.errors sehingga error
    // validasi server tampil di FormErrorSummary dan di bawah field. Dengan
    // router.* error masuk ke shared props dan form.errors tetap kosong,
    // sehingga tombol Simpan tampak "hanya reload" tanpa pesan apa pun.
    form.transform(() => payload)

    // ADR-021: create = POST store; edit = PUT update (405 kalau POST).
    const options = {
      preserveScroll: true,
      onSuccess: () => {
        if (addAnother) {
          router.visit(routeUrl("admin.products.create"))
        }
      },
      onFinish: () => setSaving(false),
    }
    if (editing) {
      form.put(submitUrl, options)
    } else {
      form.post(submitUrl, options)
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
    // Sama seperti submit(): pakai form.* agar error validasi terlihat.
    form.transform(() => payload)
    form.put(submitUrl, {
      preserveScroll: true,
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
          {!editing ? (
            <>
              <Button type="submit" form="product-edit-form" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="submit" form="product-edit-form" variant="secondary" disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan draf"}
              </Button>
            </>
          ) : (
            <Button type="submit" form="product-edit-form" variant="secondary" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          )}
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
        <FormErrorSummary errors={combinedErrors} />

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
                    {combinedErrors.name ? <p className="mt-1 text-xs text-destructive">{combinedErrors.name}</p> : null}
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
                    {combinedErrors.description ? <p className="mt-1 text-xs text-destructive">{combinedErrors.description}</p> : null}
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
                        {combinedErrors.product_category ? <p className="mt-1 text-xs text-destructive">{combinedErrors.product_category}</p> : null}
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
                        {combinedErrors.product_model ? <p className="mt-1 text-xs text-destructive">{combinedErrors.product_model}</p> : null}
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
                        {combinedErrors.design_variant ? <p className="mt-1 text-xs text-destructive">{combinedErrors.design_variant}</p> : null}
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
                        {combinedErrors.weight_kg ? <p className="mt-1 text-xs text-destructive">{combinedErrors.weight_kg}</p> : null}
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
                        {combinedErrors.height_cm ? <p className="mt-1 text-xs text-destructive">{combinedErrors.height_cm}</p> : null}
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
                        {combinedErrors.width_cm ? <p className="mt-1 text-xs text-destructive">{combinedErrors.width_cm}</p> : null}
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
                        {combinedErrors.depth_cm ? <p className="mt-1 text-xs text-destructive">{combinedErrors.depth_cm}</p> : null}
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
                <div key={defIndex} className="grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-2.5 p-4">
                  <span className="self-center text-xs font-semibold text-muted-foreground">Varian {defIndex + 1}</span>
                  <div className="flex items-center gap-3">
                    <Input
                      value={def.name}
                      onChange={(event) => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, name: event.target.value } : d)))}
                      onKeyDown={blockEnter}
                      placeholder="Nama varian (mis. Warna)"
                      className="h-8 w-56 text-xs font-medium"
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
                  <span className="self-start text-xs text-muted-foreground/70">Opsi</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {def.options.map((option, optionIndex) => (
                      <span key={optionIndex} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface p-1.5 shadow-sm">
                        <button
                          type="button"
                          onClick={() => setOptionPicker({ defIndex, optionIndex })}
                          className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted"
                          aria-label={`Gambar untuk ${option.value || "opsi " + (optionIndex + 1)}`}
                          title="Pilih gambar opsi"
                        >
                          {option.thumb_url ? (
                            <img src={option.thumb_url} alt="" className="size-full object-cover" />
                          ) : (
                            <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          )}
                        </button>
                        <input
                          value={option.value}
                          onChange={(event) => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.map((o, oi) => (oi === optionIndex ? { ...o, value: event.target.value } : o)) } : d)))}
                          onKeyDown={blockEnter}
                          className="w-32 bg-transparent text-xs text-foreground outline-none"
                          aria-label={`Opsi ${optionIndex + 1} dari ${def.name || "varian"}`}
                          placeholder="Nilai opsi..."
                        />
                        <button
                          type="button"
                          onClick={() => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: d.options.filter((_, oi) => oi !== optionIndex) } : d)))}
                          className="text-muted-foreground transition hover:text-destructive"
                          aria-label={`Hapus opsi ${option.value}`}
                        >
                          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVariantDefs((prev) => prev.map((d, i) => (i === defIndex ? { ...d, options: [...d.options, emptyOption()] } : d)))}
                      className="inline-flex h-9 items-center rounded-md border border-dashed border-border px-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
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

          {/* 3. FOTO PRODUK (galeri urutan, tersimpan via Simpan) */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Foto Produk ({pickedMedia.length} foto{variantOptionMedia.length ? `, ${variantOptionMedia.length} foto varian` : ""})</h2>
                <p className="text-xs text-muted-foreground">
                  Foto pertama otomatis menjadi foto utama katalog. Urutan bisa digeser dengan cursor.
                  Foto katalog dan foto varian berada di area terpisah: foto varian tetap di belakang dan
                  urutannya dikelola di Definisi Varian.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setPickerOpen(true)}
                  className="w-7 px-0"
                  aria-label="Tambah media"
                  title="Tambah media dari Media Library"
                >
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                </Button>
                <Button type="button" variant="secondary" size="xs" onClick={() => setPickerOpen(true)}>
                  Kelola media
                </Button>
              </div>
            </div>
            <div className="p-4">
              {orderNotice ? (
                <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground" role="status">
                  {orderNotice}
                </p>
              ) : null}
              {mediaSlots.length ? (
                <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                  {mediaSlots.map((slot, index) => {
                    if (slot.type === "variant") {
                      const variantMeta = variantOptionMedia.find((m) => m.assetId === slot.assetId)
                      if (!variantMeta) return null
                      return (
                        <li
                          key={`variant-${slot.assetId}`}
                          className="relative select-none"
                          title="Foto opsi varian: dikelola di Definisi Varian, otomatis menempel ke varian terkait saat disimpan"
                        >
                          <span className="pointer-events-none relative block aspect-square overflow-hidden rounded-md border border-dashed border-border bg-surface-muted">
                            <img
                              src={variantMeta.thumbUrl}
                              alt=""
                              className="pointer-events-none size-full object-cover select-none"
                              draggable={false}
                            />
                            <span className="absolute inset-x-1 bottom-1 truncate rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">
                              {variantMeta.label}
                            </span>
                          </span>
                        </li>
                      )
                    }
                    const media = pickedMedia.find((m) => m.assetId === slot.assetId)
                    if (!media) return null
                    const catalogIndex = mediaSlots.slice(0, index + 1).filter((s) => s.type === "catalog").length - 1
                    const catalogTotal = mediaSlots.filter((s) => s.type === "catalog").length

                    return (
                    <li
                      key={slot.assetId}
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
                          moveSlot(fromIdx, index)
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
                        {catalogIndex === 0 && media.kind !== "video" ? (
                          <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">Utama</span>
                        ) : null}
                        {media.variantLabel ? (
                          <span className="absolute inset-x-1 bottom-1 truncate rounded bg-foreground/80 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">
                            {media.variantLabel}
                          </span>
                        ) : null}
                      </span>

                      {/* Tombol geser cepat kiri/kanan di hover */}
                      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={
                            mediaSlots[index - 1] === undefined
                            || isVariantPhoto(mediaSlots[index - 1].assetId) !== isVariantPhoto(slot.assetId)
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                            const prev = mediaSlots[index - 1]
                            if (prev) moveSlot(index, index - 1)
                          }}
                          className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                          title="Geser ke kiri"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <button
                          type="button"
                          disabled={
                            mediaSlots[index + 1] === undefined
                            || isVariantPhoto(mediaSlots[index + 1].assetId) !== isVariantPhoto(slot.assetId)
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                            const next = mediaSlots[index + 1]
                            if (next) moveSlot(index, index + 1)
                          }}
                          className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                          title="Geser ke kanan"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPickedMedia((prev) => prev.filter((m) => m.assetId !== slot.assetId))}
                        className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
                        aria-label={`Hapus ${media.label || "media"}`}
                        title="Hapus foto"
                      >
                        <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </li>
                    )
                  })}
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

          {/* 3b. HASIL PEMASANGAN (terpisah dari galeri katalog).
              Edit: simpan instan per baris. Create: buffer lokal, ditempel saat disimpan. */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Hasil Pemasangan ({editing ? instRows.length : pendingInst.length} media)</h2>
                <p className="text-xs text-muted-foreground">Tampil di seksi Hasil Pemasangan pada halaman produk dan galeri hasil pemasangan.</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => setPickerInstOpen(true)}
                className="w-7 px-0"
                aria-label="Tambah hasil pemasangan"
                title="Tambah hasil pemasangan dari Media Library"
              >
                <Icon name="plus" className="size-3.5" aria-hidden="true" />
              </Button>
              {mediaHref ? (
                <Button asChild type="button" variant="ghost" size="xs">
                  <a href={mediaHref}>Kelola media</a>
                </Button>
              ) : null}
            </div>
            <div className="p-4">
              {(editing ? instRows.length : pendingInst.length) ? (
                <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                  {!editing && pendingInst.map((media, index) => (
                    <li
                      key={`pending-${media.assetId}`}
                      className={cn(
                        "group relative cursor-grab select-none active:cursor-grabbing transition-transform",
                        dragMediaIndex === index ? "opacity-40 scale-95" : "opacity-100",
                      )}
                      draggable
                      onDragStart={(event) => {
                        setDragMediaIndex(index)
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", String(index))
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        const fromIdx = dragMediaIndex
                        if (fromIdx !== null && fromIdx !== index) {
                          setPendingInst((prev) => {
                            const next = [...prev]
                            const [moved] = next.splice(fromIdx, 1)
                            next.splice(index, 0, moved)
                            return next
                          })
                        }
                        setDragMediaIndex(null)
                      }}
                      onDragEnd={() => setDragMediaIndex(null)}
                    >
                      <span className="pointer-events-none relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
                        {media.thumbUrl ? (
                          <img src={media.thumbUrl} alt="" className="pointer-events-none size-full object-cover select-none" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          </span>
                        )}
                        <span className="absolute left-1 top-1 rounded bg-info/90 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">Hasil pasang</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingInst((prev) => prev.filter((m) => m.assetId !== media.assetId))}
                        className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
                        aria-label={`Lepas ${media.label || "media"}`}
                        title="Lepas dari hasil pemasangan"
                      >
                        <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                  {editing && instRows.map((media, index) => (
                    <li
                      key={media.id}
                      className={cn(
                        "group relative cursor-grab select-none active:cursor-grabbing transition-transform",
                        dragMediaIndex === index ? "opacity-40 scale-95" : "opacity-100",
                      )}
                      draggable
                      onDragStart={(event) => {
                        setDragMediaIndex(index)
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", String(index))
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        const fromIdx = dragMediaIndex
                        if (fromIdx !== null && fromIdx !== index) moveInst(fromIdx, index)
                        setDragMediaIndex(null)
                      }}
                      onDragEnd={() => setDragMediaIndex(null)}
                    >
                      <span className="pointer-events-none relative block aspect-square overflow-hidden rounded-md border border-border bg-surface-muted">
                        {media.url ? (
                          <img src={media.url} alt="" className="pointer-events-none size-full object-cover select-none" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          </span>
                        )}
                        <span className="absolute left-1 top-1 rounded bg-info/90 px-1.5 py-0.5 text-[9px] font-bold text-background shadow">Hasil pasang</span>
                      </span>

                      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => { e.stopPropagation(); moveInst(index, index - 1) }}
                          className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                          title="Geser ke kiri"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
                        </button>
                        <button
                          type="button"
                          disabled={index === instRows.length - 1}
                          onClick={(e) => { e.stopPropagation(); moveInst(index, index + 1) }}
                          className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                          title="Geser ke kanan"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeInst(media.id, media.archive_url)}
                        className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-md transition hover:bg-destructive"
                        aria-label={`Lepas ${media.label || "media"}`}
                        title="Lepas dari hasil pemasangan"
                      >
                        <svg className="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {/* Tombol tambah selalu tersedia: sebelumnya hanya tampil saat
                  daftar kosong, sehingga admin tidak bisa menambah media
                  hasil pemasangan kedua dan seterusnya. */}
              <button
                type="button"
                onClick={() => setPickerInstOpen(true)}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-surface-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-foreground",
                  (editing ? instRows.length : pendingInst.length) ? "mt-3 h-20" : "h-28",
                )}
              >
                  <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                <span className="text-xs font-medium">Pilih media dari Media Library sebagai hasil pemasangan</span>
              </button>
            </div>
          </section>
        </form>

        {/* 4. SYARAT AKTIVASI (Checklist) */}
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
        open={pickerInstOpen}
        onClose={() => setPickerInstOpen(false)}
        multiple
        title="Pilih media hasil pemasangan"
        onPick={(media) => {
          media.forEach((m) => attachInst(m))
          setPickerInstOpen(false)
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
