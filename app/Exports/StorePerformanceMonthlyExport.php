<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/**
 * Wadah sheet gabungan untuk export multi-bulan Performa Toko:
 * satu file XLSX, sheet per bulan (set sheet lengkap dgn suffix nama bulan).
 */
class StorePerformanceMonthlyExport implements WithMultipleSheets
{
    /**
     * @param  list<\Maatwebsite\Excel\Concerns\WithTitle>  $sheets
     */
    public function __construct(protected array $sheets)
    {
    }

    public function sheets(): array
    {
        return $this->sheets;
    }
}
