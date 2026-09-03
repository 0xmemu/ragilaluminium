import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts"

import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/admin/ui/chart"

/**
 * TrendChart dipisah dari halaman StorePerformance agar recharts di-load
 * lazy (chunk terpisah) dan tidak membebani bundle halaman admin utama.
 *
 * Warna bar per titik: NAIK (>= titik sebelumnya) hijau, TURUN merah
 * (feedback owner: "tren hijau merah tidak muncul lagi" - sebelumnya satu
 * warna merah semua). Titik pertama netral (abu) karena belum ada pembanding.
 */
export default function TrendChart<T extends { label: string; value: number }>({ series }: { series: T[] }) {
  const chartConfig = {
    value: {
      label: "Nilai",
      color: "hsl(var(--sale))",
    },
  } satisfies ChartConfig

  return (
    <ChartContainer config={chartConfig} className="mt-2 h-32 w-full">
      <BarChart data={series} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
          tick={{ fontSize: 9 }}
        />
        <ChartTooltip
          cursor={{ fill: "var(--accent)" }}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="value" radius={2}>
          {series.map((point, index) => {
            const prev = index > 0 ? series[index - 1].value : null
            const up = prev !== null && point.value >= prev
            const down = prev !== null && point.value < prev
            return (
              <Cell
                key={point.label}
                fill={
                  up
                    ? "hsl(var(--success))"
                    : down
                      ? "hsl(var(--sale))"
                      : "hsl(var(--muted-foreground))"
                }
              />
            )
          })}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
