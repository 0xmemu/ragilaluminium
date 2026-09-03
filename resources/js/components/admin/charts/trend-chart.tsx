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
 * GAYA TREN = TIRU DASHBOARD (owner: "dashboard lebih oke, pake yang itu"):
 * Dashboard memakai polos single-color (TrendBars bg-primary/70, Sparkline
 * stroke primary) tanpa pewarnaan naik/turun. Jadi TrendChart disamakan:
 * bar satu warna primary konsisten, tanpa Cell hijau/merah.
 */
export default function TrendChart<T extends { label: string; value: number }>({ series }: { series: T[] }) {
  const chartConfig = {
    value: {
      label: "Nilai",
      // Sama dgn Dashboard (bg-primary/70). Jangan --primary penuh: di admin
      // terang dia hitam pekat, terlalu berat utk banyak bar.
      color: "hsl(var(--primary) / 0.7)",
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
        <Bar dataKey="value" radius={2} fill="var(--color-value)" />
      </BarChart>
    </ChartContainer>
  )
}
