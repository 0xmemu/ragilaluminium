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

interface CtaItem {
  label: string
  description: string
}

/** Nilai tersimpan admin. String kosong berarti blok masih memakai teks storefront. */
interface BlockValues {
  eyebrow: string
  heading: string
  actions: CtaAction[]
  items: CtaItem[]
}

interface CtaBlock {
  key: string
  label: string
  kind: "banner" | "card" | "section" | "empty" | "list"
  preview_url: string | null
  dynamic: boolean
  note: string | null
  /** Teks yang benar-benar tampil di storefront sekarang. */
  live: BlockValues
  /** Nilai tersimpan; null berarti belum diubah dari teks storefront. */
  stored: {
    eyebrow: string | null
    heading: string | null
    actions: CtaAction[] | null
    items: CtaItem[] | null
  }
}

interface DestinationOption {
  value: string
  label: string
}

/**
 * Judul kelompok di halaman. Urutannya mengikuti jenis blok supaya admin
 * menemukan blok yang dicari tanpa membaca seluruh daftar.
 */
const KIND_GROUPS: Array<{ kind: CtaBlock["kind"]; title: string; hint: string }> = [
  {
    kind: "banner",
    title: "Banner penutup halaman",
    hint: "Banner berwarna di bagian bawah halaman publik.",
  },
  {
    kind: "card",
    title: "Kartu di halaman transaksi",
    hint: "Kartu yang dipakai berulang di keranjang, checkout, dan pesanan.",
  },
  {
    kind: "section",
    title: "Tombol pada judul section beranda",
    hint: "Tautan kecil di samping judul section. Hanya labelnya yang dapat diubah.",
  },
  {
    kind: "empty",
    title: "Tampilan saat belum ada isi",
    hint: "Muncul saat katalog, foto, atau ulasan masih kosong.",
  },
  {
    kind: "list",
    title: "Kartu dan daftar langkah",
    hint: "Blok berisi beberapa baris, bukan satu kalimat.",
  },
]

/** Label kolom per jenis blok. */
const FIELD_LABELS: Record<CtaBlock["kind"], { eyebrow: string | null; heading: string | null }> = {
  banner: { eyebrow: "Kop kecil", heading: "Judul ajakan" },
  card: { eyebrow: "Judul", heading: "Keterangan" },
  section: { eyebrow: null, heading: null },
  empty: { eyebrow: "Judul", heading: "Keterangan" },
  list: { eyebrow: "Kop kecil", heading: "Judul" },
}

function nilaiAwal(block: CtaBlock): BlockValues {
  return {
    eyebrow: block.stored.eyebrow ?? "",
    heading: block.stored.heading ?? "",
    actions: (block.stored.actions ?? []).map((action) => ({ ...action })),
    items: (block.stored.items ?? []).map((item) => ({ ...item })),
  }
}

function sudahDiubah(block: CtaBlock): boolean {
  return Boolean(
    block.stored.eyebrow ||
      block.stored.heading ||
      block.stored.actions?.length ||
      block.stored.items?.length,
  )
}

/**
 * Editor CTA storefront.
 *
 * Halaman ini menyajikan teks ASLI storefront sebagai nilai acuan, dan form
 * hanya menyimpan yang benar-benar diubah admin. Kolom yang dibiarkan kosong
 * berarti blok itu terus memakai teks storefront, jadi menyimpan tidak pernah
 * membekukan teks yang nanti diperbarui di kode.
 *
 * Dua mode (kontrak ADR-023): dibuka dalam mode RINGKASAN read-only, form
 * aktif setelah admin menekan "Ubah teks CTA", dan Simpan kembali ke ringkasan.
 *
 * Tujuan tombol dipilih dari daftar preset, bukan URL bebas, supaya jalur
 * konsultasi dan checkout tidak bisa rusak karena salah menyalin tautan.
 */
export default function CtaStorefrontEdit({
  title,
  description,
  submitUrl,
  enabled,
  color,
  defaultColor,
  maxActions,
  maxItems,
  destinations,
  blocks,
}: {
  title: string
  description: string
  submitUrl: string
  enabled: boolean
  color: string | null
  defaultColor: string
  maxActions: number
  maxItems: number
  destinations: DestinationOption[]
  blocks: CtaBlock[]
}) {
  const [mode, setMode] = React.useState<"view" | "edit">("view")

  const form = useForm({
    enabled,
    // String kosong berarti "pakai warna brand": warna banner storefront
    // dibiarkan seperti sekarang sampai admin memilih warna sendiri.
    color: color ?? "",
    blocks: blocks.map((block) => ({ key: block.key, ...nilaiAwal(block) })),
  })

  function simpan() {
    form.put(submitUrl, {
      preserveScroll: true,
      onSuccess: () => setMode("view"),
    })
  }

  function setBlock(index: number, patch: Partial<BlockValues>) {
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

  function addAction(blockIndex: number, kind: CtaBlock["kind"]) {
    const block = form.data.blocks[blockIndex]
    if (block.actions.length >= maxActions) return
    const sumber = blocks.find((b) => b.key === block.key)
    const contoh = sumber?.live.actions[0]
    setBlock(blockIndex, {
      actions: [
        ...block.actions,
        kind === "section"
          ? { label: "", destination: "", variant: "secondary" }
          : {
              label: "",
              destination: contoh?.destination ?? destinations[0]?.value ?? "whatsapp",
              variant: block.actions.length === 0 ? "primary" : "secondary",
            },
      ],
    })
  }

  function setItem(
    blockIndex: number,
    itemIndex: number,
    patch: Partial<CtaItem>,
  ) {
    const block = form.data.blocks[blockIndex]
    setBlock(blockIndex, {
      items: block.items.map((item, i) => (i === itemIndex ? { ...item, ...patch } : item)),
    })
  }

  function removeItem(blockIndex: number, itemIndex: number) {
    const block = form.data.blocks[blockIndex]
    setBlock(blockIndex, { items: block.items.filter((_, i) => i !== itemIndex) })
  }

  function addItem(blockIndex: number, pakaiKeterangan: boolean) {
    const block = form.data.blocks[blockIndex]
    if (block.items.length >= maxItems) return
    setBlock(blockIndex, { items: [...block.items, { label: "", description: pakaiKeterangan ? "" : "" }] })
  }

  /** Kembalikan satu blok ke teks storefront: kosongkan seluruh kolomnya. */
  function pakaiTeksStorefront(blockIndex: number) {
    setBlock(blockIndex, { eyebrow: "", heading: "", actions: [], items: [] })
  }

  /** Isi satu blok dengan teks storefront sekarang, supaya bisa disunting. */
  function salinTeksStorefront(blockIndex: number) {
    const sumber = blocks.find((b) => b.key === form.data.blocks[blockIndex].key)
    if (!sumber) return
    setBlock(blockIndex, {
      eyebrow: sumber.live.eyebrow,
      heading: sumber.live.heading,
      actions: sumber.live.actions.map((a) => ({ ...a })),
      items: sumber.live.items.map((i) => ({ ...i })),
    })
  }

  const namaTujuan = (value: string) =>
    destinations.find((d) => d.value === value)?.label ?? value

  const warnaTampil = form.data.color || defaultColor

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
        {/* Baris kendali: berlaku untuk seluruh blok, jadi dikumpulkan di satu
            tempat. Warna kosong berarti banner memakai warna brand. */}
        <Card className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Switch
              checked={form.data.enabled}
              onCheckedChange={(checked) => {
                form.setData("enabled", checked)
                if (mode === "view") setMode("edit")
              }}
              label="Tampilkan CTA storefront"
              disabled={mode === "view"}
            />
            <span className="text-xs text-muted-foreground">
              {form.data.enabled
                ? "CTA tampil di seluruh halaman publik."
                : "Seluruh CTA disembunyikan dari halaman publik."}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cta-color" className="text-[11px] font-semibold text-muted-foreground">
              Warna banner
            </label>
            <input
              id="cta-color"
              type="color"
              value={warnaTampil}
              disabled={mode === "view"}
              onChange={(event) => form.setData("color", event.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-surface p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Warna banner CTA"
            />
            <span className="font-mono text-[11px] text-muted-foreground">
              {form.data.color || "warna brand"}
            </span>
            {mode === "edit" && form.data.color ? (
              <button
                type="button"
                onClick={() => form.setData("color", "")}
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Pakai warna brand
              </button>
            ) : null}
          </div>
        </Card>

        {KIND_GROUPS.map((group) => {
          const isi = form.data.blocks
            .map((block, index) => ({ block, index, meta: blocks[index] }))
            .filter((row) => row.meta?.kind === group.kind)

          if (isi.length === 0) return null

          return (
            <section key={group.kind} className="mt-5 first:mt-0">
              <div className="mb-2">
                <h2 className="text-xs font-bold tracking-tight text-foreground">{group.title}</h2>
                <p className="text-[11px] text-muted-foreground">{group.hint}</p>
              </div>

              <div className="space-y-2">
                {isi.map(({ block, index, meta }) => {
                  const labels = FIELD_LABELS[group.kind]
                  // Kolom yang tidak ada di storefront tidak ditampilkan sama
                  // sekali, supaya tidak muncul baris kosong yang membingungkan.
                  const adaEyebrow = Boolean(labels.eyebrow) && meta.live.eyebrow !== ""
                  const adaHeading = Boolean(labels.heading) && meta.live.heading !== ""
                  // Nama kolom judul: "Judul ajakan" hanya dipakai kalau blok
                  // memang punya baris kop di atasnya.
                  const labelHeading = adaEyebrow ? (labels.heading ?? "Judul ajakan") : "Judul"
                  const punyaKeterangan = meta.live.items.some((item) => item.description)
                  const nilaiBerbeda = sudahDiubah(meta)
                  // Hitungan tombol harus menggambarkan yang tampil di
                  // storefront, bukan hanya yang sudah diubah admin.
                  const jumlahTombol = block.actions.length || meta.live.actions.length

                  return (
                    <Card key={block.key} className="px-4 py-3">
                      {/* BARIS 1 - identitas blok, status, dan tautan pratinjau */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="text-xs font-semibold text-foreground">{meta.label}</h3>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {block.key}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              nilaiBerbeda
                                ? "bg-primary/10 text-primary"
                                : "bg-surface-muted text-muted-foreground",
                            )}
                          >
                            {nilaiBerbeda ? "Diatur admin" : "Teks storefront"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">
                            {jumlahTombol} tombol
                          </span>
                          {meta.preview_url ? (
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

                      {meta.note ? (
                        <p className="mt-1.5 rounded-md bg-surface-muted/60 px-2.5 py-1.5 text-[11px] leading-4 text-muted-foreground">
                          {meta.note}
                        </p>
                      ) : null}

                      {/* BARIS 2 - kolom teks di kiri, pratinjau asli di kanan */}
                      <div className="mt-2.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                        <div className="space-y-2.5">
                          {adaEyebrow ? (
                            mode === "view" ? (
                              <div className="grid gap-0.5">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  {labels.eyebrow ?? "Kop kecil"}
                                </span>
                                <span className="text-xs font-medium text-foreground">
                                  {block.eyebrow || meta.live.eyebrow}
                                </span>
                              </div>
                            ) : (
                              <Field
                                id={`eyebrow-${block.key}`}
                                label={labels.eyebrow ?? "Kop kecil"}
                                hint={`Storefront: ${meta.live.eyebrow}`}
                                error={form.errors[`blocks.${index}.eyebrow`]}
                              >
                                <Input
                                  id={`eyebrow-${block.key}`}
                                  value={block.eyebrow}
                                  onChange={(event) =>
                                    setBlock(index, { eyebrow: event.target.value })
                                  }
                                  placeholder={meta.live.eyebrow}
                                  maxLength={120}
                                />
                              </Field>
                            )
                          ) : null}

                          {adaHeading ? (
                            mode === "view" ? (
                              <div className="grid gap-0.5">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  {labelHeading}
                                </span>
                                <span className="text-xs text-foreground">
                                  {block.heading || meta.live.heading}
                                </span>
                              </div>
                            ) : (
                              <Field
                                id={`heading-${block.key}`}
                                label={labelHeading}
                                hint={`Storefront: ${meta.live.heading}`}
                                error={form.errors[`blocks.${index}.heading`]}
                              >
                                <Input
                                  id={`heading-${block.key}`}
                                  value={block.heading}
                                  onChange={(event) =>
                                    setBlock(index, { heading: event.target.value })
                                  }
                                  placeholder={meta.live.heading}
                                  maxLength={240}
                                />
                              </Field>
                            )
                          ) : null}

                          {/* Baris kartu/poin: satu baris teks, atau judul +
                              keterangan bila blok aslinya punya keterangan. */}
                          {meta.live.items.length > 0 ? (
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground">
                                {punyaKeterangan ? "Kartu (judul dan keterangan)" : "Baris daftar"}
                              </p>

                              {mode === "view" ? (
                                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-foreground">
                                  {(block.items.length
                                    ? block.items
                                    : meta.live.items
                                  ).map((item, ii) => (
                                    <li key={`${block.key}-lihat-${ii}`}>
                                      <span className="font-medium">{item.label}</span>
                                      {item.description ? (
                                        <span className="text-muted-foreground">
                                          {": "}
                                          {item.description}
                                        </span>
                                      ) : null}
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <div className="mt-2 space-y-2">
                                  {(block.items.length ? block.items : meta.live.items).map(
                                    (item, ii) => {
                                      const dariStorefront = block.items.length === 0
                                      return (
                                        <div
                                          key={`${block.key}-item-${ii}`}
                                          className={cn(
                                            "grid items-start gap-2",
                                            punyaKeterangan
                                              ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_2rem]"
                                              : "sm:grid-cols-[minmax(0,1fr)_2rem]",
                                          )}
                                        >
                                          <Input
                                            value={item.label}
                                            disabled={dariStorefront}
                                            onChange={(event) =>
                                              setItem(index, ii, { label: event.target.value })
                                            }
                                            placeholder={meta.live.items[ii]?.label ?? "Judul baris"}
                                            maxLength={120}
                                            aria-label={`Judul baris ${ii + 1} pada ${block.key}`}
                                          />
                                          {punyaKeterangan ? (
                                            <Input
                                              value={item.description}
                                              disabled={dariStorefront}
                                              onChange={(event) =>
                                                setItem(index, ii, {
                                                  description: event.target.value,
                                                })
                                              }
                                              placeholder={
                                                meta.live.items[ii]?.description ?? "Keterangan"
                                              }
                                              maxLength={240}
                                              aria-label={`Keterangan baris ${ii + 1} pada ${block.key}`}
                                            />
                                          ) : null}
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            disabled={dariStorefront}
                                            onClick={() => removeItem(index, ii)}
                                            aria-label={`Hapus baris ${ii + 1} pada ${block.key}`}
                                            title="Hapus baris"
                                          >
                                            <Icon
                                              name="trash"
                                              className="size-3.5 text-destructive"
                                              aria-hidden="true"
                                            />
                                          </Button>
                                        </div>
                                      )
                                    },
                                  )}

                                  {block.items.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">
                                      Masih memakai {meta.live.items.length} baris storefront.
                                      Tekan Salin untuk menyuntingnya.
                                    </p>
                                  ) : null}

                                  {block.items.length < maxItems ? (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="xs"
                                      onClick={() => addItem(index, punyaKeterangan)}
                                    >
                                      <Icon name="plus" className="size-3" aria-hidden="true" />
                                      Tambah baris
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          ) : null}

                          {/* Editor tombol: hanya pada mode edit. */}
                          {mode === "edit" && group.kind !== "section" ? (
                            <div className="rounded-md border border-border bg-surface-muted/40 p-2.5">
                              <p className="text-[11px] font-semibold text-muted-foreground">
                                Tombol (maksimal {maxActions})
                              </p>

                              {block.actions.length === 0 ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  Blok ini memakai tombol storefront
                                  {meta.live.actions.length
                                    ? `: ${meta.live.actions.map((a) => a.label).join(", ")}.`
                                    : " (tanpa tombol)."}
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
                                        <Icon
                                          name="trash"
                                          className="size-3.5 text-destructive"
                                          aria-hidden="true"
                                        />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {block.actions.length < maxActions ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="xs"
                                  className="mt-2"
                                  onClick={() => addAction(index, group.kind)}
                                >
                                  <Icon name="plus" className="size-3" aria-hidden="true" />
                                  Tambah tombol
                                </Button>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Blok tombol judul: hanya label, tautannya menempel
                              pada section sehingga tidak boleh diganti di sini. */}
                          {group.kind === "section" ? (
                            mode === "view" ? (
                              <div className="grid gap-0.5">
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                  Label tombol
                                </span>
                                <span className="text-xs font-medium text-foreground">
                                  {block.actions[0]?.label || meta.live.actions[0]?.label || "-"}
                                </span>
                              </div>
                            ) : (
                              <Field
                                id={`aksi-${block.key}`}
                                label="Label tombol"
                                hint={`Storefront: ${meta.live.actions[0]?.label ?? "-"}. Tautan mengikuti section, tidak diubah dari sini.`}
                                error={form.errors[`blocks.${index}.actions`]}
                              >
                                <Input
                                  id={`aksi-${block.key}`}
                                  value={block.actions[0]?.label ?? ""}
                                  onChange={(event) =>
                                    setBlock(index, {
                                      actions: [
                                        {
                                          label: event.target.value,
                                          destination: "",
                                          variant: "secondary",
                                        },
                                      ],
                                    })
                                  }
                                  placeholder={meta.live.actions[0]?.label ?? "Lihat Semua"}
                                  maxLength={40}
                                />
                              </Field>
                            )
                          ) : null}

                          {/* Ringkasan tombol pada mode baca. */}
                          {mode === "view" && group.kind !== "section" && block.actions.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              {block.actions.map((action, ai) => (
                                <span
                                  key={`${block.key}-lihat-tombol-${ai}`}
                                  className="inline-flex items-center gap-1"
                                >
                                  <span className="font-semibold text-foreground">
                                    {action.label}
                                  </span>
                                  <span>
                                    ke{" "}
                                    {action.destination
                                      ? namaTujuan(action.destination)
                                      : "section terkait"}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {mode === "edit" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={() => salinTeksStorefront(index)}
                              >
                                <Icon name="copy" className="size-3" aria-hidden="true" />
                                Salin teks storefront
                              </Button>
                              {(block.eyebrow ||
                                block.heading ||
                                block.actions.length ||
                                block.items.length) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => pakaiTeksStorefront(index)}
                                >
                                  Pakai teks storefront
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        {/* Pratinjau memakai nilai yang sedang diisi, jadi yang
                            dilihat admin = yang akan tampil. */}
                        <div className="self-start space-y-1.5">
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            Pratinjau
                          </p>
                          {meta.live.items.length > 0 ? (
                            <ul className="space-y-1 rounded-lg border border-border bg-surface-muted/40 px-4 py-3">
                              {(block.items.length ? block.items : meta.live.items).map(
                                (item, ii) => (
                                  <li key={`${block.key}-pratinjau-${ii}`} className="text-xs">
                                    <span className="font-semibold text-foreground">
                                      {item.label || "-"}
                                    </span>
                                    {item.description ? (
                                      <span className="text-muted-foreground">
                                        {" "}
                                        {item.description}
                                      </span>
                                    ) : null}
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : null}

                          {group.kind !== "section" ? (
                            <div
                              className={cn(
                                "flex flex-col items-center justify-center gap-1 rounded-lg px-4 py-3 text-center",
                                group.kind === "banner" ? undefined : "self-start",
                              )}
                              style={{ backgroundColor: warnaTampil }}
                            >
                              {adaEyebrow ? (
                                <p className="text-[11px] font-semibold text-white/90">
                                  {block.eyebrow || meta.live.eyebrow}
                                </p>
                              ) : null}
                              {adaHeading ? (
                                <p className="text-balance text-xs font-bold leading-snug text-white">
                                  {(block.heading || meta.live.heading) || "-"}
                                </p>
                              ) : null}
                              {(block.actions.length
                                ? block.actions
                                : meta.live.actions
                              ).length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                                  {(block.actions.length
                                    ? block.actions
                                    : meta.live.actions
                                  ).map((action, ai) => (
                                    <span
                                      key={`${block.key}-pratinjau-tombol-${ai}`}
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                        action.variant === "secondary"
                                          ? "border border-white/30 text-white"
                                          : "bg-white text-[rgb(192,0,0)]",
                                      )}
                                    >
                                      {action.destination === "whatsapp" ? (
                                        <Icon
                                          name="whatsapp"
                                          className="size-3"
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                      {action.label || "Tanpa label"}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-muted/40 px-4 py-3">
                              <span className="text-xs font-bold text-muted-foreground">
                                {block.actions[0]?.label || meta.live.actions[0]?.label || "-"}
                              </span>
                              <Icon
                                name="arrow-right"
                                className="size-3.5 text-muted-foreground"
                                weight="bold"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          )
        })}

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
