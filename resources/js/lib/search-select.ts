export interface SearchSelectOption {
  value: string
  label: string
}

/**
 * Filter opsi pemilih bercari: substring case-insensitive pada label.
 * Fungsi murni agar bisa diuji Vitest tanpa merender komponen.
 */
export function filterSearchOptions(
  options: SearchSelectOption[],
  query: string,
): SearchSelectOption[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return options
  return options.filter((option) => option.label.toLowerCase().includes(needle))
}

/**
 * Baris opsi pemilih bercari. `custom` menandai baris "Pakai <ketikan>" yang
 * hanya muncul saat pemilih mengizinkan nilai baru (creatable).
 */
export interface SearchSelectRow extends SearchSelectOption {
  custom?: boolean
}

/**
 * Susun baris akhir pemilih: hasil filter ditambah satu baris nilai baru bila
 * pemilih bersifat creatable dan ketikan belum ada padanannya.
 *
 * Dipakai pemilih Sub Model produk, yang harus menerima kode sub model baru
 * (kontrak 2026-09-18: sistem tidak ketat soal daftar sub model, mis. ZIGZAG
 * dengan ORNAMEN). Fungsi murni agar bisa diuji Vitest tanpa merender komponen.
 */
export function withCreatableRow(
  options: SearchSelectOption[],
  query: string,
  creatable: boolean,
): SearchSelectRow[] {
  const filtered = filterSearchOptions(options, query)
  if (!creatable) return filtered

  const typed = query.trim()
  if (typed === "") return filtered

  const alreadyExists = options.some(
    (option) => option.value.toLowerCase() === typed.toLowerCase(),
  )
  if (alreadyExists) return filtered

  return [...filtered, { value: typed, label: typed, custom: true }]
}

export interface GroupableRow {
  product_model: string
  model_label: string
}

export interface NumberedGroupRow {
  groupHeader: boolean
  displayNumber: number
}

/**
 * Tandai awal grup per model dan hitung ulang nomor urut dalam grupnya.
 * Dipakai daftar Sub Model saat tanpa model terpilih (mode semua model).
 * Fungsi murni: tidak ada mutasi variabel di luar scope map.
 */
export function markGroupRows<T extends GroupableRow>(rows: T[]): Array<T & NumberedGroupRow> {
  let counter = 0
  let lastModel: string | null = null

  return rows.map((row) => {
    if (row.product_model !== lastModel) {
      lastModel = row.product_model
      counter = 1
      return { ...row, groupHeader: true, displayNumber: counter }
    }
    counter += 1
    return { ...row, groupHeader: false, displayNumber: counter }
  })
}
