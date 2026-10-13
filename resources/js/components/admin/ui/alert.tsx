import type { ReactNode } from "react"

import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

type AlertTone = "info" | "success" | "warning" | "danger"

const styles: Record<AlertTone, string> = {
  info: "border-info/20 bg-info/5 text-info",
  success: "border-success/20 bg-success/5 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning-foreground",
  danger: "border-destructive/20 bg-destructive/5 text-destructive",
}

const icons: Record<AlertTone, string> = {
  info: "info",
  success: "check-circle",
  warning: "warning",
  danger: "warning",
}

export function Alert({
  tone = "info",
  title,
  children,
  className,
  onDismiss,
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  className?: string
  onDismiss?: () => void
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("relative flex gap-3 rounded-lg border p-4 text-sm", styles[tone], className)}
    >
      {/* Kotak setinggi line-height (text-sm = 20px) dengan isi di tengah:
          ikon tepat sejajar garis pertama teks, baik satu baris maupun banyak.
          Ukuran 20px disamakan dengan Alert storefront; sebelumnya 16px
          sehingga ikon terlihat kecil dibanding teksnya. */}
      <span className="flex h-5 shrink-0 items-center">
        <Icon name={icons[tone]} className="size-5" aria-hidden="true" />
      </span>
      <div className={cn("min-w-0 flex-1", onDismiss && "pr-9")}>
        {title ? <p className="font-semibold text-current">{title}</p> : null}
        {children ? <div className={cn("leading-6", title && "mt-1")}>{children}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-current/70 transition hover:bg-current/10 hover:text-current"
          aria-label="Tutup notifikasi"
        >
          <Icon name="x" className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
