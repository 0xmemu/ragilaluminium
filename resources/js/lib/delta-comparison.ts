/**
 * Keterangan pembanding untuk badge perubahan antar periode.
 *
 * Dipisah dari komponen supaya susunan barisnya bisa diuji tanpa merender
 * React, dan supaya halaman serta komponen memakai kalimat yang sama.
 */

export interface DeltaComparison {
  /** Nilai periode ini, sudah diformat. */
  current: string
  /** Nilai periode sebelumnya, sudah diformat. */
  previous: string
  /** Rentang pembanding, mis. "24 Jul 2026 - 22 Agt 2026". */
  period?: string
}

/**
 * Baris keterangan yang tampil saat kursor diarahkan ke badge perubahan.
 *
 * Nilai periode sebelumnya selalu disertakan, karena persentase saja tidak
 * memberi tahu angka asalnya: naik 380 persen dari 17 juta dan naik 380 persen
 * dari nol adalah dua keadaan yang berbeda, dan pemilik toko menindaklanjutinya
 * dengan cara yang berbeda. Tanpa angka asalnya, pembaca harus menebak apakah
 * kenaikan itu berarti atau hanya efek dari angka yang kecil.
 *
 * Metrik bercakupan sekarang tidak sampai ke sini, karena halaman tidak
 * membentuk keterangan pembanding untuk metrik yang memang tidak dibandingkan.
 */
export function barisBandingkan(comparison: DeltaComparison): string[] {
  const baris = [
    `Periode ini: ${comparison.current}`,
    `Periode sebelumnya: ${comparison.previous}`,
  ]

  if (comparison.period) {
    baris.push(`Rentang pembanding: ${comparison.period}`)
  }

  return baris
}
