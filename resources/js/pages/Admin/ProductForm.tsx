import { Head, router, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker, type PickedMedia } from "@/components/admin/media-picker"
import { Button } from "@/components/admin/ui/button"
import { FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { SearchSelect } from "@/components/admin/ui/search-select"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Icon } from "@/components/shared/icon"
import type { SharedPageProps } from "@/types"
import { Textarea } from "@/components/admin/ui/textarea"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { SelectOption } from "@/types"

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
  attributes?: Array<{ name: string; value: string }>
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
type VariantDef = { name: string; options: VariationOption[]; locked?: boolean }

const emptyOption = (): VariationOption => ({ value: "" })

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
  installationMedia = [],
  mediaActionUrls,
  attributes = [],
}: {
  attributes?: Array<{ id?: number; name: string; value: string }>
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
    // Sub model OPSIONAL: bawaan kosong (berdiri sendiri), tidak dipaksa POLOS.
    design_variant: product?.design_variant ?? "",
    status: product?.status ?? "archived",
    weight_kg: (product as unknown as Record<string, unknown> & { weight_kg?: string })?.weight_kg as string ?? "",
    width_cm: (product as unknown as Record<string, unknown> & { width_cm?: string })?.width_cm as string ?? "",
    height_cm: (product as unknown as Record<string, unknown> & { height_cm?: string })?.height_cm as string ?? "",
    depth_cm: (product as unknown as Record<string, unknown> & { depth_cm?: string })?.depth_cm as string ?? "",
    attributes: (attributes ?? []).map((a) => ({ name: a.name, value: a.value })),
  })

  // ADR-021: media dipilih/diunggah langsung di form (upload atau Media Library),
  // dikirim bersama submit sebagai media_asset_ids. Foto pertama = gambar utama.
  // Satu halaman penuh: semua section (identitas, varian, media) selalu tampil
  // bertumpuk, tanpa tab. Prop activeTab dipertahankan agar redirect lama
  // (?tab=media / ?tab=varian) tetap valid tanpa error, hanya diabaikan.

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

  function addAttribute() {
    form.setData("attributes", [...(form.data.attributes ?? []), { name: "", value: "" }])
  }
  function removeAttribute(index: number) {
    form.setData("attributes", (form.data.attributes ?? []).filter((_, i) => i !== index))
  }
  function updateAttribute(index: number, key: "name" | "value", val: string) {
    const next = [...(form.data.attributes ?? [])]
    next[index] = { ...next[index], [key]: val }
    form.setData("attributes", next)
  }

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

  // ADR-021: definisi varian (nama bebas + opsi) diisi admin;
  // harga & stok diisi per kombinasi setelah definisi selesai.
  const [variantDefs, setVariantDefs] = React.useState<VariantDef[]>([])
  const [combinations, setCombinations] = React.useState<Record<string, { price: string; stock: string }>>({})

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
        locked: Boolean(def.name && String(def.name).trim() !== ""),
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

  // Error validasi server: form.* mengisi form.errors, sedangkan jalur router.*
  // mengisi shared props. Digabung supaya kedua jalur tetap menampilkan pesan
  // di FormErrorSummary dan di bawah field terkait.
  const sharedErrors = (usePage<SharedPageProps>().props.errors ?? {}) as Record<string, string>
  const combinedErrors: Record<string, string> = { ...sharedErrors, ...form.errors }

  // Sub model bersifat opsional. Daftar berisi sub model milik model terpilih
  // plus pilihan kosong; nilai bebas yang sudah tersimpan ikut ditampilkan
  // supaya tidak hilang saat form disimpan.
  const designOptions = React.useMemo(() => {
    const items = [
      { value: "", label: "Tanpa sub model" },
      ...options.designs
        .filter((option) => option.model === form.data.product_model)
        .map((option) => ({ value: option.value, label: option.label })),
    ]
    const current = form.data.design_variant
    if (current && !items.some((item) => item.value === current)) {
      items.push({ value: current, label: current })
    }
    return items
  }, [options.designs, form.data.product_model, form.data.design_variant])


  // Deteksi foto varian vs foto non-varian (katalog, shared media, video).
  const isVariantPhoto = (assetId: number) =>
    pickedMedia.find((m) => m.assetId === assetId)?.productVariantId != null ||
    variantOptionMedia.some((m) => m.assetId === assetId)

  // Pindah slot media:
  // - Media non-varian (katalog, shared media, video) BEBAS dipindah ke mana pun
  //   (ke depan varian, ke tengah, maupun ke paling belakang setelah varian).
  // - Urutan sesama foto varian (V1 < V2 < V3 ...) tetap terjaga sesuai urutan opsi varian.
  const moveSlot = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= mediaSlots.length || to >= mediaSlots.length) return

    // Buat susunan baru calon
    const next = [...mediaSlots]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)

    // Periksa apakah urutan relatif sesama foto varian tetap konsisten
    const variantInNext = next.filter((s) => isVariantPhoto(s.assetId)).map((s) => s.assetId)
    const variantInOrig = mediaSlots.filter((s) => isVariantPhoto(s.assetId)).map((s) => s.assetId)
    const variantOrderPreserved = variantInNext.every((id, idx) => id === variantInOrig[idx])

    if (!variantOrderPreserved) {
      setOrderNotice("Urutan sesama foto varian tetap mengikuti urutan varian. Media katalog & shared media bebas dipindah ke depan atau belakang varian.")
      return
    }

    setOrderNotice(null)
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
                        <SearchSelect
                          id="product-design-variant"
                          options={designOptions}
                          value={form.data.design_variant}
                          onValueChange={(next) =>
                            form.setData(
                              "design_variant",
                              next.trim().toUpperCase().replace(/\s+/g, "_") as never,
                            )
                          }
                          placeholder="Tanpa sub model"
                          searchPlaceholder="Cari atau ketik sub model"
                          emptyMessage="Belum ada sub model untuk model ini."
                          creatable
                        />
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

          {/* 1.5 SPESIFIKASI PRODUK (Table-First) */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Spesifikasi Produk</h2>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addAttribute}
              >
                <Icon name="plus" className="size-3.5" aria-hidden="true" />
                Tambah spesifikasi
              </Button>
            </div>
            {(form.data.attributes ?? []).length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Belum ada spesifikasi khusus. Klik tombol "Tambah spesifikasi" di atas untuk menambahkan.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20 text-left text-[11px] font-semibold text-muted-foreground">
                      <th className="w-1/3 px-4 py-2.5">Nama Spesifikasi</th>
                      <th className="px-4 py-2.5">Nilai Spesifikasi</th>
                      <th className="w-[1%] px-4 py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(form.data.attributes ?? []).map((attr, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="px-4 py-2">
                          <Input
                            value={attr.name}
                            onChange={(e) => updateAttribute(idx, "name", e.target.value)}
                            placeholder="mis. Bahan, Kusen"
                            className="h-8 text-xs font-normal"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={attr.value}
                            onChange={(e) => updateAttribute(idx, "value", e.target.value)}
                            placeholder="mis. Aluminium, 3 inch"
                            className="h-8 text-xs font-normal"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => removeAttribute(idx)}
                            className="text-destructive hover:bg-destructive/10"
                            aria-label="Hapus spesifikasi"
                          >
                            <Icon name="trash" className="size-3.5" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* 2. DEFINISI VARIAN & MATRIKS KOMBINASI (Table-First) */}
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Definisi Varian & Kombinasi</h2>
              </div>
              {variantDefs.length < 5 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setVariantDefs((prev) => [...prev, { name: "", options: [emptyOption()] }])}
                >
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                  Tambah
                </Button>
              ) : null}
            </div>

            <div className="divide-y divide-border">
              {variantDefs.map((def, defIndex) => {
                const isLocked = def.locked !== false && Boolean(def.name && def.name.trim() !== "")

                return (
                  <div key={defIndex} className="space-y-3 p-4 sm:p-5">
                    {/* Header baris: Nama varian */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Varian {defIndex + 1}:
                        </span>
                        {isLocked ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={def.name}
                              readOnly
                              aria-readonly="true"
                              aria-label={`Nama varian ${def.name}`}
                              className="h-8 w-64 cursor-not-allowed border-dashed bg-muted/40 text-xs font-medium text-muted-foreground focus-visible:ring-0"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                setVariantDefs((prev) =>
                                  prev.map((d, i) => (i === defIndex ? { ...d, locked: false } : d)),
                                )
                              }
                              className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                              title="Ubah nama varian"
                              aria-label={`Edit nama varian ${def.name}`}
                            >
                              <Icon name="pencil" className="size-3" aria-hidden="true" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                setVariantDefs((prev) => prev.filter((_, i) => i !== defIndex))
                              }
                              className="size-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Hapus varian ini"
                              aria-label={`Hapus varian ${def.name}`}
                            >
                              <Icon name="x" className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              value={def.name}
                              onChange={(event) =>
                                setVariantDefs((prev) =>
                                  prev.map((d, i) =>
                                    i === defIndex ? { ...d, name: event.target.value } : d,
                                  ),
                                )
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  if (def.name.trim()) {
                                    setVariantDefs((prev) =>
                                      prev.map((d, i) => (i === defIndex ? { ...d, locked: true } : d)),
                                    )
                                  }
                                }
                              }}
                              placeholder="Ketik nama varian (mis. Warna) lalu tekan Enter"
                              className="h-8 w-64 text-xs font-medium"
                              autoFocus={!def.name}
                            />
                            {def.name.trim() ? (
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={() =>
                                  setVariantDefs((prev) =>
                                    prev.map((d, i) => (i === defIndex ? { ...d, locked: true } : d)),
                                  )
                                }
                                className="h-8 px-2 text-xs"
                              >
                                Selesai
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                setVariantDefs((prev) => prev.filter((_, i) => i !== defIndex))
                              }
                              className="size-7 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Hapus varian ini"
                              aria-label="Hapus varian"
                            >
                              <Icon name="x" className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Penempatan Opsi Varian yang jelas dan teratur */}
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                        Pilihan opsi {def.name ? `untuk ${def.name}` : ""}:
                      </p>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {def.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className="flex items-center gap-2"
                          >
                            {/* Gambar opsi 65px x 65px dengan tombol silang X di pojok kanan atas */}
                            <div className="relative size-[65px] shrink-0">
                              <button
                                type="button"
                                onClick={() => setOptionPicker({ defIndex, optionIndex })}
                                className="relative size-[65px] overflow-hidden rounded border border-border bg-muted/40 transition hover:ring-2 hover:ring-primary/40 focus:outline-none"
                                aria-label={`Gambar untuk ${option.value || "opsi " + (optionIndex + 1)}`}
                                title={option.thumb_url ? "Ganti foto opsi" : "Pilih foto opsi dari Media Library"}
                              >
                                {option.thumb_url ? (
                                  <img src={option.thumb_url} alt="" className="size-full object-cover" />
                                ) : (
                                  <div className="flex size-full items-center justify-center text-muted-foreground/60">
                                    <Icon name="image" className="size-6" aria-hidden="true" />
                                  </div>
                                )}
                              </button>
                              {option.thumb_url || option.media_asset_id ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setVariantDefs((prev) =>
                                      prev.map((d, i) =>
                                        i === defIndex
                                          ? {
                                              ...d,
                                              options: d.options.map((o, oi) =>
                                                oi === optionIndex ? { ...o, media_asset_id: null, thumb_url: null } : o,
                                              ),
                                            }
                                          : d,
                                      ),
                                    )
                                  }}
                                  className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-xs transition hover:scale-110"
                                  aria-label={`Hapus foto ${option.value || "opsi"}`}
                                  title="Hapus foto dari opsi ini"
                                >
                                  <Icon name="x" className="size-2.5" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>

                            {/* Input nilai opsi: ukuran tetap 132x32 px, tidak mengikuti panjang isi */}
                            <Input
                              value={option.value}
                              onChange={(event) =>
                                setVariantDefs((prev) =>
                                  prev.map((d, i) =>
                                    i === defIndex
                                      ? {
                                          ...d,
                                          options: d.options.map((o, oi) =>
                                            oi === optionIndex ? { ...o, value: event.target.value } : o,
                                          ),
                                        }
                                      : d,
                                  ),
                                )
                              }
                              onKeyDown={blockEnter}
                              className="h-9 w-[132px] shrink-0 text-xs font-medium"
                              aria-label={`Opsi ${optionIndex + 1} dari ${def.name || "varian"}`}
                              placeholder="Nilai opsi..."
                            />

                            {/* Tombol hapus opsi */}
                            <button
                              type="button"
                              onClick={() =>
                                setVariantDefs((prev) =>
                                  prev.map((d, i) =>
                                    i === defIndex
                                      ? { ...d, options: d.options.filter((_, oi) => oi !== optionIndex) }
                                      : d,
                                  ),
                                )
                              }
                              className="mr-0.5 inline-flex size-5 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Hapus opsi ${option.value}`}
                              title="Hapus opsi ini"
                            >
                              <Icon name="x" className="size-3" aria-hidden="true" />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() =>
                            setVariantDefs((prev) =>
                              prev.map((d, i) =>
                                i === defIndex ? { ...d, options: [...d.options, emptyOption()] } : d,
                              ),
                            )
                          }
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                        >
                          <Icon name="plus" className="size-3" aria-hidden="true" />
                          Tambah opsi
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {combos.length ? (
              <div className="border-t border-border">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Harga &amp; Stok per Kombinasi</h3>
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
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => setPickerOpen(true)}
                  title="Tambah media dari Media Library"
                >
                  <Icon name="plus" className="size-3.5" aria-hidden="true" />
                  Tambah
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
                      {(() => {
                        const isVariant = isVariantPhoto(slot.assetId)
                        const canLeft = index > 0 && (!isVariant || !isVariantPhoto(mediaSlots[index - 1].assetId))
                        const canRight = index < mediaSlots.length - 1 && (!isVariant || !isVariantPhoto(mediaSlots[index + 1].assetId))
                        return (
                          <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              disabled={!canLeft}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (canLeft) moveSlot(index, index - 1)
                              }}
                              className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                              title="Geser ke kiri"
                            >
                              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                            </button>
                            <button
                              type="button"
                              disabled={!canRight}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (canRight) moveSlot(index, index + 1)
                              }}
                              className="flex size-5 items-center justify-center rounded bg-background/90 text-foreground shadow hover:bg-background disabled:opacity-30"
                              title="Geser ke kanan"
                            >
                              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                            </button>
                          </div>
                        )
                      })()}

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
              </div>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => setPickerInstOpen(true)}
                title="Tambah hasil pemasangan dari Media Library"
              >
                <Icon name="plus" className="size-3.5" aria-hidden="true" />
                Tambah
              </Button>
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
              {!(editing ? instRows.length : pendingInst.length) ? (
                <button
                  type="button"
                  onClick={() => setPickerInstOpen(true)}
                  className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border bg-surface-muted/30 text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                >
                  <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                  <span className="text-xs font-medium">Pilih media dari Media Library sebagai hasil pemasangan</span>
                </button>
              ) : null}
            </div>
          </section>
        </form>

        {/* 4. SYARAT AKTIVASI (Checklist) */}
        {editing ? (
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border bg-muted/40 px-4 py-3">
              <h2 className="text-sm font-bold text-foreground">Syarat Publikasi &amp; Aktivasi Produk</h2>
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
