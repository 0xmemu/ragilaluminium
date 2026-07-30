<?php

namespace Database\Seeders;

use App\Models\CmsProblemSolution;
use App\Support\ProblemsSolutionsSettings;
use Illuminate\Database\Seeder;

class ProblemsSolutionsSeeder extends Seeder
{
    public function run(): void
    {
        $pageId = ProblemsSolutionsSettings::pageId();

        ProblemsSolutionsSettings::updatePageMeta([
            'title' => 'Masalah & Solusi',
            'heading' => 'Masalah & Solusi',
            'subtitle' => 'Temukan solusi untuk masalah yang mungkin Anda hadapi.',
            'published' => true,
        ]);

        $defaults = [
            [
                'problem' => 'Barang rusak saat diterima',
                'solution' => json_encode([
                    'type' => 'rich',
                    'examples_label' => 'Contoh kondisi kerusakan',
                    'examples_hint' => 'Kaca retak, kusen penyok, komponen patah, atau kemasan rusak saat diterima kurir.',
                    'photos' => [],
                    'video' => null,
                    'solutions_label' => 'Solusi yang kami tawarkan',
                    'lead' => 'Jika barang rusak saat diterima, Anda bisa memilih:',
                    'options' => [
                        [
                            'title' => 'Pengembalian barang & dana (gratis)',
                            'description' => 'Kami atur pengambilan barang dan pengembalian dana tanpa biaya tambahan setelah kondisi diverifikasi.',
                            'icon' => 'package',
                        ],
                        [
                            'title' => 'Perbaikan di tempat Anda (biaya kami tanggung)',
                            'description' => 'Tim kami mengecek kerusakan dan melakukan perbaikan di lokasi Anda. Biaya perbaikan ditanggung kami setelah estimasi disetujui.',
                            'icon' => 'wrench',
                        ],
                    ],
                    'whatsapp_note' => 'Kirim foto kondisi barang melalui WhatsApp kami agar penanganan lebih cepat.',
                ], JSON_UNESCAPED_UNICODE),
                'sort_order' => 0,
            ],
            [
                'problem' => 'Sliding macet / seret',
                'solution' => 'Bersihkan rel dari debu dan kotoran yang menumpuk. Oleskan pelumas khusus rel aluminium secara berkala. Jika masih seret setelah perawatan rutin, hubungi kami untuk pengecekan engsel dan penyesuaian daun jendela.',
                'sort_order' => 1,
            ],
            [
                'problem' => 'Ukuran tidak sesuai',
                'solution' => 'Ukur ulang bukaan tembok (tinggi x lebar luar kusen). Hubungi kami via WhatsApp dengan foto bukaan dan nomor pesanan. Kami bantu evaluasi penggantian atau penyesuaian sesuai ketentuan garansi.',
                'sort_order' => 2,
            ],
            [
                'problem' => 'Kaca berembun',
                'solution' => 'Pastikan sirkulasi udara cukup dan karet seal terpasang rapat. Untuk kaca double layer, embun di antara kaca bisa menandakan seal rusak. Hubungi kami untuk inspeksi dan rekomendasi perbaikan.',
                'sort_order' => 3,
            ],
            [
                'problem' => 'Masalah lainnya',
                'solution' => 'Jelaskan kendala Anda via WhatsApp beserta foto atau video singkat. Tim kami merespons dan menyarankan langkah berikutnya sesuai ketentuan layanan toko.',
                'sort_order' => 4,
            ],
        ];

        $problems = array_column($defaults, 'problem');

        CmsProblemSolution::query()
            ->where('cms_page_id', $pageId)
            ->whereNotIn('problem', $problems)
            ->delete();

        foreach ($defaults as $row) {
            CmsProblemSolution::query()->updateOrCreate(
                [
                    'cms_page_id' => $pageId,
                    'problem' => $row['problem'],
                ],
                [
                    'solution' => $row['solution'],
                    'sort_order' => $row['sort_order'],
                ],
            );
        }

        $this->command?->info('Masalah & Solusi default siap ('.count($defaults).' item).');
    }
}
