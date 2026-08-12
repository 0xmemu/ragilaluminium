import { Icon } from "@/components/shared/icon"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    badge: "COD",
    icon: null,
    title: "Bayar Di Tempat",
    description: "Bayar di tempat saat barang tiba",
  },
  {
    badge: null,
    icon: "shield-check",
    title: "Garansi Jika Rusak",
    description: "Perlindungan penuh 2 tahun",
  },
  {
    badge: null,
    icon: "truck",
    title: "Kirim Ke Seluruh Indonesia",
    description: "Asuransi pengiriman ke seluruh Indonesia",
  },
] as const

/** Banner promosi slide-2 — SATU banner utuh dengan grid 2 kolom berisi 2 informasi berbeda.
 *  Tanpa garis pembatas, semua teks minimal 12px, ikon seragam. */
export function IntroCards({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-full w-full grid-cols-2 bg-background", className)}>
      {/* Zona kiri — brand statement */}
      <div className="flex min-h-0 flex-col justify-center overflow-hidden px-3 py-0.5 sm:px-8 sm:py-6 lg:px-12">
        <p className="text-xs font-bold tracking-wide text-primary">
          Ragil Aluminium
        </p>
        <h2 className="mt-0.5 font-display text-xs font-extrabold leading-none tracking-[-0.02em] text-foreground sm:mt-2 sm:leading-snug sm:text-3xl lg:text-4xl">
          <span className="text-primary">Jendela</span> Aluminium
        </h2>
        <p className="mt-0.5 font-display text-xs font-bold leading-snug tracking-[-0.01em] text-foreground sm:text-lg">
          Berbagai Ukuran Siap Pilih &amp; Bisa Custom
        </p>
        <p className="mt-3 hidden max-w-md text-sm leading-6 text-muted-foreground sm:block">
          Katalog terlengkap dengan lebih dari 30.000 variasi ukuran dan model siap kirim
          untuk kebutuhan arsitektur Anda.
        </p>
      </div>

      {/* Zona kanan — statistik + fitur */}
      <div className="flex min-h-0 flex-col justify-center overflow-hidden px-3 py-0.5 sm:px-8 sm:py-6 lg:px-12">
        <h2 className="font-display text-xs font-extrabold leading-none tracking-[-0.02em] text-foreground sm:leading-snug sm:text-3xl lg:text-4xl">
          <span className="text-primary">1.000.000+</span> Unit Terpasang
        </h2>
        <p className="mt-0.5 hidden font-display text-xs font-bold leading-snug tracking-[-0.01em] text-foreground sm:mt-1.5 sm:block sm:text-lg">
          di Seluruh Indonesia
        </p>
        <ul className="mt-0.5 space-y-0.5 sm:mt-6 sm:space-y-4">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="flex items-center gap-2 sm:gap-3.5">
              {feature.badge ? (
                <span
                  className="flex h-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-extrabold tracking-wide text-white sm:h-10 sm:px-3"
                  aria-hidden="true"
                >
                  {feature.badge}
                </span>
              ) : (
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:size-10"
                  aria-hidden="true"
                >
                  <Icon name={feature.icon} className="size-3.5 sm:size-5" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight tracking-tight text-foreground sm:text-sm">
                  {feature.title}
                </p>
                <p className="mt-0.5 hidden text-xs leading-4 text-muted-foreground sm:block">
                  {feature.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
