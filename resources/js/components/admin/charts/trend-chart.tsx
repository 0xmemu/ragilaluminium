import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/admin/ui/chart"

/**
 * TrendChart dipisah dari halaman StorePerformance agar recharts di-load
 * lazy (chunk terpisah) dan tidak membebani bundle halaman admin utama.
 */
export default function TrendChart<T extends { label: string }>({ series }: { series: T[] }) {
  const chartConfig = {
    value: {
      label: "Nilai",
      // Merah brand (token --sale): konsisten di admin gelap & terang.
      // Jangan pakai --primary: di admin dia hitam pekat (mode terang) atau
      // putih (mode gelap) sehingga tren sulit dibaca.
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
        <Bar dataKey="value" radius={2} fill="var(--color-value)" />
      </BarChart>
    </ChartContainer>
  )
}