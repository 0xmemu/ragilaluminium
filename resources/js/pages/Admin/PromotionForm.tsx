import { Head, Link, useForm, usePage } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { Switch } from "@/components/admin/ui/switch"
import AdminLayout from "@/layouts/admin-layout"
import { Icon } from "@/components/shared/icon"
import { routeUrl } from "@/lib/routes"
import type { SharedPageProps } from "@/types"
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
  sync_banner: boolean
  sync_banner_image_url: string | null
  sync_banner_media_asset_id: number | null
  sync_banner_link_url: string | null
  sync_bar_promo: boolean
  targets: TargetDraft[]
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
  const form = useForm<PromotionFormData>({
    type: promotion?.type ?? options.type,
    name: promotion?.name ?? "",
    discount_percent: promotion?.discount_percent ?? 10,
    starts_at: toLocalInput(promotion?.starts_at),
    ends_at: toLocalInput(promotion?.ends_at),
    sync_banner: promotion?.sync_banner ?? false,
    sync_banner_image_url: promotion?.sync_banner_image_url ?? null,
    sync_banner_media_asset_id: promotion?.sync_banner_media_asset_id ?? null,
    sync_banner_link_url: promotion?.sync_banner_link_url ?? null,
    sync_bar_promo: promotion?.sync_bar_promo ?? false,
    targets: promotion?.targets?.map((target) => ({
      target_type: target.target_type,
      target_id: String(target.target_id),
      excluded: Boolean(target.excluded),
      override_discount_percent: target.override_discount_percent ? String(target.override_discount_percent) : "",
    })) ?? [],
  })
  const [excludeSearch, setExcludeSearch] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const bannerFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [bannerFile, setBannerFile] = React.useState<File | null>(null)
  const [uploadingBanner, setUploadingBanner] = React.useState(false)
  const { csrf } = usePage<SharedPageProps>().props
  const presignUrl = routeUrl("admin.media.presign")

  const bannerPreview = React.useMemo(
    () => (bannerFile ? URL.createObjectURL(bannerFile) : form.data.sync_banner_image_url),
    [bannerFile, form.data.sync_banner_image_url],
  )

  React.useEffect(() => {
    return () => {
      if (bannerPreview && bannerFile) URL.revokeObjectURL(bannerPreview)
    }
  }, [bannerPreview, bannerFile])

  async function uploadBannerImage(file: File) {
    setUploadingBanner(true)
    try {
      const presignRes = await fetch(presignUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "X-CSRF-TOKEN": csrf ?? "",
        },
        body: JSON.stringify({
          kind: "image",
          filename: file.name,
          size_bytes: file.size,
          mime: file.type || "application/octet-stream",
          context: "banner",
        }),
      })
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => null)
        throw new Error(body?.message ?? `Gagal menyiapkan upload (${presignRes.status})`)
      }
      const presigned = (await presignRes.json()) as { upload_url: string; object_key: string }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", presigned.upload_url)
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload ke penyimpanan gagal (${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error("Upload gagal - periksa koneksi internet."))
        xhr.send(file)
      })

      form.setData("sync_banner_image_url", `/media/${presigned.object_key}`)
    } finally {
      setUploadingBanner(false)
    }
  }
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
    if (bannerFile) {
      try {
        await uploadBannerImage(bannerFile)
      } catch {
        return
      }
    }
    const payload = {
      ...form.data,
      starts_at: form.data.starts_at || null,
      ends_at: form.data.ends_at || null,
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
            <Field id="promotion-banner" label="Tandai juga sebagai banner beranda" className="sm:col-span-2">
              <div className="space-y-3 rounded-md border border-border bg-surface p-3">
                <div className="flex h-6 items-center">
                  <Switch label="Tandai juga sebagai banner beranda" checked={form.data.sync_banner} onCheckedChange={(checked) => form.setData("sync_banner", checked)} />
                  <span className="ml-3 text-sm text-muted-foreground">Kampanye ini tampil sebagai banner promosi beranda selama periode live</span>
                </div>

                {form.data.sync_banner ? (
                  <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                    <Field id="promotion-banner-image" label="Gambar banner" hint="Rasio disarankan 1024 x 426 px (sekitar 2,4:1)">
                      <div className="flex items-center gap-3">
                        {bannerPreview ? (
                          <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                            <img src={bannerPreview} alt="Pratinjau banner" className="size-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex size-20 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-muted-foreground">
                            <Icon name="image" className="size-5" aria-hidden="true" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                          <input
                            ref={bannerFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null
                              setBannerFile(file)
                              event.target.value = ""
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" disabled={uploadingBanner} onClick={() => bannerFileInputRef.current?.click()}>
                            <Icon name="upload" className="mr-2 size-4" aria-hidden="true" />
                            {uploadingBanner ? "Mengunggah..." : bannerFile || form.data.sync_banner_image_url ? "Ganti gambar" : "Pilih gambar"}
                          </Button>
                          {form.data.sync_banner_image_url || bannerFile ? (
                            <button
                              type="button"
                              className="text-left text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                setBannerFile(null)
                                form.setData("sync_banner_image_url", null)
                              }}
                            >
                              Hapus gambar
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </Field>
                    <Field id="promotion-banner-link" label="Link banner" hint="URL penuh atau path internal. Kosongkan untuk otomatis (/flash-sale atau /promo)">
                      <Input
                        value={form.data.sync_banner_link_url ?? ""}
                        onChange={(event) => form.setData("sync_banner_link_url", event.target.value || null)}
                        placeholder={form.data.type === "flash_sale" ? "/flash-sale" : "/promo"}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <div className="flex h-6 items-center">
                        <Switch label="Aktifkan bar promo beranda" checked={form.data.sync_bar_promo} onCheckedChange={(checked) => form.setData("sync_bar_promo", checked)} />
                        <span className="ml-3 text-sm text-muted-foreground">Tampilkan juga baris bar promo di atas beranda selama kampanye live</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold">Waktu berlaku</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="promotion-starts" label="Mulai" error={form.errors.starts_at}>
              <Input type="datetime-local" value={form.data.starts_at} onChange={(event) => form.setData("starts_at", event.target.value)} />
            </Field>
            <Field id="promotion-ends" label="Selesai" error={form.errors.ends_at}>
              <Input type="datetime-local" value={form.data.ends_at} onChange={(event) => form.setData("ends_at", event.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">
            Kosongkan periode = berlaku terus (dibatasi aturan: hanya 1 Promo Toko aktif & 1 Flash Sale aktif).
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
