import type { ProductVariant } from "@/types"

export interface VariantAxis {
  name: string
  options: string[]
}

export type VariantSelections = Record<string, string>

export function variantAxes(variants: ProductVariant[]): VariantAxis[] {
  const axes = new Map<string, Set<string>>()

  variants.forEach((variant) => {
    const pairs = [
      [variant.variation_1_name, variant.variation_1_option],
      [variant.variation_2_name, variant.variation_2_option],
    ] as const

    pairs.forEach(([name, option]) => {
      if (!name || !option) return
      if (!axes.has(name)) axes.set(name, new Set())
      axes.get(name)?.add(option)
    })
  })

  const dimensions = new Set(
    variants
      .map((variant) => variant.dimension_label ?? variant.dimension_compact)
      .filter((value): value is string => Boolean(value)),
  )
  if (dimensions.size > 1 && !axes.has("Ukuran")) {
    axes.set("Ukuran", dimensions)
  }

  return Array.from(axes, ([name, options]) => ({
    name,
    options: Array.from(options),
  }))
}

export function resolveVariant(
  variants: ProductVariant[],
  selections: VariantSelections,
): ProductVariant | null {
  if (variants.length === 1) return variants[0]

  const axes = variantAxes(variants)
  if (axes.length === 0) return null
  if (axes.some((axis) => !selections[axis.name])) return null

  return (
    variants.find((variant) => {
      const pairs: Array<readonly [string | null | undefined, string | null | undefined]> = [
        [variant.variation_1_name, variant.variation_1_option],
        [variant.variation_2_name, variant.variation_2_option],
      ]
      if (axes.some((axis) => axis.name === "Ukuran")) {
        pairs.push(["Ukuran", variant.dimension_label ?? variant.dimension_compact])
      }

      return pairs.every(([name, option]) => !name || !option || selections[name] === option)
    }) ?? null
  )
}

export function firstAvailableSelections(variants: ProductVariant[]): VariantSelections {
  const first = variants.find((variant) => variant.stock > 0) ?? variants[0]
  if (!first) return {}

  const pairs: Array<[string | null | undefined, string | null | undefined]> = [
    [first.variation_1_name, first.variation_1_option],
    [first.variation_2_name, first.variation_2_option],
  ]
  if (variantAxes(variants).some((axis) => axis.name === "Ukuran")) {
    pairs.push(["Ukuran", first.dimension_label ?? first.dimension_compact])
  }

  return Object.fromEntries(
    pairs.filter((pair): pair is [string, string] => Boolean(pair[0] && pair[1])),
  )
}
