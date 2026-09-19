import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Field } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { Select } from "@/components/admin/ui/select"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Switch } from "@/components/admin/ui/switch"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

interface CtaAction {
  label: string
  destination: string
  variant: string
}

interface CtaBlock {
  key: string
  label: string
  eyebrow: string
  heading: string
  actions: CtaAction[]
  preview_url: string | null
}

interface DestinationOption {
  value: string
  label: string
}

/**
 * Blok yang BUKAN banner penutup: kartu reusable di halaman transaksi.
 * Label kolomnya berbeda karena isinya judul + keterangan, bukan kop + judul
 * ajakan. Blok ini juga umumnya tanpa tombol.
 */
const REUSABLE_BLOCKS: Record<string, { judul: string; isi: string; hintIsi: string }> = {
  trust: {
    judul: "Judul kartu",
    isi: "Keterangan",
    hintIsi: "Kalimat penjelas di bawah judul kartu.",
  },
  "order-help": {
    judul: "Judul bantuan",
    isi: "Keterangan",
    hintIsi: "Kalimat penjelas di bawah judul bantuan.",
  },
}

const MAX_ACTIONS = 2
const DEFAULT_COLOR = "#C00000"

/**
 * Editor CTA storefront.
 *
 * Dua mode (kontrak ADR-023): halaman dibuka dalam mode RINGKASAN read-only,
 * form aktif setelah admin menekan "Ubah teks CTA", dan Simpan kembali ke
 * ringkasan.
 *
 * Setiap blok diringkas menjadi DUA BARIS supaya delapan blok tetap terbaca
 * tanpa menggulir panjang:
 *   Baris 1 (kepala): label, kunci, tautan pratinjau.
 *   Baris 2 (isi):    kolom teks di kiri, pratinjau CTA asli di kanan.
 * Di mode edit, baris 2 memuat editor tombol (tambah/hapus) di bawah kolom teks.
 *
 * Yang dapat diubah hanya teks, tombol, dan warna. Tujuan tombol dipilih dari
 * daftar preset, bukan URL bebas, supaya jalur konsultasi dan checkout tidak
 * bisa rusak karena salah menyalin tautan.
 */
export default function CtaStorefrontEdit({
  title,
  description,
  submitUrl,
  enabled,
  color,
  destinations,
  blocks,
}: {
  title: string
  description: string
  submitUrl: string
  enabled: boolean
  color: string
  destinations: DestinationOption[]
  blocks: CtaBlock[]
}) {
  const [mode, setMode] = React.useState<"view" | "edit">("view")

  const form = useForm({
    enabled,
    color: color || DEFAULT_COLOR,
    blocks: blocks.map((block) => ({
      key: block.key,
      eyebrow: block.eyebrow,
      heading: block.heading,
      actions: block.actions.map((a) => ({ ...a })),
    })),
  })

  function simpan() {
    form.put(submitUrl, {
      preserveScroll: true,
      onSuccess: () => setMode("view"),
    })
  }

  function setBlock(index: number, patch: Partial<{ eyebrow: string; heading: string; actions: CtaAction[] }>) {
    form.setData(
      "blocks",
      form.data.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    )
  }

  function setAction(blockIndex: number, actionIndex: number, patch: Partial<CtaAction>) {
    const block = form.data.blocks[blockIndex]
    setBlock(blockIndex, {
      actions: block.actions.map((a, i) => (i === actionIndex ? { ...a, ...patch } : a)),
    })
  }

  function removeAction(blockIndex: number, actionIndex: number) {
    const block = form.data.blocks[blockIndex]
    setBlock(blockIndex, { actions: block.actions.filter((_, i) => i !== actionIndex) })
  }

  function addAction(blockIndex: number) {
    const block = form.data.blocks[blockIndex]
    if (block.actions.length >= MAX_ACTIONS) return
    setBlock(blockIndex, {
      actions: [
        ...block.actions,
        {
          label: "",
          destination: destinations[0]?.value ?? "whatsapp",
          // Tombol pertama = aksi utama; tombol tambahan otomatis sekunder.
          variant: block.actions.length === 0 ? "primary" : "secondary",
        },
      ],
    })
  }

  const namaTujuan = (value: string) =>
    destinations.find((d) => d.value === value)?.label ?? value

  return (
    <AdminLayout
      title={title}
      description={description}
      backUrl={routeUrl("admin.dashboard")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={form.data.enabled ? "active" : "inactive"} />
          {mode === "view" ? (
            <Button type="button" size="sm" onClick={() => setMode("edit")}>
              <Icon name="pencil-simple" className="size-3.5" aria-hidden="true" />
              Ubah teks CTA
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setMode("view")}>
                Batal
              </Button>
              <Button type="submit" form="cta-storefront-form" size="sm" disabled={form.processing}>
                {form.processing ? "Menyimpan..." : "Simpan"}
              </Button>
            </>
          )}
        </div>
      }
    >
      <Head title={`${title} | Admin`} />

      <form
        id="cta-storefront-form"
        onSubmit={(event) => {
          event.preventDefault()
          simpan()
        }}
      >
        {/* Baris kendali: status, warna, dan tombol simpan cepat. Semua yang
            berlaku global untuk seluruh CTA dikumpulkan di satu tempat. */}
        <Card className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Switch
              checked={form.data.enabled}
              onCheckedChange={(checked) => {
                form.setData("enabled", checked)
                if (mode === "view") setMode("edit")
              }}
              label="Tampilkan CTA penutup"
              disabled={mode === "view"}
            />
            <span className="text-xs text-muted-foreground">
              {form.data.enabled
                ? "Banner tampil di seluruh halaman publik."
                : "Banner disembunyikan dari seluruh halaman publik."}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="cta-color"
              className="text-[11px] font-semibold text-muted-foreground"
            >
              Warna banner
            </label>
            <input
              id="cta-color"
              type="color"
              value={form.data.color}
              disabled={mode === "view"}
              onChange={(event) => form.setData("color", event.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-surface p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Warna banner CTA"
            />
            <span className="font-mono text-[11px] text-muted-foreground">{form.data.color}</span>
            {mode === "edit" && form.data.color.toUpperCase() !== DEFAULT_COLOR ? (
              <button
                type="button"
                onClick={() => form.setData("color", DEFAULT_COLOR)}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Kembalikan
              </button>
            ) : null}
          </div>
        </Card>

        <div className="space-y-2">
          {form.data.blocks.map((block, index) => {
            const meta = blocks.find((b) => b.key === block.key)
            const reusable = REUSABLE_BLOCKS[block.key]
            const labelJudul = reusable?.judul ?? "Kop kecil"
            const labelIsi = reusable?.isi ?? "Judul ajakan"

            return (
              <Card key={block.key} className="px-4 py-3">
                {/* BARIS 1 - kepala: identitas blok + tautan pratinjau */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <h2 className="text-xs font-semibold text-foreground">{meta?.label ?? block.key}</h2>
                    <span className="font-mono text-[11px] text-muted-foreground">{block.key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {block.actions.length} tombol
                    </span>
                    {meta?.preview_url ? (
                      <a
                        href={meta.preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        <Icon name="eye" className="size-3" aria-hidden="true" />
                        Lihat halaman
                      </a>
                    ) : null}
                  </div>
                </div>

                {/* BARIS 2 - isi: kolom teks/tombol di kiri, pratinjau asli di kanan */}
                <div className="mt-2.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                  <div className="space-y-2.5">
                    {mode === "view" ? (
                      <div className="grid gap-1 text-xs sm:grid-cols-[5.5rem_minmax(0,1fr)]">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {labelJudul}
                        </span>
                        <span className="font-medium text-foreground">{block.eyebrow || "-"}</span>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {labelIsi}
                        </span>
                        <span className="text-foreground">{block.heading || "-"}</span>
                      </div>
                    ) : (
                      <>
                        <Field
                          id={`eyebrow-${block.key}`}
                          label={labelJudul}
                          hint={
                            reusable
                              ? undefined
                              : "Baris kecil di atas judul. Kosongkan untuk memakai teks bawaan."
                          }
                          error={form.errors[`blocks.${index}.eyebrow`]}
                        >
                          <Input
                            id={`eyebrow-${block.key}`}
                            value={block.eyebrow}
                            onChange={(event) => setBlock(index, { eyebrow: event.target.value })}
                            placeholder="cth. Masih punya pertanyaan?"
                            maxLength={120}
                          />
                        </Field>
                        <Field
                          id={`heading-${block.key}`}
                          label={labelIsi}
                          hint={
                            reusable ? reusable.hintIsi : "Kalimat utama yang dibaca pengunjung."
                          }
                          error={form.errors[`blocks.${index}.heading`]}
                        >
                          <Input
                            id={`heading-${block.key}`}
                            value={block.heading}
                            onChange={(event) => setBlock(index, { heading: event.target.value })}
                            placeholder="cth. Tim kami siap membantu lewat WhatsApp"
                            maxLength={240}
                          />
                        </Field>
                      </>
                    )}

                    {/* Editor tombol: hanya di mode edit, supaya ringkasan tetap ringkas. */}
                    {mode === "edit" ? (
                      <div className="rounded-md border border-border bg-surface-muted/40 p-2.5">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                          Tombol (maksimal {MAX_ACTIONS})
                        </p>

                        {block.actions.length === 0 ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Blok ini tanpa tombol.
                          </p>
                        ) : (
                          <div className="mt-2 space-y-2">
                            {block.actions.map((action, ai) => (
                              <div
                                key={`${block.key}-${ai}`}
                                className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem_2rem]"
                              >
                                <Input
                                  value={action.label}
                                  onChange={(event) =>
                                    setAction(index, ai, { label: event.target.value })
                                  }
                                  placeholder="Label tombol"
                                  maxLength={40}
                                  aria-label={`Label tombol ${ai + 1} pada ${block.key}`}
                                />
                                <Select
                                  value={action.destination}
                                  onChange={(event) =>
                                    setAction(index, ai, { destination: event.target.value })
                                  }
                                  matchOptionWidth={false}
                                  aria-label={`Tujuan tombol ${ai + 1} pada ${block.key}`}
                                >
                                  {destinations.map((d) => (
                                    <option key={d.value} value={d.value}>
                                      {d.label}
                                    </option>
                                  ))}
                                </Select>
                                <Select
                                  value={action.variant}
                                  onChange={(event) =>
                                    setAction(index, ai, { variant: event.target.value })
                                  }
                                  matchOptionWidth={false}
                                  aria-label={`Gaya tombol ${ai + 1} pada ${block.key}`}
                                >
                                  <option value="primary">Utama</option>
                                  <option value="secondary">Sekunder</option>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => removeAction(index, ai)}
                                  aria-label={`Hapus tombol ${ai + 1} pada ${block.key}`}
                                  title="Hapus tombol"
                                >
                                  <Icon name="trash" className="size-3.5 text-destructive" aria-hidden="true" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {block.actions.length < MAX_ACTIONS ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            className="mt-2"
                            onClick={() => addAction(index)}
                          >
                            <Icon name="plus" className="size-3" aria-hidden="true" />
                            Tambah
                          </Button>
                        ) : null}
                      </div>
                    ) : block.actions.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {block.actions.map((action, ai) => (
                          <span key={`${block.key}-lihat-${ai}`} className="inline-flex items-center gap-1">
                            <span className="font-semibold text-foreground">{action.label}</span>
                            <span>ke {namaTujuan(action.destination)}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* Pratinjau memakai warna dan tombol yang sedang diatur,
                      jadi yang dilihat admin = yang tampil di storefront. */}
                  <div
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-lg px-4 py-3 text-center",
                      reusable ? "self-start" : undefined,
                    )}
                    style={{ backgroundColor: form.data.color }}
                  >
                    <p className="text-[11px] font-semibold text-white/90">
                      {block.eyebrow || "-"}
                    </p>
                    <p className="text-balance text-xs font-bold leading-snug text-white">
                      {block.heading || "-"}
                    </p>
                    {block.actions.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                        {block.actions.map((action, ai) => (
                          <span
                            key={`${block.key}-prev-${ai}`}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              action.variant === "secondary"
                                ? "border border-white/30 text-white"
                                : "bg-white text-[rgb(194,0,0)]",
                            )}
                          >
                            {action.destination === "whatsapp" ? (
                              <Icon name="whatsapp" className="size-3" aria-hidden="true" />
                            ) : null}
                            {action.label || "Tanpa label"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        {mode === "edit" ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Batal
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        ) : null}
      </form>
    </AdminLayout>
  )
}
