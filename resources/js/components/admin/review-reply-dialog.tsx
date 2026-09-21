import { router, useForm } from "@inertiajs/react"
import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import { ConfirmAction } from "@/components/admin/ui/confirm-action"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Field } from "@/components/admin/ui/field"
import { Textarea } from "@/components/admin/ui/textarea"
import { Icon } from "@/components/shared/icon"

/**
 * Data ulasan yang dibutuhkan dialog balas.
 *
 * Sengaja hanya memuat field yang benar-benar dipakai, supaya komponen ini bisa
 * dipakai dari dua tempat dengan bentuk baris yang berbeda: daftar ulasan admin
 * dan halaman detail pesanan admin.
 */
export interface ReviewReplyTarget {
  id: number
  customer_name: string
  rating?: number | null
  message?: string | null
  created_at?: string | null
  product?: string | null
  source_label?: string | null
  location?: string | null
  image_url?: string | null
  admin_reply?: string | null
  admin_replied_at?: string | null
  has_reply?: boolean
  reply_url?: string
  destroy_reply_url?: string
}

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Dialog balas ulasan pelanggan (owner 2026-09-21).
 *
 * Satu dialog dipakai bersama oleh daftar ulasan dan halaman detail pesanan
 * admin, jadi menulis balasan tersedia dari dua tempat tanpa menggandakan
 * logikanya. Isinya: detail ulasan pelanggan lebih dulu, form balasan di
 * bawahnya, lalu tombol aksi.
 *
 * Balasan hidup di baris ulasan yang sama, sehingga menyimpan tidak pernah
 * mengubah teks pelanggan.
 */
export function ReviewReplyDialog({
  row,
  onClose,
  title = "Balas ulasan pelanggan",
}: {
  row: ReviewReplyTarget | null
  onClose: () => void
  title?: string
}) {
  const form = useForm({ admin_reply: row?.admin_reply ?? "" })

  React.useEffect(() => {
    form.setData("admin_reply", row?.admin_reply ?? "")
    form.clearErrors()
    // Sinkronkan teks saat admin membuka ulasan lain; `form` facade baru tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id, row?.admin_reply])

  const busy = form.processing
  const sudahDibalas = Boolean(row?.has_reply)
  const waktuUlasan = formatDateTime(row?.created_at)
  const waktuBalasan = formatDateTime(row?.admin_replied_at)
  const meta = [row?.source_label, row?.location].filter(Boolean).join(" · ")

  return (
    <Dialog open={Boolean(row)} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-lg bg-card text-card-foreground">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Balasan tampil di website tepat di bawah ulasan pelanggan. Teks asli pelanggan tidak diubah.
        </DialogDescription>

        {row ? (
          <div className="space-y-4">
            {/* Detail ulasan pelanggan, ditampilkan lebih dulu supaya admin
                bisa membaca konteks sebelum menulis balasan. */}
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-xs font-semibold text-foreground">{row.customer_name}</p>
                {meta ? <p className="text-[11px] text-muted-foreground">{meta}</p> : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {row.rating ? (
                  <span className="inline-flex items-center gap-0.5 text-warning" aria-label={`${row.rating} dari 5 bintang`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Icon
                        key={index}
                        name="star"
                        weight={index < (row.rating ?? 0) ? "fill" : "regular"}
                        className="size-3"
                        aria-hidden="true"
                      />
                    ))}
                  </span>
                ) : null}
                {waktuUlasan ? <span className="text-[11px] text-muted-foreground">{waktuUlasan}</span> : null}
              </div>

              {row.product ? (
                <p className="mt-1 text-[11px] text-muted-foreground">{row.product}</p>
              ) : null}

              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-foreground">
                {row.message?.trim() || "(tanpa teks)"}
              </p>

              {row.image_url ? (
                <img
                  src={row.image_url}
                  alt={`Foto ulasan ${row.customer_name}`}
                  loading="lazy"
                  className="mt-2 size-16 rounded-[3px] border border-border object-cover"
                />
              ) : null}
            </div>

            <Field
              id={`admin-reply-${row.id}`}
              label="Balasan toko"
              error={form.errors.admin_reply}
              hint={
                sudahDibalas
                  ? "Balasan sudah ada. Menyimpan akan memperbarui balasan itu, bukan menambah yang baru. Maksimal 1000 karakter."
                  : "Maksimal 1000 karakter. Contoh: Terima kasih Kak, senang produknya cocok."
              }
            >
              <Textarea
                id={`admin-reply-${row.id}`}
                rows={5}
                value={form.data.admin_reply}
                maxLength={1000}
                onChange={(event) => form.setData("admin_reply", event.target.value)}
                placeholder="Tulis balasan untuk pelanggan"
              />
            </Field>

            {sudahDibalas && waktuBalasan ? (
              <p className="text-[11px] text-muted-foreground">Terakhir dibalas {waktuBalasan}.</p>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              {sudahDibalas && row.destroy_reply_url ? (
                <ConfirmAction
                  trigger={
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={busy}>
                      Hapus balasan
                    </Button>
                  }
                  title="Hapus balasan ulasan?"
                  description="Balasan dihapus dari website. Ulasan pelanggan tetap tampil."
                  confirmLabel="Hapus balasan"
                  processing={busy}
                  onConfirm={() => {
                    router.delete(row.destroy_reply_url!, {
                      preserveScroll: true,
                      onSuccess: onClose,
                    })
                  }}
                />
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || form.data.admin_reply.trim().length < 2}
                  onClick={() => {
                    form.post(row.reply_url!, { preserveScroll: true, onSuccess: onClose })
                  }}
                >
                  {busy ? "Mengirim..." : "Balas"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
