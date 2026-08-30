import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { SortArrowsIcon } from "@/components/public/filter-berdasarkan-control"
import { PageHeader } from "@/components/public/page-header"
import { SortMenu } from "@/components/public/model-sort-menu"
import { Icon } from "@/components/shared/icon"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { ModelCategoryCard } from "@/components/public/model-category-card"
import PublicLayout from "@/layouts/public-layout"
import { formatNumber } from "@/lib/format"
import { routeUrl } from "@/lib/routes"
import { cn } from "@/lib/utils"
import type { ModelCardData } from "@/types"

interface ModelProdukProps {
  models: ModelCardData[]
  activeSort?: "admin" | "latest" | "oldest"
}

export default function ModelProduk({ models = [], activeSort = "admin" }: ModelProdukProps) {
  const [sort, setSort] = React.useState<string>(activeSort)

  React.useEffect(() => {
    // Inertia navigation can replace the active sort while this page instance remains mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSort(activeSort)
  }, [activeSort])

  function selectSort(value: string) {
    setSort(value)
    router.get(
      routeUrl("catalog.index"),
      value ? { sort: value } : {},
      { preserveState: true, preserveScroll: true, replace: true },
    )
  }

  const totalCount = models.reduce((sum, model) => sum + (Number(model.count) || 0), 0)

  return (
    <PublicLayout>
      <Head title="Model Produk">
        <meta
          name="description"
          content="Bandingkan model jendela, pintu, dan boven aluminium berdasarkan jenis bukaan dan desain."
        />
      </Head>

      <section className="border-b border-border bg-surface">
        <div className="container-page hidden md:block py-2 !px-2.5 md:!px-8 lg:!px-12">
          <Breadcrumbs
            items={[
              { label: "Beranda", href: routeUrl("home") },
              { label: "Model Produk" },
            ]}
          />
        </div>
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <PageHeader title="Model Produk" container={false} className="border-b-0" />
        </div>
      </section>

      <section className="bg-surface py-0">
        <div className="container-page !px-2.5 md:!px-8 lg:!px-12">
          <div className="flex items-center justify-between gap-4 pt-2 pb-1.5 sm:pt-2.5 sm:pb-2">
            <p className="text-xs text-muted-foreground sm:text-sm">
              {formatNumber(totalCount)} model produk ditemukan
            </p>
            <SortMenu value={sort} onChange={selectSort} />
          </div>
        </div>
      </section>

      <section className="container-page !px-2.5 md:!px-8 lg:!px-12 py-5 md:py-8">
        {models.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {models.map((model) => (
              <ModelCategoryCard key={`${model.category}-${model.model}`} model={model} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="funnel"
            title="Belum ada model yang cocok"
            description="Model produk belum tersedia pada katalog aktif."
          />
        )}
      </section>
    </PublicLayout>
  )
}
