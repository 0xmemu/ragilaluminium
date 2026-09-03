import { Head, router } from "@inertiajs/react"
import * as React from "react"

import { SortArrowsIcon } from "@/components/public/filter-berdasarkan-control"
import { PageTopBar } from "@/components/public/page-top-bar"
import { SortMenu } from "@/components/public/model-sort-menu"
import { Icon } from "@/components/shared/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/ui/empty-state"
import { ModelCategoryCard } from "@/components/public/model-category-card"
import { ShowcaseListingFrame } from "@/components/public/showcase-listing-frame"
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

      <ShowcaseListingFrame
        title="Model Produk"
        breadcrumbs={[
          { label: "Beranda", href: routeUrl("home") },
          { label: "Model Produk" },
        ]}
        countLabel={`${formatNumber(totalCount)} model produk ditemukan`}
        toolbar={<SortMenu value={sort} onChange={selectSort} />}
      >
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
      </ShowcaseListingFrame>
    </PublicLayout>
  )
}
