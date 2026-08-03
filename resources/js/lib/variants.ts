import type { ProductVariant } from "@/types"

export interface VariantAxis {
  name: string
  options: string[]
}

export type VariantSelections = Record<string, string>

const COLORS = ["Serat Kayu", "Hitam", "Putih", "Cokelat"] as const
const GLASSES = ["Kaca Bening", "Kaca Riben", "Kaca Es"] as const

const OPENING_RE = /^Buka\s+(Kanan|Kiri)$/i
const COLOR_ALT = COLORS.map(escapeRegExp).join("|")
const GLASS_ALT = GLASSES.map(escapeRegExp).join("|")
const COLOR_GLASS_RE = new RegExp(`^(${COLOR_ALT})\\s+(${GLASS_ALT})$`, "i")

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * Normalize Shopee typos only — do not reinterpret door finishing as window axes.
 * "KcaBening" / "KacaRiben" → spaced "Kaca …".
 */
export function normalizeVariationOption(value: string | null | undefined): string | null {
  if (!value) return null
  let text = value.trim()
  if (!text) return null
  text = text.replace(/\bKca(?=\s*[A-Za-z])/gi, "Kaca")
  text = text.replace(/\bKaca(?=[A-Za-z])/g, "Kaca ")
  text = text.replace(/\s+/g, " ").trim()
  return text || null
}

export function isOpeningDirection(value: string | null | undefined): boolean {
  return Boolean(value && OPENING_RE.test(value.trim()))
}

/** True when option is door-style combined finishing (not window "Kaca Bening" alone). */
export function isCombinedColorGlass(value: string | null | undefined): boolean {
  const text = normalizeVariationOption(value)
  if (!text) return false
  return COLOR_GLASS_RE.test(text)
}

export function splitColorGlass(
  value: string | null | undefined,
): { color: string; glass: string } | null {
  const text = normalizeVariationOption(value)
  if (!text) return null
  const match = text.match(COLOR_GLASS_RE)
  if (!match) return null
  const color = COLORS.find((item) => item.toLowerCase() === match[1].toLowerCase()) ?? match[1]
  const glass = GLASSES.find((item) => item.toLowerCase() === match[2].toLowerCase()) ?? match[2]
  return { color, glass }
}

function openingLabel(value: string): string {
  if (/kanan/i.test(value)) return "Buka Kanan"
  if (/kiri/i.test(value)) return "Buka Kiri"
  return value.trim()
}

/**
 * Door Shopee axes ≠ window/bouven.
 * - Door swing: Arah Buka + Warna & Kaca (combined finishing string as Shopee sends).
 * - Window/bouven: Warna + Kaca (separate slots).
 * Never split door finishing into Warna/Kaca selectors.
 */
function axisNameForPair(
  name: string | null | undefined,
  option: string | null | undefined,
): string | null {
  if (!name || !option) return null
  if (isOpeningDirection(option) || /^arah\s*buka$/i.test(name)) {
    return "Arah Buka"
  }
  if (/^warna\s*&\s*kaca$/i.test(name) || isCombinedColorGlass(option)) {
    return "Warna & Kaca"
  }
  return name
}

function normalizeAxisOption(name: string, option: string): string {
  const cleaned = normalizeVariationOption(option) ?? option
  if (name === "Arah Buka") return openingLabel(cleaned)
  if (name === "Warna & Kaca") {
    const split = splitColorGlass(cleaned)
    return split ? `${split.color} ${split.glass}` : cleaned
  }
  if (name === "Kaca") {
    const glassOnly = cleaned.match(new RegExp(`(${GLASS_ALT})$`, "i"))
    if (glassOnly?.[1]) {
      return GLASSES.find((item) => item.toLowerCase() === glassOnly[1].toLowerCase()) ?? glassOnly[1]
    }
  }
  return cleaned
}

function variantPairs(variant: ProductVariant): Array<[string, string]> {
  const pairs: Array<[string, string]> = []

  const firstName = axisNameForPair(variant.variation_1_name, variant.variation_1_option)
  const firstOption = normalizeVariationOption(variant.variation_1_option)
  if (firstName && firstOption) {
    pairs.push([firstName, normalizeAxisOption(firstName, firstOption)])
  }

  const secondName = axisNameForPair(variant.variation_2_name, variant.variation_2_option)
  const secondOption = normalizeVariationOption(variant.variation_2_option)
  if (secondName && secondOption) {
    // Keep door finishing as one axis — same two Shopee slots, different semantics than window.
    pairs.push([secondName, normalizeAxisOption(secondName, secondOption)])
  }

  return pairs
}

export function variantAxes(variants: ProductVariant[]): VariantAxis[] {
  const axes = new Map<string, Set<string>>()

  variants.forEach((variant) => {
    variantPairs(variant).forEach(([name, option]) => {
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

  const preferredOrder = ["Arah Buka", "Warna & Kaca", "Warna", "Kaca", "Ukuran"]

  // Urutan tampilan opsi di dalam tiap axis.
  const optionOrder: Record<string, string[]> = {
    Warna: ["Putih", "Hitam", "Cokelat", "Serat Kayu"],
    Kaca: ["Kaca Bening", "Kaca Riben", "Kaca Es"],
  }

  function sortOptions(name: string, options: string[]): string[] {
    const order = optionOrder[name] ?? []
    return [...options].sort((a, b) => {
      const ai = order.findIndex((o) => o.toLowerCase() === a.toLowerCase())
      const bi = order.findIndex((o) => o.toLowerCase() === b.toLowerCase())
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.localeCompare(b, "id")
    })
  }

  return Array.from(axes, ([name, options]) => ({
    name,
    options: sortOptions(name, Array.from(options)),
  })).sort((a, b) => {
    const ai = preferredOrder.indexOf(a.name)
    const bi = preferredOrder.indexOf(b.name)
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })
}

function variantMatchesSelections(
  variant: ProductVariant,
  selections: VariantSelections,
  axes: VariantAxis[],
): boolean {
  const pairs = new Map(variantPairs(variant))

  if (axes.some((axis) => axis.name === "Ukuran")) {
    const dimension = variant.dimension_label ?? variant.dimension_compact
    if (dimension) pairs.set("Ukuran", dimension)
  }

  return axes.every((axis) => {
    const selected = selections[axis.name]
    if (!selected) return false
    return pairs.get(axis.name) === selected
  })
}

export function resolveVariant(
  variants: ProductVariant[],
  selections: VariantSelections,
): ProductVariant | null {
  if (variants.length === 1) return variants[0]

  const axes = variantAxes(variants)
  if (axes.length === 0) return null
  if (axes.some((axis) => !selections[axis.name])) return null

  return variants.find((variant) => variantMatchesSelections(variant, selections, axes)) ?? null
}

export function firstAvailableSelections(_variants: ProductVariant[]): VariantSelections {
  // Default: tidak ada opsi yang terpilih. Pengguna harus memilih setiap axis
  // (Warna, Kaca, dll.) secara eksplisit sebelum varian ditemukan dan
  // tombol "Tambah ke keranjang" / "Beli Sekarang" bisa diklik.
  return {}
}
