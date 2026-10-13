<?php

namespace App\Support;

/**
 * Verifikator berkas import katalog format v2 (pre-pass all-or-nothing).
 *
 * Aturan yang dijalankan:
 *  V1  Baris satu grup (NO. ID sama) harus berurutan, tidak berpencar.
 *  V2  Satu NO. ID hanya boleh punya satu nama produk.
 *  V3  Kombinasi Opsi Variasi 1 + Opsi Variasi 2 unik dalam satu grup.
 *  V4  Nama variasi konsisten dalam satu grup.
 *  V5  Harga wajib lebih dari nol di setiap baris.
 *  V6  Foto utama (Gambar 1 (utama)) wajib ada di grup.
 *  V7  Berat dan dimensi wajib di baris pertama grup (syarat aktivasi).
 *  V8  Identitas produk (nama + kategori + model + sub-model) belum ada pada
 *      produk aktif dan tidak dobel dalam berkas (pola Shopee: Mass Upload
 *      hanya untuk produk baru; perubahan lewat template Update).
 *
 * Perbedaan mendasar dari verifier lama: satu baris = satu varian, sehingga
 * kombinasi terbentuk dari kolom Opsi Variasi 1 dan 2, bukan kolom khusus.
 *
 * @return list<string> daftar pesan galat (kosong = lolos)
 */
final class CatalogImportVerifierV2
{
    public static function verify(array $rows): array
    {
        $errors = [];

        // Buang baris kosong dan baris keterangan sheet Contoh.
        $rows = array_values(array_filter($rows, static function ($row): bool {
            if (! is_array($row)) {
                return false;
            }

            return trim((string) ($row['nama_produk'] ?? '')) !== ''
                || trim((string) ($row['no_id'] ?? '')) !== '';
        }));

        if ($rows === []) {
            return ['Berkas tidak memuat baris data. Isi sheet Data terlebih dahulu.'];
        }

        $groups = self::group($rows);

        // V8: identitas produk aktif yang sudah ada, dikunci dari database
        // sekali supaya verifikasi berkas besar tetap satu kali query.
        $existing = [];
        foreach (\App\Models\Product::query()->where('status', 'active')
            ->get(['id', 'parent_sku', 'name', 'product_category', 'product_model', 'design_variant']) as $p) {
            $existing[self::identityKey($p->name, $p->product_category, $p->product_model, $p->design_variant)] = $p->parent_sku;
        }
        $seenInFile = [];

        foreach ($groups as $noId => $rowIndexes) {
            $label = $noId === '' ? '(NO. ID kosong)' : $noId;

            // V1: grup harus kontigu.
            if (count($rowIndexes) > 1) {
                $span = range(min($rowIndexes), max($rowIndexes));
                if (count($span) !== count($rowIndexes)) {
                    $errors[] = 'Grup NO. ID "'.$label.'" tidak berurutan. '
                        .'Kumpulkan baris dengan NO. ID sama dalam satu blok.';
                }
            }

            $names = [];
            $signatures = [];
            $combos = [];
            $hasMainImage = false;

            foreach ($rowIndexes as $i) {
                $row = $rows[$i];
                $rowNo = $i + 2;

                $name = trim((string) ($row['nama_produk'] ?? ''));
                if ($name !== '') {
                    $names[strtolower($name)] = $rowNo;
                }

                // V4: nama variasi konsisten.
                $sig = trim((string) ($row['nama_variasi_1'] ?? '')).'|'.trim((string) ($row['nama_variasi_2'] ?? ''));
                if ($sig !== '|') {
                    $signatures[$sig] = $rowNo;
                }

                // V3: kombinasi varian unik.
                $combo = trim((string) ($row['opsi_variasi_1'] ?? '')).' + '.trim((string) ($row['opsi_variasi_2'] ?? ''));
                $combo = trim($combo, ' +');
                if ($combo !== '') {
                    if (isset($combos[strtolower($combo)])) {
                        $errors[] = 'Baris '.$rowNo.': kombinasi "'.$combo.'" duplikat dengan baris '
                            .$combos[strtolower($combo)].' pada NO. ID "'.$label.'".';
                    } else {
                        $combos[strtolower($combo)] = $rowNo;
                    }
                }

                // V5: harga wajib lebih dari nol pada setiap baris varian.
                $harga = \App\Support\NumberCellNormalizer::parse($row['harga'] ?? null);
                if ($harga === null || $harga <= 0) {
                    $errors[] = 'Baris '.$rowNo.': Harga kosong, tidak valid, atau nol pada NO. ID "'.$label.'".';
                }

                if (trim((string) ($row['gambar_1_utama'] ?? '')) !== '') {
                    $hasMainImage = true;
                }
            }

            // V2: satu grup satu nama.
            if (count($names) > 1) {
                $parts = [];
                foreach ($names as $n => $rowNo) {
                    $parts[] = '"'.$n.'" (baris '.$rowNo.')';
                }
                $errors[] = 'NO. ID "'.$label.'" memuat nama berbeda: '.implode(' dan ', $parts)
                    .'. Samakan Nama Produk dalam satu grup.';
            }

            // V4: satu grup satu definisi variasi.
            if (count($signatures) > 1) {
                $errors[] = 'NO. ID "'.$label.'" memuat nama variasi berbeda antar baris. '
                    .'Samakan Nama Variasi 1 dan Nama Variasi 2 dalam satu grup.';
            }

            // V6: foto utama wajib.
            if (! $hasMainImage) {
                $errors[] = 'NO. ID "'.$label.'" (baris '.($rowIndexes[0] + 2)
                    .') tidak punya Gambar 1 (utama). Foto utama wajib agar produk bisa aktif.';
            }

            // V7: berat dan dimensi wajib di baris pertama grup.
            $first = $rows[$rowIndexes[0]];
            $firstRowNo = $rowIndexes[0] + 2;
            foreach (['berat_kg' => 'Berat (Kg)', 'tinggi_cm' => 'Tinggi (cm)', 'panjang_cm' => 'Panjang (cm)', 'lebar_cm' => 'Lebar (cm)'] as $key => $label2) {
                $value = $first[$key] ?? null;
                if ($value === null || $value === '' || (float) str_replace(',', '.', (string) $value) <= 0) {
                    $errors[] = 'Baris '.$firstRowNo.': '.$label2.' wajib diisi lebih dari nol pada baris pertama grup NO. ID "'.$label.'".';
                }
            }

            // V8: identitas tidak boleh sudah ada aktif dan tidak boleh dobel
            // dalam berkas. Pesan menyebut SKU existing dan mengarahkan ke
            // template Update, mengikuti pola Mass Upload Shopee.
            $groupName = trim((string) ($first['nama_produk'] ?? ''));
            if ($groupName !== '') {
                $identity = self::identityKey(
                    $groupName,
                    $first['kategori_produk'] ?? null,
                    $first['model_produk'] ?? null,
                    $first['sub_model'] ?? null,
                );
                if (isset($seenInFile[$identity])) {
                    $errors[] = 'Baris '.$firstRowNo.': produk "'.$groupName.'" duplikat dengan grup NO. ID "'
                        .$seenInFile[$identity].'" dalam berkas yang sama. Satu produk hanya boleh muncul sekali.';
                } else {
                    $seenInFile[$identity] = $label;
                    if (isset($existing[$identity])) {
                        $errors[] = 'Baris '.$firstRowNo.': produk "'.$groupName.'" sudah ada (SKU '.$existing[$identity]
                            .'). Gunakan template Update Produk atau Update Media untuk mengubahnya, atau hapus baris '
                            .'ini bila memang mau membuat produk baru bernama sama.';
                    }
                }
            }
        }

        return $errors;
    }

    /** Kunci identitas V8: nama + taksonomi ternormalisasi, sama seperti yang disimpan importer. */
    protected static function identityKey(mixed $name, mixed $kategori, mixed $model, mixed $subModel): string
    {
        $kategori = trim((string) $kategori);
        $model = trim((string) $model);
        $subModel = trim((string) $subModel);

        return strtolower(trim((string) $name)).'|'
            .(string) (CatalogLabels::normalizeCategory($kategori) ?? '').'|'
            .(string) (CatalogLabels::normalizeModel($model) ?? '').'|'
            .(string) (CatalogLabels::normalizeDesign($subModel !== '' ? $subModel : null) ?? '');
    }

    /** Kelompokkan indeks baris per NO. ID. Grup tanpa NO. ID memakai nama
     * produk sebagai kunci supaya berkas satu-produk tetap terbaca.
     *
     * @return array<string, list<int>>
     */
    private static function group(array $rows): array
    {
        $groups = [];
        foreach ($rows as $i => $row) {
            $noId = trim((string) ($row['no_id'] ?? ''));
            if ($noId === '') {
                $noId = 'nama:'.trim((string) ($row['nama_produk'] ?? ''));
            }
            $groups[$noId][] = $i;
        }

        return $groups;
    }
}
