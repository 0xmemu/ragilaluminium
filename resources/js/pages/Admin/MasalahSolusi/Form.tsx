import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/ui/button"
import { Field, FormErrorSummary } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ResponsiveImage } from "@/components/ui/responsive-image"
import { Textarea } from "@/components/ui/textarea"
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
  video: { src: string | null; poster: string | null; duration: string | null } | null
  solutions_label: string
  solution_lead: string
  solution_options: SolutionOption[]
  whatsapp_note: string
  use_options: boolean
}

interface PendingPhoto {
  file: File
  alt: string
  preview: string
}

const OPTION_ICONS = ["package", "wrench", "check-circle", "shield-check", "truck"] as const

export default function MasalahSolusiForm({
  item,
  submitUrl,
  indexUrl,
  method = "post",
}: {
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
  const [showAdvanced, setShowAdvanced] = React.useState(
    Boolean(item?.use_options || item?.solution_lead || item?.whatsapp_note),
  )

  const form = useForm({
    problem: item?.problem ?? "",
    solution_body: item?.solution_body ?? "",
    examples_label: item?.examples_label ?? "Contoh kondisi kerusakan",
    examples_hint: item?.examples_hint ?? "",
    existing_photos: JSON.stringify(item?.photos ?? []),
    photo_files: [] as File[],
    photo_alts: [] as string[],
    video_url: item?.video?.src ?? "",
    video_duration: item?.video?.duration ?? "",
    video_poster: null as File | null,
    remove_video_poster: false,
    solutions_label: item?.solutions_label ?? "Solusi yang kami tawarkan",
    solution_lead: item?.solution_lead ?? "",
    use_options: item?.use_options ?? false,
    solution_options: JSON.stringify(item?.solution_options ?? []),
    whatsapp_note: item?.whatsapp_note ?? "",
    sort_order: item?.sort_order ?? 0,
  })

  const videoPosterPreview = React.useMemo(() => {
    if (form.data.video_poster) return URL.createObjectURL(form.data.video_poster)
    if (!form.data.remove_video_poster && item?.video?.poster) return item.video.poster
    return null
  }, [form.data.video_poster, form.data.remove_video_poster, item?.video?.poster])

  React.useEffect(() => {
    return () => {
      pendingPhotos.forEach((photo) => URL.revokeObjectURL(photo.preview))
      if (form.data.video_poster && videoPosterPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(videoPosterPreview)
      }
    }
  }, [pendingPhotos, form.data.video_poster, videoPosterPreview])

  function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const next = [...pendingPhotos]
    Array.from(files).forEach((file) => {
      next.push({ file, alt: "", preview: URL.createObjectURL(file) })
    })
    setPendingPhotos(next)
    form.setData(
      "photo_files",
      next.map((photo) => photo.file),
    )
    form.setData(
      "photo_alts",
      next.map((photo) => photo.alt),
    )
  }

  function removePendingPhoto(index: number) {
    const next = pendingPhotos.filter((_, i) => i !== index)
    URL.revokeObjectURL(pendingPhotos[index].preview)
    setPendingPhotos(next)
    form.setData(
      "photo_files",
      next.map((photo) => photo.file),
    )
    form.setData(
      "photo_alts",
      next.map((photo) => photo.alt),
    )
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
      photo_files: pendingPhotos.map((photo) => photo.file),
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
      title={editing ? "Edit Masalah & Solusi" : "Tambah Masalah & Solusi"}
      description="Unggah foto/video dokumentasi masalah dan tulis rekomendasi solusi untuk halaman publik."
      actions={
        <Button asChild variant="secondary">
          <Link href={indexUrl}>
            <Icon name="arrow-left" className="size-4" aria-hidden="true" />
            Kembali
          </Link>
        </Button>
      }
    >
      <Head title={`${editing ? "Edit" : "Tambah"} Masalah & Solusi | Admin`} />

      <form className="mx-auto max-w-5xl space-y-6" onSubmit={onSubmit}>
        <FormErrorSummary errors={form.errors} />

        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-bold">Masalah pelanggan</h2>
          <div className="mt-4 space-y-4">
            <Field id="ms-problem" label="Deskripsi masalah" required error={form.errors.problem}>
              <Textarea
                rows={4}
                value={form.data.problem}
                onChange={(event) => form.setData("problem", event.target.value)}
                placeholder="Contoh: Barang rusak saat pengiriman…"
              />
            </Field>
            <Field id="ms-sort" label="Urutan tampil" error={form.errors.sort_order}>
              <Input
                type="number"
                min={0}
                value={form.data.sort_order}
                onChange={(event) => form.setData("sort_order", Number(event.target.value))}
                className="max-w-xs"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-bold">Contoh dokumentasi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Foto atau video yang membantu pelanggan mengenali kondisi masalah. Ditampilkan di accordion halaman publik.
          </p>

          <div className="mt-4 space-y-4">
            <Field id="ms-examples-label" label="Judul bagian contoh" error={form.errors.examples_label}>
              <Input
                value={form.data.examples_label}
                onChange={(event) => form.setData("examples_label", event.target.value)}
              />
            </Field>
            <Field
              id="ms-examples-hint"
              label="Teks pengganti (jika belum ada foto)"
              error={form.errors.examples_hint}
              hint="Opsional. Muncul bila belum ada foto diunggah."
            >
              <Textarea
                rows={2}
                value={form.data.examples_hint}
                onChange={(event) => form.setData("examples_hint", event.target.value)}
                placeholder="Contoh: retak pada bingkai, goresan kaca, dll."
              />
            </Field>

            <div>
              <p className="text-sm font-semibold">Foto contoh</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {keptPhotos.map((photo, index) => (
                  <div key={photo.src} className="rounded-lg border border-border p-3">
                    <ResponsiveImage
                      src={photo.src}
                      alt={photo.alt || "Foto contoh"}
                      wrapperClassName="aspect-[4/3] overflow-hidden rounded-md bg-muted"
                      className="object-cover"
                    />
                    <Input
                      className="mt-2"
                      value={photo.alt}
                      onChange={(event) => updateKeptAlt(index, event.target.value)}
                      placeholder="Keterangan foto"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="mt-2 text-destructive"
                      onClick={() => removeKeptPhoto(index)}
                    >
                      Hapus foto
                    </Button>
                  </div>
                ))}
                {pendingPhotos.map((photo, index) => (
                  <div key={photo.preview} className="rounded-lg border border-dashed border-border p-3">
                    <ResponsiveImage
                      src={photo.preview}
                      alt="Pratinjau unggahan"
                      wrapperClassName="aspect-[4/3] overflow-hidden rounded-md bg-muted"
                      className="object-cover"
                    />
                    <Input
                      className="mt-2"
                      value={photo.alt}
                      onChange={(event) => updatePendingAlt(index, event.target.value)}
                      placeholder="Keterangan foto"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="mt-2 text-destructive"
                      onClick={() => removePendingPhoto(index)}
                    >
                      Batalkan unggahan
                    </Button>
                  </div>
                ))}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/50">
                <Icon name="image" className="size-4" aria-hidden="true" />
                Tambah foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => {
                    addPhotos(event.target.files)
                    event.target.value = ""
                  }}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="ms-video-url"
                label="URL video (YouTube / file)"
                error={form.errors.video_url}
                hint="Opsional. Link video tutorial atau dokumentasi."
              >
                <Input
                  value={form.data.video_url}
                  onChange={(event) => form.setData("video_url", event.target.value)}
                  placeholder="https://..."
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

            <Field id="ms-video-poster" label="Poster video" error={form.errors.video_poster}>
              {videoPosterPreview ? (
                <div className="space-y-2">
                  <ResponsiveImage
                    src={videoPosterPreview}
                    alt="Poster video"
                    wrapperClassName="aspect-video max-w-md overflow-hidden rounded-lg border border-border bg-muted"
                    className="object-cover"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="xs"
                    onClick={() => {
                      form.setData("video_poster", null)
                      form.setData("remove_video_poster", true)
                    }}
                  >
                    Hapus poster
                  </Button>
                </div>
              ) : (
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    form.setData("video_poster", file)
                    form.setData("remove_video_poster", false)
                  }}
                />
              )}
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm sm:p-7">
          <h2 className="text-base font-bold">Solusi / rekomendasi</h2>
          <div className="mt-4 space-y-4">
            <Field id="ms-solution-body" label="Teks solusi" error={form.errors.solution_body}>
              <Textarea
                rows={6}
                value={form.data.solution_body}
                onChange={(event) => form.setData("solution_body", event.target.value)}
                placeholder="Jelaskan langkah atau rekomendasi Ragil untuk masalah ini…"
              />
            </Field>

            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(event) => setShowAdvanced(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Tampilkan opsi lanjutan (daftar solusi, lead, WhatsApp)
            </label>

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

                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={form.data.use_options}
                    onChange={(event) => form.setData("use_options", event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Gunakan daftar opsi solusi (kartu bernomor)
                </label>

                {form.data.use_options ? (
                  <div className="space-y-3">
                    {options.map((option, index) => (
                      <div key={index} className="rounded-lg border border-border bg-surface p-3">
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
                      Tambah opsi
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
        </section>

        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary">
            <Link href={indexUrl}>Batal</Link>
          </Button>
          <Button type="submit" disabled={form.processing}>
            {form.processing ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </form>
    </AdminLayout>
  )
}
