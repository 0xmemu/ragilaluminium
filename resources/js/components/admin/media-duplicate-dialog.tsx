import * as React from "react"

import { Button } from "@/components/admin/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/admin/ui/dialog"
import { Icon } from "@/components/shared/icon"
import {
  duplicateExplanation,
  duplicateHeadline,
  type MediaDuplicate,
} from "@/lib/media-duplicate"

/**
 * Peringatan berkas duplikat sebelum unggah (kontrak owner 2026-10-08).
 *
 * Muncul hanya bila sidik jari berkas yang dipilih sudah ada di Media Library.
 * Tindakan utamanya MENAHAN unggahan, karena berkas identik tidak menambah apa
 * pun dan penggabungan otomatis di server akan mengarsipkannya juga. Tetap unggah
 * disediakan sebagai pilihan sadar, bukan sebagai bawaan.
 *
 * Menutup dialog (Escape atau klik latar) diperlakukan sama dengan menahan
 * unggahan. Jalan yang aman tidak boleh batal hanya karena dialog tertutup.
 */
export function MediaDuplicateDialog({
  open,
  duplicates,
  onSkip,
  onUploadAnyway,
}: {
  open: boolean
  duplicates: MediaDuplicate[]
  onSkip: () => void
  onUploadAnyway: () => void
}) {
  const jumlah = duplicates.length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onSkip()
      }}
    >
      <DialogContent>
        <div className="flex items-start gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning">
            <Icon name="warning" className="size-5" weight="bold" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <DialogTitle>{duplicateHeadline(jumlah)}</DialogTitle>
            <DialogDescription className="mt-2">{duplicateExplanation(jumlah)}</DialogDescription>
          </div>
        </div>

        <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
          {duplicates.map((dup) => (
            <li
              key={dup.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
                {dup.thumb_url ? (
                  <img src={dup.thumb_url} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <Icon
                    name={dup.kind === "video" ? "video" : "image"}
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground" title={dup.label}>
                  {dup.label}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Aset #{dup.id}
                  {dup.usage_count > 0 ? `, dipakai ${dup.usage_count}x` : ", belum dipakai"}
                </p>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onUploadAnyway}>
            Tetap unggah
          </Button>
          <Button onClick={onSkip}>Lewati yang sudah ada</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
