import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TrendChartProps<T extends { label: string; value: number }> {
  series: T[]
  format?: "currency" | "number"
  className?: string
  height?: number
  allowToggle?: boolean
}

export default function TrendChart<T extends { label: string; value: number }>({
  series,
  format = "currency",
  className,
  height = 140,
  allowToggle = true,
}: TrendChartProps<T>) {
  const [chartType, setChartType] = React.useState<"area" | "bar">("area")
  const gradientId = React.useId().replace(/:/g, "")

  if (!series || series.length === 0) {
    return (
      <div className="flex h-32 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
        Belum ada data tren untuk ditampilkan.
      </div>
    )
  }

  const formatVal = (v: number) =>
    format === "currency" ? formatCurrency(v) : formatNumber(v)

  return (
    <div className={cn("w-full space-y-2", className)}>
      {allowToggle ? (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setChartType("area")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition",
              chartType === "area"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title="Tampilan Area & Garis Halus"
          >
            Area
          </button>
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition",
              chartType === "bar"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            title="Tampilan Diagram Batang"
          >
            Batang
          </button>
        </div>
      ) : null}

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart
              data={series}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id={`gradient-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="90%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border) / 0.6)"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as T
                  return (
                    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
                      <p className="font-medium text-muted-foreground">{data.label}</p>
                      <p className="tabular-nums mt-0.5 text-sm font-bold text-foreground">
                        {formatVal(Number(data.value))}
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
                fill={`url(#gradient-${gradientId})`}
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
          ) : (
            <BarChart
              data={series}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="hsl(var(--border) / 0.6)"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload as T
                  return (
                    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
                      <p className="font-medium text-muted-foreground">{data.label}</p>
                      <p className="tabular-nums mt-0.5 text-sm font-bold text-foreground">
                        {formatVal(Number(data.value))}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="value"
                fill="hsl(var(--primary) / 0.75)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={true}
                animationDuration={500}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
