<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Parser sheet "Varian" untuk template import katalog dua-sheet.
 *
 * Input: kumpulan baris mentah sheet Varian (WithHeadingRow snake_case).
 * Output: daftar varian terurut beserta opsinya (berurutan sesuai kemunculan)
 * dan gambar per opsi.
 *
 * Aturan:
 * - varian_name boleh kosong di baris lanjutan = masih varian yang sama.
 * - varian_name baru = varian berikutnya (urut kemunculan).
 * - option kosong = baris diabaikan.
 * - image_url wajib valid bila diisi; kosong = opsi tanpa gambar.
 * - installation_image_url opsional per opsi.
 */
class VariantSheetParser
{
    /**
     * @param  iterable<array<string, mixed>>  $rows  baris sheet Varian (toArray per baris)
     * @return array{variants: list<array{name: string, options: list<array{option: string, image_url: ?string, installation_image_url: ?string}>}>, errors: list<string>}
     */
    public static function parse(iterable $rows): array
    {
        $variants = [];
        $current = null;
        $errors = [];

        foreach ($rows as $index => $row) {
            $name = trim((string) ($row['varian_name'] ?? ''));
            $option = trim((string) ($row['option'] ?? ''));
            $imageUrl = trim((string) ($row['image_url'] ?? ''));
            $installationUrl = trim((string) ($row['installation_image_url'] ?? ''));

            if ($name === '' && $option === '' && $imageUrl === '' && $installationUrl === '') {
                continue; // baris kosong
            }

            if ($name !== '') {
                $exists = null;
                foreach ($variants as $variant) {
                    if (strcasecmp($variant['name'], $name) === 0) {
                        $exists = $variant['name'];
                        break;
                    }
                }
                if ($exists !== null) {
                    $errors[] = 'Baris '.($index + 2).': varian_name "'.$name.'" duplikat, opsi digabung ke varian yang sudah ada.';
                    $current = $exists;
                } else {
                    $variants[] = ['name' => $name, 'options' => []];
                    $current = $name;
                }
            }

            if ($current === null) {
                $errors[] = 'Baris '.($index + 2).': option diisi tanpa varian_name di atasnya.';
                continue;
            }

            if ($option === '') {
                continue;
            }

            if ($imageUrl !== '' && ! filter_var($imageUrl, FILTER_VALIDATE_URL)) {
                $errors[] = 'Baris '.($index + 2).': image_url tidak valid: '.$imageUrl;
                continue;
            }
            if ($installationUrl !== '' && ! filter_var($installationUrl, FILTER_VALIDATE_URL)) {
                $errors[] = 'Baris '.($index + 2).': installation_image_url tidak valid: '.$installationUrl;
                continue;
            }

            foreach ($variants as $i => $variant) {
                if ($variant['name'] === $current) {
                    foreach ($variant['options'] as $existingOption) {
                        if (strcasecmp($existingOption['option'], $option) === 0) {
                            $errors[] = 'Baris '.($index + 2).': option "'.$option.'" duplikat pada varian "'.$current.'".';
                            continue 3;
                        }
                    }
                    $variants[$i]['options'][] = [
                        'option' => $option,
                        'image_url' => $imageUrl !== '' ? $imageUrl : null,
                        'installation_image_url' => $installationUrl !== '' ? $installationUrl : null,
                    ];
                    break;
                }
            }
        }

        return ['variants' => $variants, 'errors' => $errors];
    }

    /**
     * Ambil baris sheet "Varian" dari spreadsheet file import apa pun
     * (jika sheet tidak ada, kembalikan null agar importer jatuh ke skema lama).
     *
     * @return array{rows: list<array<string, mixed>>}|null
     */
    public static function extractVariantRows(string $filePath): ?array
    {
        if (! is_file($filePath)) {
            return null;
        }
        try {
            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($filePath);
            $reader->setReadDataOnly(true);
            $sheetNames = $reader->listWorksheetInfo($filePath);
        } catch (\Throwable) {
            return null;
        }

        $hasVariantSheet = false;
        foreach ($sheetNames as $info) {
            if (strcasecmp((string) $info['worksheetName'], 'Varian') === 0) {
                $hasVariantSheet = true;
                break;
            }
        }
        if (! $hasVariantSheet) {
            return null;
        }

        $sheetData = [];
        try {
            $reader->setLoadSheetsOnly(['Varian']);
            $spreadsheet = $reader->load($filePath);
            $sheet = $spreadsheet->getSheetByName('Varian');
            if ($sheet === null) {
                return null;
            }
            foreach ($sheet->toArray(null, true, true, true) as $row) {
                $sheetData[] = $row;
            }
        } catch (\Throwable) {
            return null;
        }

        if (count($sheetData) < 2) {
            return ['rows' => []];
        }

        $header = array_map(
            fn ($cell) => strtolower(trim((string) preg_replace('/\s+/', '_', (string) $cell))),
            $sheetData[0],
        );
        $rows = [];
        foreach (array_slice($sheetData, 1) as $row) {
            $mapped = [];
            foreach ($header as $col => $key) {
                if ($key !== '') {
                    $mapped[$key] = $row[$col] ?? null;
                }
            }
            $rows[] = $mapped;
        }

        return ['rows' => $rows];
    }

    /**
     * Map opsi -> URL gambar untuk satu produk, dari hasil parse().
     * Kunci = strtolower(option). Gambar installation terpisah berdasar flag.
     *
     * @param  list<array{name: string, options: list<array{option: string, image_url: ?string, installation_image_url: ?string}>}>  $variants
     * @return array{images: array<string, string>, installations: array<string, string>}
     */
    public static function optionImageMap(array $variants): array
    {
        $images = [];
        $installations = [];
        foreach ($variants as $variant) {
            foreach ($variant['options'] as $opt) {
                if ($opt['image_url'] !== null) {
                    $images[self::optionKey($opt['option'])] = $opt['image_url'];
                }
                if ($opt['installation_image_url'] !== null) {
                    $installations[self::optionKey($opt['option'])] = $opt['installation_image_url'];
                }
            }
        }

        return ['images' => $images, 'installations' => $installations];
    }

    public static function optionKey(string $option): string
    {
        return strtolower(trim(preg_replace('/\s+/', '_', $option)));
    }
}
