import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import { MASALAH_SOLUSI_MAX_MEDIA, countUsedSlots } from "@/lib/masalah-solusi-media"
import AdminLayout from "@/layouts/admin-layout"

interface PhotoItem {
  src: string
  alt: string
}

interface SolutionOption {
  title: string
  description: string
  icon: string
}

interface RecordItem {
  id?: number
  problem: string
  sort_order: number
  solution_body: string
  examples_label: string
  examples_hint: string
  photos: PhotoItem[]
  video: {
    src: string | null
    poster: string | null
    duration: string | null
    /** "library" berarti berkas dari Media Library, "url" berarti tautan luar. */
    source?: "library" | "url"
    asset_id?: number | null
  } | null
  solutions_label: string
  solution_lead: string
  solution_options: SolutionOption[]
  whatsapp_note: string
  use_options: boolean
}

interface PendingPhoto {
  assetId: string
  alt: string
  /** Thumbnail aset dari Media Library, dipakai sebagai pratinjau sebelum disimpan. */
  preview: string
}

const OPTION_ICONS = ["package", "wrench", "check-circle", "shield-check", "truck"] as const

export default function MasalahSolusiForm({
  item,
  submitUrl,
  indexUrl,
  method = "post",
  backUrl
}: {
  backUrl?: string | null
  item: RecordItem | null
  submitUrl: string
  indexUrl: string
  method?: "post" | "put"
}) {
  const editing = Boolean(item?.id)
  const [keptPhotos, setKeptPhotos] = React.useState<PhotoItem[]>(item?.photos ?? [])
  const [pendingPhotos, setPendingPhotos] = React.useState<PendingPhoto[]>([])
  const [options, setOptions] = React.useState<SolutionOption[]>(
    item?.solution_options?.length ? item.solution_options : [{ title: "", description: "", icon: "check-circle" }],
  )
  /** Tautan video luar dan poster hanya dibuka bila diperlukan. */
  const [showVideoSource, setShowVideoSource] = React.useState(false)
  /** Judul bagian sudah punya nilai bawaan, jadi cukup dibuka bila mau diubah. */
  const [showLabels, setShowLabels] = React.useState(false)
  const [showAdvanced, setShowAdvanced] = React.useState(
    Boolean(item?.use_options || item?.solution_lead || item?.whatsapp_note),
  )

  const form = useForm({
    problem: item?.problem ?? "",
    solution_body: item?.solution_body ?? "",
    examples_label: item?.examples_label ?? "Contoh kondisi kerusakan",
    examples_hint: item?.examples_hint ?? "",
    existing_photos: JSON.stringify(item?.photos ?? []),
    // Owner 2026-09-16: foto contoh & poster video hanya dari Media Library.
    media_asset_ids: [] as string[],
    photo_alts: [] as string[],
    // Video dari Media Library (berkas) atau tautan luar. Bila item tersimpan
    // berasal dari Library, pemilihnya sudah terisi supaya tidak perlu memilih ulang.
    media_video_asset_id:
      item?.video?.source === "library" && item?.video?.asset_id
        ? String(item.video.asset_id)
        : "",
    video_url: item?.video?.source === "url" ? (item?.video?.src ?? "") : "",
    video_duration: item?.video?.duration ?? "",
    video_poster_asset_id: "",
    remove_video_poster: false,
    solutions_label: item?.solutions_label ?? "Solusi yang kami tawarkan",
    solution_lead: item?.solution_lead ?? "",
    use_options: item?.use_options ?? false,
    solution_options: JSON.stringify(item?.solution_options ?? []),
    whatsapp_note: item?.whatsapp_note ?? "",
    sort_order: item?.sort_order ?? 0,
  })

  const [photoPickerOpen, setPhotoPickerOpen] = React.useState(false)
  const [videoPickerOpen, setVideoPickerOpen] = React.useState(false)
  const [posterPickerOpen, setPosterPickerOpen] = React.useState(false)

  const videoPosterPreview = item?.video?.poster ?? null
  // Batas media dihitung dari slot: foto dan video sama-sama satu slot.
  const videoSlotFilled = Boolean(form.data.media_video_asset_id || form.data.video_url.trim())
  const usedSlots = countUsedSlots([
    keptPhotos.length + pendingPhotos.length,
    videoSlotFilled ? 1 : 0,
  ])
  const photoSlotsFull = keptPhotos.length + pendingPhotos.length >= MASALAH_SOLUSI_MAX_MEDIA
  const mediaFull = usedSlots >= MASALAH_SOLUSI_MAX_MEDIA
  const canAddVideo = !videoSlotFilled && keptPhotos.length + pendingPhotos.length < MASALAH_SOLUSI_MAX_MEDIA

  /**
   * Tambah beberapa aset sekaligus (pemilih media bisa memilih banyak). Batas
   * slot ditegakkan di sini, bukan hanya di server, supaya admin tidak sempat
   * menyusun lebih dari jatah lalu ditolak saat menyimpan. Sisa jatah dihitung
   * dari daftar terbaru, bukan dari state yang belum tentu sudah diperbarui.
   */
  function addMediaAssets(assets: Array<{ assetId: string; label: string; preview: string }>) {
    setPendingPhotos((current) => {
      const next = [...current]
      for (const asset of assets) {
        if (next.length >= MASALAH_SOLUSI_MAX_MEDIA) break
        if (!asset.assetId || next.some((p) => p.assetId === asset.assetId)) continue
        next.push({ assetId: asset.assetId, alt: asset.label, preview: asset.preview })
      }
      form.setData("media_asset_ids", next.map((p) => p.assetId))
      form.setData("photo_alts", next.map((p) => p.alt))
      return next
    })
  }

  function removePendingPhoto(index: number) {
    const next = pendingPhotos.filter((_, i) => i !== index)
    setPendingPhotos(next)
    form.setData("media_asset_ids", next.map((photo) => photo.assetId))
    form.setData("photo_alts", next.map((photo) => photo.alt))
  }

  function updatePendingAlt(index: number, alt: string) {
    const next = pendingPhotos.map((photo, i) => (i === index ? { ...photo, alt } : photo))
    setPendingPhotos(next)
    form.setData(
      "photo_alts",
      next.map((photo) => photo.alt),
    )
  }

  function removeKeptPhoto(index: number) {
    const next = keptPhotos.filter((_, i) => i !== index)
    setKeptPhotos(next)
    form.setData("existing_photos", JSON.stringify(next))
  }

  function updateKeptAlt(index: number, alt: string) {
    const next = keptPhotos.map((photo, i) => (i === index ? { ...photo, alt } : photo))
    setKeptPhotos(next)
    form.setData("existing_photos", JSON.stringify(next))
  }

  function updateOption(index: number, patch: Partial<SolutionOption>) {
    setOptions((current) => current.map((option, i) => (i === index ? { ...option, ...patch } : option)))
  }

  function addOption() {
    setOptions((current) => [...current, { title: "", description: "", icon: "check-circle" }])
  }

  function removeOption(index: number) {
    setOptions((current) => current.filter((_, i) => i !== index))
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    form.transform((data) => ({
      ...data,
      existing_photos: JSON.stringify(keptPhotos),
      solution_options: JSON.stringify(options.filter((option) => option.title.trim() !== "")),
      media_asset_ids: pendingPhotos.map((photo) => photo.assetId),
      photo_alts: pendingPhotos.map((photo) => photo.alt),
    }))

    if (method === "put") {
      form.transform((data) => ({ ...data, _method: "put" }))
      form.post(submitUrl, {
        forceFormData: true,
        preserveScroll: true,
        onFinish: () => form.transform((data) => data),
      })
      return
    }

    form.post(submitUrl, { forceFormData: true, preserveScroll: true })
  }

  return (
    <AdminLayout
      backUrl={backUrl}
      title={editing ? "Edit Masalah & Solusi" : "Tambah Masalah & Solusi"}
      description="Unggah foto/video dokumentasi masalah dan tulis rekomendasi solusi untuk halaman publik."
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" form="masalah-solusi-form" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Masalah & Solusi | Admin`} />

      <form id="masalah-solusi-form" className="space-y-5" onSubmit={onSubmit}>
        <FormErrorSummary errors={form.errors} />

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">Masalah pelanggan</h2>
          </div>
          <div className="p-4 sm:p-5">
          <div
            className={
              editing
                ? "grid gap-4"
                : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start"
            }
          >
            <Field id="ms-problem" label="Deskripsi masalah" required error={form.errors.problem}>
              <Textarea
                rows={5}
                value={form.data.problem}
                onChange={(event) => form.setData("problem", event.target.value)}
                placeholder="Contoh: Barang rusak saat pengiriman…"
              />
            </Field>
            {!editing ? (
              <Field
                id="ms-sort"
                label="Urutan tampil"
                error={form.errors.sort_order}
                hint="Angka kecil tampil lebih dulu. Urutan juga bisa diubah lewat tombol Urutkan di halaman daftar."
              >
                <Input
                  type="number"
                  min={0}
                  value={form.data.sort_order}
                  onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                  className="max-w-xs"
                />
              </Field>
            ) : null}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">Media contoh</h2>
            <p className="text-xs text-muted-foreground">
              {usedSlots} dari {MASALAH_SOLUSI_MAX_MEDIA} media terpakai
            </p>
          </div>
          <div className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            Maksimal {MASALAH_SOLUSI_MAX_MEDIA} media per item, boleh foto atau video.
            Ukuran rekomendasi: sisi terpanjang 1200 sampai 1600 px, rasio bebas, maksimal 5 MB.
          </p>

          <div className="mt-4 space-y-4">
            {keptPhotos.length || pendingPhotos.length || videoSlotFilled ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {keptPhotos.map((photo, index) => (
                  <div key={photo.src} className="min-w-0 rounded-lg border border-border p-3">
                    {/* Pratinjau mengikuti rasio asli berkas supaya admin melihat bentuk
                        yang benar-benar tampil di halaman publik. */}
                    <div className="flex items-center justify-center overflow-hidden rounded-md bg-muted/40 p-1">
                      <img
                        src={photo.src}
                        alt={photo.alt || "Media contoh"}
                        className="max-h-52 w-auto max-w-full rounded object-contain"
                      />
                    </div>
                    <Input
                      className="mt-2"
                      value={photo.alt}
                      onChange={(event) => updateKeptAlt(index, event.target.value)}
                      placeholder="Keterangan media"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="mt-2 text-destructive"
                      onClick={() => removeKeptPhoto(index)}
                    >
                      Hapus media
                    </Button>
                  </div>
                ))}

                {pendingPhotos.map((photo, index) => (
                  <div key={photo.assetId} className="min-w-0 rounded-lg border border-dashed border-border p-3">
                    <div className="flex items-center justify-center overflow-hidden rounded-md bg-muted/40 p-1">
                      {photo.preview ? (
                        <img
                          src={photo.preview}
                          alt={photo.alt || "Media baru dari Media Library"}
                          className="max-h-52 w-auto max-w-full rounded object-contain"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                          Media #{photo.assetId}
                        </div>
                      )}
                    </div>
                    <Input
                      className="mt-2"
                      value={photo.alt}
                      onChange={(event) => updatePendingAlt(index, event.target.value)}
                      placeholder="Keterangan media"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="mt-2 text-destructive"
                      onClick={() => removePendingPhoto(index)}
                    >
                      Batalkan pilihan
                    </Button>
                  </div>
                ))}

                {videoSlotFilled ? (
                  <div className="min-w-0 rounded-lg border border-border p-3">
                    {videoPosterPreview ? (
                      <div className="flex items-center justify-center overflow-hidden rounded-md bg-muted/40 p-1">
                        <img
                          src={videoPosterPreview}
                          alt="Poster video"
                          className="max-h-52 w-auto max-w-full rounded object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-32 items-center justify-center gap-2 rounded-md bg-muted/40 text-xs text-muted-foreground">
                        <Icon name="video" className="size-4" aria-hidden="true" />
                        Video terpasang
                      </div>
                    )}
                    <p className="mt-2 text-xs font-semibold text-foreground">
                      {form.data.media_video_asset_id
                        ? "Berkas video dari Media Library"
                        : "Tautan video luar"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {form.data.media_video_asset_id
                        ? "Media #" + form.data.media_video_asset_id
                        : form.data.video_url || "Belum ada tautan"}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="mt-2 text-destructive"
                      onClick={() => {
                        form.setData("media_video_asset_id", "")
                        form.setData("video_url", "")
                        form.setData("video_duration", "")
                        form.setData("video_poster_asset_id", "")
                        form.setData("remove_video_poster", true)
                      }}
                    >
                      Hapus video
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!mediaFull ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {!photoSlotsFull ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPhotoPickerOpen(true)}
                    className="inline-flex w-fit items-center gap-1.5"
                  >
                    <Icon name="plus" className="size-3.5" aria-hidden="true" />
                    <span>Tambah foto</span>
                  </Button>
                ) : null}
                {canAddVideo ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setVideoPickerOpen(true)}
                    className="inline-flex w-fit items-center gap-1.5"
                  >
                    <Icon name="video" className="size-3.5" aria-hidden="true" />
                    <span>{form.data.media_video_asset_id ? "Ganti video" : "Tambah video"}</span>
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Slot media sudah penuh. Hapus salah satu media dulu untuk menambah lagi.
              </p>
            )}

            {/* Tautan video luar hanya perlu sesekali, jadi disembunyikan di balik tautan kecil. */}
            {!videoSlotFilled ? (
              <button
                type="button"
                onClick={() => setShowVideoSource((current) => !current)}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                {showVideoSource ? "Tutup tautan video luar" : "Atau tempel tautan video luar (YouTube)"}
              </button>
            ) : null}

            {videoSlotFilled || showVideoSource ? (
              <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="ms-video-url" label="Tautan video luar" error={form.errors.video_url}>
                    <Input
                      value={form.data.video_url}
                      onChange={(event) => {
                        form.setData("video_url", event.target.value)
                        if (event.target.value.trim() !== "") {
                          form.setData("media_video_asset_id", "")
                        }
                      }}
                      placeholder="https://youtube.com/..."
                    />
                  </Field>
                  <Field id="ms-video-duration" label="Durasi video" error={form.errors.video_duration}>
                    <Input
                      value={form.data.video_duration}
                      onChange={(event) => form.setData("video_duration", event.target.value)}
                      placeholder="02:37"
                    />
                  </Field>
                </div>

                {videoSlotFilled ? (
                  <Field
                    id="ms-video-poster"
                    label="Poster video (opsional)"
                    error={form.errors.video_poster_asset_id}
                    hint="Bila kosong, poster diambil dari berkas video itu sendiri."
                  >
                    {videoPosterPreview ? (
                      <div className="space-y-2">
                        <img
                          src={videoPosterPreview}
                          alt="Poster video"
                          className="max-h-40 w-auto max-w-full rounded border border-border object-contain"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() => {
                            form.setData("video_poster_asset_id", "")
                            form.setData("remove_video_poster", true)
                          }}
                        >
                          Hapus poster
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPosterPickerOpen(true)}
                        className="inline-flex w-fit items-center gap-1.5"
                      >
                        <Icon name="image" className="size-3.5" aria-hidden="true" />
                        <span>{form.data.video_poster_asset_id ? "Ganti poster" : "Pilih poster"}</span>
                      </Button>
                    )}
                  </Field>
                ) : null}
              </div>
            ) : null}

            {/* Judul bagian sudah punya nilai bawaan, jadi cukup dibuka bila mau diubah. */}
            <div className="border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowLabels((current) => !current)}
                className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {showLabels ? "Tutup judul bagian" : "Atur judul bagian dan teks pengganti"}
              </button>

              {showLabels ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field
                    id="ms-examples-label"
                    label="Judul bagian media"
                    error={form.errors.examples_label}
                  >
                    <Input
                      value={form.data.examples_label}
                      onChange={(event) => form.setData("examples_label", event.target.value)}
                    />
                  </Field>
                  <Field
                    id="ms-examples-hint"
                    label="Teks pengganti bila belum ada media"
                    error={form.errors.examples_hint}
                  >
                    <Textarea
                      rows={2}
                      value={form.data.examples_hint}
                      onChange={(event) => form.setData("examples_hint", event.target.value)}
                      placeholder="Contoh: retak pada bingkai, goresan kaca, dll."
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <h2 className="text-sm font-bold text-foreground">Solusi / rekomendasi</h2>
          </div>
          <div className="p-4 sm:p-5">
          <div className="space-y-4">
            <Field id="ms-solution-body" label="Teks solusi" error={form.errors.solution_body}>
              <Textarea
                rows={8}
                value={form.data.solution_body}
                onChange={(event) => form.setData("solution_body", event.target.value)}
                placeholder="Jelaskan langkah atau rekomendasi Ragil untuk masalah ini…"
              />
            </Field>

            <CheckboxField
              id="ms-show-advanced"
              checked={showAdvanced}
              onChange={(checked) => setShowAdvanced(checked)}
              label="Tampilkan opsi lanjutan (daftar solusi, lead, WhatsApp)"
              standalone
            />

            {showAdvanced ? (
              <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
                <Field id="ms-solutions-label" label="Judul bagian solusi" error={form.errors.solutions_label}>
                  <Input
                    value={form.data.solutions_label}
                    onChange={(event) => form.setData("solutions_label", event.target.value)}
                  />
                </Field>
                <Field id="ms-solution-lead" label="Paragraf pembuka solusi" error={form.errors.solution_lead}>
                  <Textarea
                    rows={2}
                    value={form.data.solution_lead}
                    onChange={(event) => form.setData("solution_lead", event.target.value)}
                  />
                </Field>

                <CheckboxField
                  id="ms-use-options"
                  checked={form.data.use_options}
                  onChange={(checked) => form.setData("use_options", checked)}
                  label="Gunakan daftar opsi solusi (kartu bernomor)"
                  standalone
                />

                {form.data.use_options ? (
                  <div className="space-y-3">
                    {options.map((option, index) => (
                      <div key={index} className="rounded-lg border border-border bg-card p-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={option.title}
                            onChange={(event) => updateOption(index, { title: event.target.value })}
                            placeholder={`Opsi ${index + 1}`}
                          />
                          <select
                            value={option.icon}
                            onChange={(event) => updateOption(index, { icon: event.target.value })}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {OPTION_ICONS.map((icon) => (
                              <option key={icon} value={icon}>
                                {icon}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Textarea
                          className="mt-2"
                          rows={2}
                          value={option.description}
                          onChange={(event) => updateOption(index, { description: event.target.value })}
                          placeholder="Deskripsi opsi"
                        />
                        {options.length > 1 ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            className="mt-2 text-destructive"
                            onClick={() => removeOption(index)}
                          >
                            Hapus opsi
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="sm" onClick={addOption}>
                      Tambah
                    </Button>
                  </div>
                ) : null}

                <Field
                  id="ms-whatsapp-note"
                  label="Catatan WhatsApp"
                  error={form.errors.whatsapp_note}
                  hint='Gunakan kata "WhatsApp" untuk tautan otomatis ke konsultasi.'
                >
                  <Textarea
                    rows={2}
                    value={form.data.whatsapp_note}
                    onChange={(event) => form.setData("whatsapp_note", event.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </div>
          </div>
        </section>
      </form>

      <MediaPicker
        open={photoPickerOpen}
        onClose={() => setPhotoPickerOpen(false)}
        multiple
        kind="image"
        title="Pilih Foto Contoh Kerusakan"
        onPick={(picked) => {
          addMediaAssets(
            picked.map((asset) => ({
              assetId: String(asset.assetId),
              label: asset.label,
              preview: asset.thumbUrl ?? "",
            })),
          )
          setPhotoPickerOpen(false)
        }}
      />

      <MediaPicker
        open={posterPickerOpen}
        onClose={() => setPosterPickerOpen(false)}
        multiple={false}
        kind="image"
        title="Pilih Poster Video"
        onPick={(picked) => {
          const asset = picked[0]
          if (!asset) return
          form.setData("video_poster_asset_id", String(asset.assetId))
          form.setData("remove_video_poster", false)
          setPosterPickerOpen(false)
        }}
      />

      <MediaPicker
        open={videoPickerOpen}
        onClose={() => setVideoPickerOpen(false)}
        multiple={false}
        kind="video"
        title="Pilih Video dari Media Library"
        onPick={(picked) => {
          const asset = picked[0]
          if (!asset) return
          form.setData("media_video_asset_id", String(asset.assetId))
          form.setData("video_url", "")
          form.setData("remove_video_poster", false)
          setVideoPickerOpen(false)
        }}
      />
    </AdminLayout>
  )
}
