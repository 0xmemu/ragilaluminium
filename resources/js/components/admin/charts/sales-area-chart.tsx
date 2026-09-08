import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCurrency } from "@/lib/format"

interface SalesAreaChartProps {
  series: Array<{ label: string; value: number }>
}

function getCleanTicks<T extends { label: string }>(series: T[]): string[] {
  const n = series.length
  if (n <= 8) {
    return series.map((s) => s.label)
  }
  const step = n <= 14 ? 2 : n <= 31 ? 5 : n <= 90 ? 15 : Math.floor(n / 6)
  const indices: number[] = []
  for (let i = 0; i < n - 1; i += step) {
    indices.push(i)
  }
  if (!indices.includes(n - 1)) {
    if (indices.length > 1 && (n - 1) - indices[indices.length - 1] < Math.floor(step / 2)) {
      indices[indices.length - 1] = n - 1
    } else {
      indices.push(n - 1)
    }
  }
  return indices.map((idx) => series[idx].label)
}

export default function SalesAreaChart({ series = [] }: SalesAreaChartProps) {
  const gradientId = React.useId().replace(/:/g, "")
  const xAxisTicks = React.useMemo(() => getCleanTicks(series), [series])

  if (!series || series.length === 0) {
    return (
      <div className="flex h-full min-h-[140px] w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Belum ada aktivitas penjualan pada periode ini.
      </div>
    )
  }

  return (
    <div className="h-full min-h-[140px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={`sales-full-grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="hsl(var(--border) / 0.6)"
          />
          <XAxis
            dataKey="label"
            ticks={xAxisTicks}
            interval={0}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const item = payload[0].payload as { label: string; value: number }
              return (
                <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
                  <p className="font-medium text-muted-foreground">{item.label}</p>
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
            fill={`url(#sales-full-grad-${gradientId})`}
            dot={false}
            activeDot={{
              r: 5,
              stroke: "hsl(var(--background))",
              strokeWidth: 2,
              fill: "hsl(var(--primary))",
            }}
            isAnimationActive={true}
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
