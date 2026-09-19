import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TrendChartPoint {
  label: string
  value: number
  previous_value?: number
  previous_label?: string | null
}

interface TrendChartProps<T extends TrendChartPoint> {
  series: T[]
  format?: "currency" | "number" | "percent"
  className?: string
  height?: number
  chartType?: "line" | "bar"
  showChartTypeToggle?: boolean
  defaultType?: "line" | "bar"
}

function getCleanTicks<T extends { label: string }>(series: T[]): string[] {
  const n = series.length
  if (n <= 6) {
    return series.map((s) => s.label)
  }
  const step = Math.ceil(n / 5)
  const ticks: string[] = []
  for (let i = 0; i < n; i += step) {
    ticks.push(series[i].label)
  }
  if (ticks[ticks.length - 1] !== series[n - 1].label) {
    ticks.push(series[n - 1].label)
  }
  return ticks
}

export default function TrendChart<T extends TrendChartPoint>({
  series = [],
  format = "currency",
  className,
  height = 160,
  chartType: controlledChartType,
  showChartTypeToggle = false,
  defaultType = "line",
}: TrendChartProps<T>) {
  const [internalChartType, setInternalChartType] = React.useState<"line" | "bar">(defaultType)
  const activeType = controlledChartType ?? internalChartType
  const xAxisTicks = React.useMemo(() => getCleanTicks(series), [series])

  if (!series || series.length === 0) {
    return (
      <div className="flex h-full min-h-[140px] w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
        Belum ada data tren untuk ditampilkan.
      </div>
    )
  }

  const formatVal = (v: number) => {
    if (format === "currency") return formatCurrency(v)
    if (format === "percent") return `${formatNumber(v)}%`
    return formatNumber(v)
  }


  return (
    <div className={cn("w-full space-y-2", className)}>
      {showChartTypeToggle ? (
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
            {([
              { key: "line", label: "Line Chart" },
              { key: "bar", label: "Bar Chart" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setInternalChartType(key)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition",
                  activeType === key
                    ? "bg-foreground text-background shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
                title={label}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeType === "bar" ? (
            <BarChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.6)" />
              <XAxis
                dataKey="label"
                ticks={xAxisTicks}
                interval="preserveStartEnd"
                minTickGap={20}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload as T
                  const currentVal = Number(item.value ?? 0)
                  const prevVal = Number(item.previous_value ?? 0)
                  const hasPrev = item.previous_value !== undefined

                  return (
                    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md space-y-1">
                      <p className="font-semibold text-foreground border-b border-border/50 pb-1">
                        {item.label} {item.previous_label ? <span className="text-[11px] font-normal text-muted-foreground">vs {item.previous_label}</span> : null}
                      </p>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--sale))" }} />
                          Periode Ini:
                        </span>
                        <span className="tabular-nums font-bold text-foreground">
                          {formatVal(currentVal)}
                        </span>
                      </div>
                      {hasPrev ? (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full inline-block bg-muted-foreground/40" />
                            Periode Lalu:
                          </span>
                          <span className="tabular-nums font-medium text-muted-foreground">
                            {formatVal(prevVal)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="previous_value"
                name="Periode Lalu"
                fill="hsl(var(--muted-foreground) / 0.25)"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                isAnimationActive={true}
                animationDuration={400}
              />
              <Bar
                dataKey="value"
                name="Periode Ini"
                fill="hsl(var(--sale))"
                radius={[3, 3, 0, 0]}
                maxBarSize={20}
                isAnimationActive={true}
                animationDuration={500}
              />
            </BarChart>
          ) : (
            <LineChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.6)" />
              <XAxis
                dataKey="label"
                ticks={xAxisTicks}
                interval="preserveStartEnd"
                minTickGap={20}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload as T
                  const currentVal = Number(item.value ?? 0)
                  const prevVal = Number(item.previous_value ?? 0)
                  const hasPrev = item.previous_value !== undefined

                  return (
                    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md space-y-1">
                      <p className="font-semibold text-foreground border-b border-border/50 pb-1">
                        {item.label} {item.previous_label ? <span className="text-[11px] font-normal text-muted-foreground">vs {item.previous_label}</span> : null}
                      </p>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <span className="size-2 rounded-full inline-block" style={{ backgroundColor: "hsl(var(--sale))" }} />
                          Periode Ini:
                        </span>
                        <span className="tabular-nums font-bold text-foreground">
                          {formatVal(currentVal)}
                        </span>
                      </div>
                      {hasPrev ? (
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="size-2 rounded-full inline-block bg-muted-foreground/40" />
                            Periode Lalu:
                          </span>
                          <span className="tabular-nums font-medium text-muted-foreground">
                            {formatVal(prevVal)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )
                }}
              />
              <Line
                type="monotone"
                dataKey="previous_value"
                name="Periode Lalu"
                stroke="hsl(var(--muted-foreground) / 0.4)"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                  fill: "hsl(var(--muted-foreground))",
                }}
                isAnimationActive={true}
                animationDuration={600}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Periode Ini"
                stroke="hsl(var(--sale))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                  fill: "hsl(var(--sale))",
                }}
                isAnimationActive={true}
                animationDuration={600}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
