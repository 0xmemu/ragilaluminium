<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Penata gaya bersama untuk ketiga template katalog v2.
 *
 * Dipakai eksportir supaya warna grup, penguncian kolom, format teks, dan
 * dropdown selalu sama di template Import Produk, Update Produk, dan Update
 * Media. Logika gaya tidak ditulis ulang per berkas.
 */
final class CatalogTemplateV2Styler
{
    /** Baris pertama data (baris 1 adalah header). */
    public const FIRST_DATA_ROW = 2;

    /**
     * Tulis header dengan warna per grup fungsi, lalu kunci kolom identitas.
     *
     * @param  list<array{header: string, group: int, locked?: bool}>  $columns
     */
    public static function styleHeader(Worksheet $sheet, array $columns): void
    {
        $count = count($columns);

        foreach ($columns as $i => $col) {
            $letter = Coordinate::stringFromColumnIndex($i + 1);
            $cell = $sheet->getCell($letter.'1');
            $cell->setValue($col['header']);
            $sheet->getStyle($letter.'1')->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => CatalogTemplateV2::GROUP_COLORS[$col['group']]],
                ],
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                    'vertical' => Alignment::VERTICAL_CENTER,
                    'wrapText' => true,
                ],
            ]);
        }

        if ($count > 0) {
            $last = Coordinate::stringFromColumnIndex($count);
            $sheet->getRowDimension(1)->setRowHeight(30);
            $sheet->freezePane('A'.self::FIRST_DATA_ROW);
            $sheet->getStyle('A1:'.$last.'1')->getBorders()->getAllBorders()->applyFromArray([
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['argb' => 'FFDEE3E0'],
            ]);
        }
    }

    /**
     * Kunci kolom identitas dan beri warna abu supaya admin melihat kolom mana
     * yang tidak boleh disentuh. Sheet protection pada Excel hanya pencegah
     * salah isi, bukan keamanan; importer tetap menolak perubahan identitas.
     *
     * @param  list<array{locked?: bool}>  $columns
     */
    public static function protectLockedColumns(Worksheet $sheet, array $columns, int $lastRow): void
    {
        $sheet->getProtection()->setSheet(true);
        // Seluruh sel dibiarkan TERBUKA secara default, lalu kolom identitas
        // ditutup satu per satu. Pendekatan ini menghindari admin terkunci
        // dari kolom yang memang boleh dia ubah.
        self::unlockAll($sheet, count($columns), $lastRow);

        foreach ($columns as $i => $col) {
            if (empty($col['locked'])) {
                continue;
            }
            $letter = Coordinate::stringFromColumnIndex($i + 1);
            $range = $letter.self::FIRST_DATA_ROW.':'.$letter.$lastRow;
            $sheet->getStyle($range)->getProtection()->setLocked(
                \PhpOffice\PhpSpreadsheet\Style\Protection::PROTECTION_PROTECTED
            );
            // Penanda visual kolom terkunci.
            $sheet->getStyle($range)->getFill()->setFillType(Fill::FILL_SOLID);
            $sheet->getStyle($range)->getFill()->getStartColor()->setARGB('FFF1F3F4');
            $sheet->getStyle($range)->getFont()->getColor()->setARGB('FF6B7280');
        }
    }

    /**
     * Proteksi untuk template yang TIDAK punya kolom identitas terisi (Import
     * Produk): seluruh sel tetap bisa diisi, tetapi header dan sel di luar area
     * data dikunci supaya admin tidak menghapus atau menggeser nama kolom.
     */
    public static function protectNonDataCells(Worksheet $sheet, int $columnCount, int $lastRow = 500): void
    {
        if ($columnCount === 0) {
            return;
        }

        $sheet->getProtection()->setSheet(true);
        $last = Coordinate::stringFromColumnIndex($columnCount);
        $sheet->getStyle(
            'A'.self::FIRST_DATA_ROW.':'.$last.max($lastRow, 500)
        )->getProtection()->setLocked(
            \PhpOffice\PhpSpreadsheet\Style\Protection::PROTECTION_UNPROTECTED
        );
    }

    /** Pasang autofilter pada baris header supaya admin bisa menyaring data. */
    public static function applyAutoFilter(Worksheet $sheet, int $columnCount, int $headerRow = 1): void
    {
        if ($columnCount === 0) {
            return;
        }
        $last = Coordinate::stringFromColumnIndex($columnCount);
        $sheet->setAutoFilter('A'.$headerRow.':'.$last.$headerRow);
    }

    /** Buka seluruh sel area data supaya hanya kolom terpilih yang terkunci. */
    private static function unlockAll(Worksheet $sheet, int $columnCount, int $lastRow): void
    {
        if ($columnCount === 0) {
            return;
        }
        $last = Coordinate::stringFromColumnIndex($columnCount);
        $sheet->getStyle('A'.self::FIRST_DATA_ROW.':'.$last.$lastRow)
            ->getProtection()
            ->setLocked(\PhpOffice\PhpSpreadsheet\Style\Protection::PROTECTION_UNPROTECTED);
    }

    /**
     * Format kolom sebagai TEKS supaya angka panjang tidak berubah jadi notasi
     * ilmiah atau kehilangan digit (pelajaran kolom identitas 12 Sep 2026).
     * Format saja tidak cukup, sehingga sel juga dinilai ulang sebagai string.
     *
     * @param  list<int>  $columnIndexes  1-based
     */
    public static function forceTextColumns(Worksheet $sheet, array $columnIndexes, int $lastRow): void
    {
        foreach ($columnIndexes as $index) {
            $letter = Coordinate::stringFromColumnIndex($index);
            $sheet->getStyle($letter.self::FIRST_DATA_ROW.':'.$letter.$lastRow)
                ->getNumberFormat()
                ->setFormatCode('@');
        }
    }

    /**
     * Tulis daftar pilihan (dropdown) pada satu kolom.
     *
     * @param  list<string>  $values
     */
    public static function listValidation(Worksheet $sheet, string $column, array $values, int $lastRow): void
    {
        $values = array_values(array_unique(array_filter($values, static fn ($v) => trim((string) $v) !== '')));
        if ($values === []) {
            return;
        }

        $formula = implode(',', $values);
        // Excel menolak formula inline yang kepanjangan; lewati dengan aman.
        if (strlen($formula) > 250) {
            return;
        }

        // WAJIB memakai setDataValidation() pada rentang, bukan getCell() per
        // baris: getCell() menciptakan sel sehingga used range sheet melar
        // sampai ratusan baris kosong dan berkas template jadi tidak bersih.
        $target = $column.self::FIRST_DATA_ROW.':'.$column.max($lastRow, 500);
        $validation = new DataValidation();
        $validation->setType(DataValidation::TYPE_LIST);
        $validation->setAllowBlank(true);
        $validation->setShowDropDown(true);
        $validation->setFormula1('"'.$formula.'"');
        $sheet->setDataValidation($target, $validation);
    }

    /** Lebar kolom: teks panjang lebih lebar, kolom pendek secukupnya. */
    public static function applyWidths(Worksheet $sheet, array $widths): void
    {
        foreach ($widths as $column => $width) {
            $sheet->getColumnDimension($column)->setWidth($width);
        }
    }
}
