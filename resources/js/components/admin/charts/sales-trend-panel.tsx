import * as React from "react"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface SalesTrendPanelProps {
  series: Array<{ label: string; value: number }>
  total?: number
  periodLabel?: string
  className?: string
}

export default function SalesTrendPanel({
  series = [],
  total,
  periodLabel,
  className,
}: SalesTrendPanelProps) {
  const gradientId = React.useId().replace(/:/g, "")
  const maxVal = series.length > 0 ? Math.max(...series.map((s) => Number(s.value) || 0), 0) : 0
  const nonZeroCount = series.filter((s) => Number(s.value) > 0).length

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 p-4 shadow-soft sm:w-80 lg:w-96 shrink-0",
        className
      )}
    >
      {/* Header Panel */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-tight text-foreground">
            Aktivitas Penjualan
          </p>
          <p className="text-[11px] text-muted-foreground">{periodLabel || "Periode ini"}</p>
        </div>
        {maxVal > 0 ? (
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Puncak</span>
            <p className="tabular-nums text-xs font-bold text-foreground">
              {formatCurrency(maxVal)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Area Chart yang Halus & Interaktif */}
      <div className="my-2.5 h-28 w-full">
        {series.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={`sales-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="90%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload as { label: string; value: number }
                  return (
                    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
                      <p className="text-[10px] font-medium text-muted-foreground">{item.label}</p>
                      <p className="tabular-nums mt-0.5 text-sm font-bold text-foreground">
                        {formatCurrency(Number(item.value))}
                      </p>
                    </div>
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                fill={`url(#sales-grad-${gradientId})`}
                dot={false}
                activeDot={{
                  r: 4.5,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                  fill: "hsl(var(--primary))",
                }}
                isAnimationActive={true}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">
            Belum ada data aktivitas
          </div>
        )}
      </div>

      {/* Footer Metrik Ringkas Pengisi Ruang */}
      <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px] text-muted-foreground">
        <span>{series.length} data titik waktu</span>
        <span className={cn("font-medium", nonZeroCount > 0 ? "text-foreground" : "text-muted-foreground")}>
          {nonZeroCount > 0 ? `${nonZeroCount} hari transaksi` : "Belum ada pesanan"}
        </span>
      </div>
    </div>
  )
}
