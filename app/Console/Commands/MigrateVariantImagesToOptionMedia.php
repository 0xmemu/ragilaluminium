<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductVariationOptionMedia;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Pindahkan gambar varian lama (menempel pada KOMBINASI) menjadi gambar per
 * NILAI OPSI.
 *
 * Default DRY-RUN: tidak menulis apa pun, hanya melaporkan rencana dan
 * konflik. Jalankan dengan --apply untuk benar-benar menulis.
 *
 * Aturan pemetaan:
 *  1. Sumbu bergambar = sumbu pertama yang opsinya punya gambar.
 *  2. Untuk setiap opsi pada sumbu itu, ambil gambar dari kombinasi pertama
 *     yang memuat opsi tersebut (urut id varian).
 *  3. Konflik dilaporkan, tidak ditebak:
 *     - satu opsi punya lebih dari satu gambar berbeda,
 *     - produk punya gambar di dua sumbu (tidak mungkin dipetakan tanpa
 *       menghilangkan salah satu).
 *  4. Baris media kombinasi lama TIDAK dihapus. Baris itu hanya ditandai
 *     diarsipkan (visibility = archived) setelah --apply, sehingga bisa
 *     dipulihkan.
 */
class MigrateVariantImagesToOptionMedia extends Command
{
    protected $signature = 'media:migrate-variant-images
                            {--apply : Tulis perubahan ke database (default hanya laporan)}
                            {--product= : Batasi ke satu parent_sku}
                            {--limit=200 : Tampilkan maksimal berapa produk pada laporan}';

    protected $description = 'Pindahkan gambar varian per kombinasi menjadi gambar per opsi (dry-run default).';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $only = trim((string) $this->option('product'));
        $limit = max(1, (int) $this->option('limit'));

        $query = Product::query()
            ->whereHas('media', fn ($q) => $q->whereNotNull('product_variant_id'))
            ->with([
                'variants' => fn ($q) => $q->orderBy('id'),
                'media' => fn ($q) => $q->whereNotNull('product_variant_id')->orderBy('position')->orderBy('id'),
            ])
            ->orderBy('id');

        if ($only !== '') {
            $query->where('parent_sku', $only);
        }

        $products = $query->get();

        if ($products->isEmpty()) {
            $this->info('Tidak ada produk dengan gambar varian lama. Tidak ada yang perlu dipindahkan.');

            return self::SUCCESS;
        }

        $this->info(($apply ? 'MODE TULIS (--apply)' : 'MODE DRY-RUN (tidak menulis apa pun)'));
        $this->info('Produk diperiksa: '.$products->count());
        $this->newLine();

        $migrated = 0;
        $conflicted = 0;
        $skipped = 0;
        $written = 0;
        $archived = 0;
        $report = [];

        foreach ($products as $product) {
            $plan = $this->planFor($product);

            $blocking = array_values(array_filter(
                $plan['conflicts'],
                fn (string $line) => str_starts_with($line, 'PEMBLOKIR')
            ));

            if ($blocking !== []) {
                $conflicted++;
                $report[] = $this->formatReport($product, $plan, true);

                continue;
            }

            if ($plan['options'] === []) {
                $skipped++;
                $report[] = $this->formatReport($product, $plan, false, 'tidak ada opsi yang bisa dipetakan');

                continue;
            }

            $migrated++;
            $report[] = $this->formatReport($product, $plan, false);

            if (! $apply) {
                continue;
            }

            DB::transaction(function () use ($product, $plan, &$written, &$archived): void {
                $order = 0;
                foreach ($plan['options'] as $optionValue => $row) {
                    ProductVariationOptionMedia::updateOrCreate(
                        [
                            'product_id' => $product->id,
                            'variation_slot' => $plan['slot'],
                            'option_value' => $optionValue,
                        ],
                        [
                            'variation_name' => $plan['variation_name'],
                            'media_asset_id' => $row['media_asset_id'],
                            'source_url' => $row['source_url'],
                            'sort_order' => $order,
                        ]
                    );
                    $order++;
                    $written++;
                }

                $product->forceFill(['image_axis_slot' => $plan['slot']])->save();

                // Arsipkan (jangan hapus) media kombinasi lama supaya tidak dobel
                // di galeri dan tetap bisa dipulihkan.
                $archived += $product->media()
                    ->whereNotNull('product_variant_id')
                    ->update(['visibility' => 'archived']);
            });
        }

        foreach (array_slice($report, 0, $limit) as $line) {
            $this->line($line);
        }
        if (count($report) > $limit) {
            $this->line('... dan '.(count($report) - $limit).' produk lain tidak ditampilkan.');
        }

        $this->newLine();
        $this->table(
            ['Keterangan', 'Jumlah'],
            [
                ['Produk siap dipindahkan', $migrated],
                ['Produk dengan konflik (dilewati)', $conflicted],
                ['Produk tanpa opsi terpetakan', $skipped],
                ['Baris gambar opsi ditulis', $apply ? $written : 0],
                ['Baris media kombinasi diarsipkan', $apply ? $archived : 0],
            ]
        );

        if (! $apply) {
            $this->newLine();
            $this->warn('Belum ada yang ditulis. Jalankan ulang dengan --apply setelah laporan ini diperiksa.');
        }

        return self::SUCCESS;
    }

    /**
     * Tentukan rencana pemetaan satu produk.
     *
     * @return array{slot: int|null, variation_name: string, options: array<string, array{media_asset_id: int|null, source_url: string|null}>, conflicts: list<string>}
     */
    protected function planFor(Product $product): array
    {
        $conflicts = [];

        // Kumpulkan gambar per (slot, opsi).
        $bySlot = [];
        $variantsById = $product->variants->keyBy('id');

        foreach ($product->media as $media) {
            $variant = $variantsById->get($media->product_variant_id);
            if (! $variant) {
                continue;
            }

            for ($slot = 1; $slot <= 5; $slot++) {
                $option = trim((string) ($variant->{'variation_'.$slot.'_option'} ?? ''));
                if ($option === '') {
                    continue;
                }
                $bySlot[$slot][$option][] = [
                    'media_asset_id' => $media->media_asset_id,
                    'source_url' => $media->source_url,
                ];
            }
        }

        if ($bySlot === []) {
            return ['slot' => null, 'variation_name' => '', 'options' => [], 'conflicts' => []];
        }

        ksort($bySlot);

        // Gambar di dua sumbu adalah ARTEFAK BUG, bukan data yang sah: gambar
        // disimpan per kombinasi sehingga satu gambar ikut tercatat di setiap
        // sumbu kombinasi itu. Karena itu bukan konflik pemblokir; sumbu
        // pertama dipakai, sumbu lain diabaikan dan dilaporkan sebagai catatan.
        $slot = (int) array_key_first($bySlot);
        $ignoredSlots = array_slice(array_keys($bySlot), 1);
        $notes = [];
        foreach ($ignoredSlots as $ignored) {
            $name = $this->slotName($product, (int) $ignored);
            $notes[] = ($name !== '' ? $name : 'Variasi '.$ignored).' (slot '.$ignored.')';
        }
        if ($notes !== []) {
            $conflicts[] = 'CATATAN: gambar juga ada di '.implode(', ', $notes)
                .'; sumbu itu diabaikan karena hanya satu sumbu yang boleh bergambar';
        }
        $variationName = $this->slotName($product, $slot);

        $options = [];
        foreach ($bySlot[$slot] as $optionValue => $entries) {
            $unique = [];
            foreach ($entries as $entry) {
                $key = $entry['media_asset_id'] !== null
                    ? 'id:'.$entry['media_asset_id']
                    : 'url:'.(string) $entry['source_url'];
                $unique[$key] = $entry;
            }

            if (count($unique) > 1) {
                $conflicts[] = 'PEMBLOKIR: opsi "'.$optionValue.'" punya '.count($unique).' gambar berbeda';
                continue;
            }

            $options[$optionValue] = reset($unique);
        }

        return [
            'slot' => $slot,
            'variation_name' => $variationName,
            'options' => $options,
            'conflicts' => $conflicts,
        ];
    }

    protected function slotName(Product $product, int $slot): string
    {
        foreach ($product->variants as $variant) {
            $name = trim((string) ($variant->{'variation_'.$slot.'_name'} ?? ''));
            if ($name !== '') {
                return $name;
            }
        }

        return '';
    }

    /**
     * @param  array{slot: int|null, variation_name: string, options: array<string, mixed>, conflicts: list<string>}  $plan
     */
    protected function formatReport(Product $product, array $plan, bool $isConflict, string $note = ''): string
    {
        $label = $product->parent_sku.' | '.$product->name;

        if ($isConflict) {
            return 'KONFLIK  '.$label.' -> '.implode('; ', $plan['conflicts']);
        }

        $count = count($plan['options']);
        $slotName = $plan['variation_name'] !== '' ? $plan['variation_name'] : 'Variasi '.$plan['slot'];
        $suffix = $note !== '' ? ' ('.$note.')' : '';
        $notes = $plan['conflicts'] !== [] ? '  ['.implode('; ', $plan['conflicts']).']' : '';

        return 'SIAP     '.$label.' -> '.$slotName.' slot '.$plan['slot'].', '.$count.' opsi'.$suffix.$notes;
    }
}
