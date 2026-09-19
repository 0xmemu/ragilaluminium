import { Head, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { Card } from "@/components/admin/ui/card"
import { Field, FieldGrid } from "@/components/admin/ui/field"
import { Input } from "@/components/admin/ui/input"
import { StatusBadge } from "@/components/admin/ui/status-badge"
import { Switch } from "@/components/admin/ui/switch"
import { Icon } from "@/components/shared/icon"
import AdminLayout from "@/layouts/admin-layout"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"

/**
 * Blok yang BUKAN banner penutup: kartu reusable di halaman transaksi.
 * Label kolomnya berbeda karena isinya judul + keterangan, bukan kop + judul
 * ajakan.
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

interface CtaBlock {
  key: string
  label: string
  eyebrow: string
  heading: string
  preview_url: string | null
}

/**
 * Editor teks CTA penutup storefront.
 *
 * Hanya kop (eyebrow) dan judul (heading) yang dapat diubah. Tombol aksi
 * ("Chat WhatsApp" dan tombol halaman) tetap mengikuti alur sistem, karena
 * terikat rute internal dan tautan WhatsApp yang terverifikasi.
 */
export default function CtaStorefrontEdit({
  title,
  description,
  submitUrl,
  enabled,
  blocks,
}: {
  title: string
  description: string
  submitUrl: string
  enabled: boolean
  blocks: CtaBlock[]
}) {
  // Kontrak UX (ADR-023): halaman pengaturan dibuka dalam mode RINGKASAN
  // read-only. Form baru aktif setelah admin menekan tombol "Ubah teks CTA",
  // dan kembali ke ringkasan setelah simpan berhasil.
  const [mode, setMode] = React.useState<"view" | "edit">("view")

  const form = useForm({
    enabled,
    blocks: blocks.map((block) => ({
      key: block.key,
      eyebrow: block.eyebrow,
      heading: block.heading,
    })),
  })

  function simpan() {
    form.put(submitUrl, {
      preserveScroll: true,
      onSuccess: () => setMode("view"),
    })
  }

  function setBlock(index: number, patch: Partial<{ eyebrow: string; heading: string }>) {
    form.setData(
      "blocks",
      form.data.blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    )
  }

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

      {mode === "view" ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">Status CTA penutup</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {form.data.enabled
                  ? "Banner ajakan tampil di bagian bawah seluruh halaman publik."
                  : "Banner ajakan disembunyikan dari seluruh halaman publik."}
              </p>
            </div>
            <StatusBadge status={form.data.enabled ? "active" : "inactive"} />
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-foreground">Teks CTA per halaman</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Kop kecil dan judul ajakan yang tampil di bagian bawah tiap halaman publik.
            </p>

            <div className="mt-4 space-y-3">
              {form.data.blocks.map((block) => {
                const meta = blocks.find((b) => b.key === block.key)
                return (
                  <div key={block.key} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {meta?.label ?? block.key}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {block.key}
                        </p>
                      </div>
                      {meta?.preview_url ? (
                        <a
                          href={meta.preview_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <Icon name="eye" className="size-3.5" aria-hidden="true" />
                          Lihat halaman
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          Pratinjau tidak tersedia
                        </span>
                      )}
                    </div>

                    {/* Pratinjau banner memakai warna CTA publik (bukan token
                        admin, yang temanya berbeda). */}
                    <div className="mt-3 rounded-lg bg-[rgb(194,0,0)] px-4 py-3 text-center">
                      <p className="text-[11px] font-semibold text-white/90">
                        {block.eyebrow || meta?.eyebrow || "-"}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-white">
                        {block.heading || meta?.heading || "-"}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      ) : (
        <form id="cta-storefront-form" onSubmit={(event) => { event.preventDefault(); simpan() }}>
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Tampilkan CTA penutup</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Bila dimatikan, banner ajakan di bagian bawah seluruh halaman publik tidak ditampilkan.
          </p>
        </div>
        <Switch
          checked={form.data.enabled}
          onCheckedChange={(checked) => form.setData("enabled", checked)}
          label="Tampilkan CTA penutup"
        />
      </Card>

      <p className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Tombol aksi pada CTA tetap mengikuti sistem dan tidak dapat diubah dari sini. Kosongkan
        sebuah kolom untuk memakai teks bawaannya.
      </p>

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <Card key={block.key} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{block.label}</h2>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{block.key}</p>
              </div>
              {block.preview_url ? (
                <Button asChild variant="secondary" size="sm">
                  <a href={block.preview_url} target="_blank" rel="noreferrer">
                    <Icon name="eye" className="size-3.5" aria-hidden="true" />
                    Lihat halaman
                  </a>
                </Button>
              ) : (
                <span className="text-[11px] text-muted-foreground">Pratinjau tidak tersedia</span>
              )}
            </div>

            <FieldGrid className="mt-4">
              <Field
                id={`eyebrow-${block.key}`}
                label={REUSABLE_BLOCKS[block.key]?.judul ?? "Kop kecil"}
                hint={REUSABLE_BLOCKS[block.key] ? undefined : "Baris kecil di atas judul."}
                error={form.errors[`blocks.${index}.eyebrow`]}
              >
                <Input
                  id={`eyebrow-${block.key}`}
                  value={form.data.blocks[index].eyebrow}
                  onChange={(event) => setBlock(index, { eyebrow: event.target.value })}
                  placeholder="cth. Masih punya pertanyaan?"
                  maxLength={120}
                />
              </Field>
              <Field
                id={`heading-${block.key}`}
                label={REUSABLE_BLOCKS[block.key]?.isi ?? "Judul ajakan"}
                hint={REUSABLE_BLOCKS[block.key]?.hintIsi ?? "Kalimat utama yang dibaca pengunjung."}
                error={form.errors[`blocks.${index}.heading`]}
              >
                <Input
                  id={`heading-${block.key}`}
                  value={form.data.blocks[index].heading}
                  onChange={(event) => setBlock(index, { heading: event.target.value })}
                  placeholder="cth. Tim kami siap membantu lewat WhatsApp"
                  maxLength={240}
                />
              </Field>
            </FieldGrid>

            {/* Warna disalin dari CTA storefront (--primary tema publik,
                rgb(194,0,0)); token tema admin berbeda sehingga tidak bisa
                memakai bg-primary di sini. */}
            <div className="mt-3 rounded-lg border border-border bg-[rgb(194,0,0)] px-4 py-3 text-center">
              <p className="text-[11px] font-semibold text-white/90">
                {form.data.blocks[index].eyebrow || block.eyebrow}
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {form.data.blocks[index].heading || block.heading}
              </p>
            </div>
          </Card>
        ))}
      </div>

          {/* Tombol bawah khusus mode edit: aksi utama tetap di header,
              ini jalan pintas setelah selesai mengubah kolom terakhir. */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("view")}>
              Batal
            </Button>
            <Button type="submit" disabled={form.processing}>
              {form.processing ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      )}
    </AdminLayout>
  )
}
