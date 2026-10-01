import { Head, Link, useForm } from "@inertiajs/react"
import * as React from "react"

import { MediaPicker } from "@/components/admin/media-picker"
import { Icon } from "@/components/shared/icon"
import { Button } from "@/components/admin/ui/button"
import { CheckboxField, Field, FormErrorSummary } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Textarea } from "@/components/admin/ui/textarea"
import {
  MASALAH_SOLUSI_MAX_MEDIA,
  isMediaLimitReached,
  type MasalahSolusiMedia,
  type MasalahSolusiMediaKind,
} from "@/lib/masalah-solusi-media"
import AdminLayout from "@/layouts/admin-layout"

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
  /** Satu daftar media berurutan, tanpa memisah foto dan video. */
  media: MasalahSolusiMedia[]
  solutions_label: string
  solution_lead: string
  solution_options: SolutionOption[]
  whatsapp_note: string
  use_options: boolean
}

/**
 * Satu media di form. Entri "simpan" sudah ada di server (dibawa saat
 * menyunting), entri "baru" baru dipilih dari Media Library dan belum
 * tersimpan.
 */
interface DaftarMedia {
  sumber: "simpan" | "baru"
  kind: MasalahSolusiMediaKind
  alt: string
  /** Pratinjau: tautan aset lama, atau thumbnail aset yang baru dipilih. */
  preview: string
  /** Nama berkas aset, dipakai sebagai keterangan kecil di kartu. */
  label?: string | null
  assetId?: number | null
  src?: string
  width?: number | null
  height?: number | null
  poster?: string | null
  source?: "library" | "url"
}

const OPTION_ICONS = ["package", "wrench", "check-circle", "shield-check", "truck"] as const

export default function MasalahSolusiForm({
  item,
  nextSortOrder = 1,
  submitUrl,
  indexUrl,
  method = "post",
  backUrl
}: {
  backUrl?: string | null
  item: RecordItem | null
  /** Nomor urut usulan untuk item baru (selalu di bawah item yang ada). */
  nextSortOrder?: number
  submitUrl: string
  indexUrl: string
  method?: "post" | "put"
}) {
  const editing = Boolean(item?.id)
  // Media disimpan sebagai SATU daftar berurutan (kontrak owner 2026-09-30):
  // urutan di sini sama dengan urutan tampil di halaman publik.
  const [daftarMedia, setDaftarMedia] = React.useState<DaftarMedia[]>(
    (item?.media ?? []).map((media) => ({
      sumber: "simpan" as const,
      kind: media.kind,
      alt: media.alt ?? "",
      preview: media.kind === "video" ? (media.poster ?? "") : media.src,
      label: null,
      assetId: media.assetId ?? null,
      src: media.src,
      width: media.width ?? null,
      height: media.height ?? null,
      poster: media.poster ?? null,
      source: media.source,
    })),
  )
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false)
  const [options, setOptions] = React.useState<SolutionOption[]>(
    item?.solution_options?.length ? item.solution_options : [{ title: "", description: "", icon: "check-circle" }],
  )
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
    // Media dikirim sebagai satu daftar berurutan (lihat onSubmit).
    media: "",
    solutions_label: item?.solutions_label ?? "Solusi yang kami tawarkan",
    solution_lead: item?.solution_lead ?? "",
    use_options: item?.use_options ?? false,
    solution_options: JSON.stringify(item?.solution_options ?? []),
    whatsapp_note: item?.whatsapp_note ?? "",
    sort_order: item?.sort_order ?? nextSortOrder,
  })

  const mediaFull = isMediaLimitReached(daftarMedia.length)

  /**
   * Tambah media pilihan admin. Batas jumlah ditegakkan di sini juga, bukan
   * hanya di server, supaya admin tidak sempat menyusun lebih dari jatah lalu
   * ditolak saat menyimpan.
   */
  function tambahMedia(
    aset: Array<{ assetId: string; kind: MasalahSolusiMediaKind; label: string; preview: string }>,
  ) {
    setDaftarMedia((current) => {
      const next = [...current]
      for (const satu of aset) {
        if (next.length >= MASALAH_SOLUSI_MAX_MEDIA) break
        if (!satu.assetId || next.some((m) => String(m.assetId ?? "") === satu.assetId)) continue
        next.push({
          sumber: "baru",
          kind: satu.kind,
          alt: satu.label,
          preview: satu.preview,
          label: satu.label,
          assetId: Number(satu.assetId),
        })
      }
      return next
    })
  }

  function hapusMedia(index: number) {
    setDaftarMedia((current) => current.filter((_, i) => i !== index))
  }

  function ubahAltMedia(index: number, alt: string) {
    setDaftarMedia((current) => current.map((media, i) => (i === index ? { ...media, alt } : media)))
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
      solution_options: JSON.stringify(options.filter((option) => option.title.trim() !== "")),
      // Satu daftar berurutan. Entri dengan asset_id diambil ulang dari Media
      // Library oleh server (tautan dan ukurannya ikut segar); entri lama tanpa
      // asset_id dibawa apa adanya supaya tidak hilang saat menyunting.
      media: JSON.stringify(
        daftarMedia.map((media) => ({
          asset_id: media.assetId ?? null,
          alt: media.alt,
          kind: media.kind,
          src: media.src,
          width: media.width ?? null,
          height: media.height ?? null,
          poster: media.poster ?? null,
          source: media.source,
        })),
      ),
      // Urutan hanya diisi saat membuat; saat mengedit biarkan nomor lama di
      // server yang berlaku (field-nya pun tidak ditampilkan), supaya nilai
      // warisan yang kebetulan 0 tidak menabrak validasi min:1.
      ...(item ? { sort_order: undefined } : {}),
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
      description="Pilih media dokumentasi masalah dari Media Library dan tulis rekomendasi solusi untuk halaman publik."
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
                hint="Angka 1 tampil paling awal. Item baru otomatis ditaruh paling belakang. Urutan juga bisa diubah lewat tombol Urutkan di halaman daftar."
              >
                <Input
                  type="number"
                  min={1}
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
              {daftarMedia.length} dari {MASALAH_SOLUSI_MAX_MEDIA} media terpakai
            </p>
          </div>
          <div className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">
            Maksimal {MASALAH_SOLUSI_MAX_MEDIA} media per item; bebas diisi foto, video, atau campuran keduanya.
            Ukuran rekomendasi: sisi terpanjang 1200 sampai 1600 px, rasio bebas, maksimal 5 MB.
          </p>

          <div className="mt-4 space-y-4">
            {daftarMedia.length ? (
              // Satu daftar seragam untuk semua jenis media, urut sesuai
              // pilihan admin. Kartu video dan foto memakai bentuk yang sama
              // supaya tidak ada dua model tampilan di halaman yang sama.
              <div className="grid gap-3 sm:grid-cols-2">
                {daftarMedia.map((media, index) => (
                  <div
                    key={`${media.sumber}-${media.assetId ?? media.src}-${index}`}
                    className="min-w-0 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center justify-center overflow-hidden rounded-md bg-muted/40 p-1">
                      {media.preview ? (
                        <img
                          src={media.preview}
                          alt={media.alt || "Media contoh"}
                          className="max-h-52 w-auto max-w-full rounded object-contain"
                        />
                      ) : (
                        <div className="flex h-32 items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Icon name={media.kind === "video" ? "video" : "image"} className="size-4" aria-hidden="true" />
                          {media.label || (media.kind === "video" ? "Video" : "Media")}
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Icon name={media.kind === "video" ? "video" : "image"} className="size-3.5" aria-hidden="true" />
                      <span>{media.kind === "video" ? "Video" : "Foto"}</span>
                      {media.label ? <span className="truncate font-normal">· {media.label}</span> : null}
                    </p>
                    <Input
                      className="mt-2"
                      value={media.alt}
                      onChange={(event) => ubahAltMedia(index, event.target.value)}
                      placeholder="Keterangan media (opsional)"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="xs"
                      className="mt-2 text-destructive"
                      onClick={() => hapusMedia(index)}
                    >
                      Hapus media
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {!mediaFull ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setMediaPickerOpen(true)}
                className="inline-flex w-fit items-center gap-1.5"
              >
                <Icon name="plus" className="size-3.5" aria-hidden="true" />
                <span>Tambah media</span>
              </Button>
            ) : (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Media sudah penuh (maksimal {MASALAH_SOLUSI_MAX_MEDIA}). Hapus salah satu dulu untuk menambah lagi.
              </p>
            )}

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
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        multiple
        title="Tambah media contoh"
        onPick={(picked) => {
          tambahMedia(
            picked.map((asset) => ({
              assetId: String(asset.assetId),
              kind: asset.kind === "video" ? "video" : "image",
              label: asset.label,
              preview: asset.thumbUrl ?? "",
            })),
          )
          setMediaPickerOpen(false)
        }}
      />
    </AdminLayout>
  )
}
