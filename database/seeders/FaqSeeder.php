<?php

namespace Database\Seeders;

use App\Models\CmsFaqItem;
use App\Support\FaqSettings;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    public function run(): void
    {
        $pageId = FaqSettings::pageId();

        FaqSettings::updatePageMeta([
            'title' => 'Sering Ditanyakan',
            'heading' => 'Sering Ditanyakan',
            'subtitle' => 'Jawaban singkat untuk pertanyaan yang paling sering diajukan pembeli.',
            'published' => true,
        ]);

        $defaults = [
            [
                'category' => 'Spesifikasi Material & Ukuran',
                'question' => 'Ukuran yang tertera itu ukuran kaca atau kusen?',
                'answer' => 'Semua ukuran yang tertera adalah ukuran total atau luar kusen.',
                'sort_order' => 0,
            ],
            [
                'category' => 'Spesifikasi Material & Ukuran',
                'question' => 'Apakah bisa pesan custom ukuran?',
                'answer' => 'Bisa. Silakan infokan model dan ukuran yang dibutuhkan.',
                'sort_order' => 1,
            ],
            [
                'category' => 'Umum & Profil Toko',
                'question' => 'Apakah pesanan akan dikonfirmasi sebelum diproses?',
                'answer' => 'Ya, kami akan konfirmasi detail pesanan Anda via WhatsApp sebelum diproses.',
                'sort_order' => 2,
            ],
            [
                'category' => 'Pengiriman & Pemasangan',
                'question' => 'Berapa lama proses pengiriman?',
                'answer' => 'Pesanan diproses dan dikirim maksimal 1 hari kerja setelah konfirmasi.',
                'sort_order' => 3,
            ],
            [
                'category' => 'Pengiriman & Pemasangan',
                'question' => 'Bagaimana packing produk saat dikirim?',
                'answer' => 'Kami menggunakan packing kayu dan perlindungan tambahan agar produk aman sampai di tujuan.',
                'sort_order' => 4,
            ],
            [
                'category' => 'Umum & Profil Toko',
                'question' => 'Apakah ada garansi produk?',
                'answer' => 'Ya, kami memberikan garansi jika terjadi kerusakan atau ketidaksesuaian produk.',
                'sort_order' => 5,
            ],
            [
                'category' => 'Metode Pembayaran',
                'question' => 'Apakah tersedia pembayaran COD?',
                'answer' => 'Ya. COD selalu tersedia di checkout sebagai salah satu pilihan pembayaran di samping transfer bank.',
                'sort_order' => 6,
            ],
        ];

        $questions = array_column($defaults, 'question');

        CmsFaqItem::query()
            ->where('cms_page_id', $pageId)
            ->whereNotIn('question', $questions)
            ->update(['status' => CmsFaqItem::STATUS_ARCHIVED]);

        foreach ($defaults as $row) {
            CmsFaqItem::query()->updateOrCreate(
                [
                    'cms_page_id' => $pageId,
                    'question' => $row['question'],
                ],
                [
                    'answer' => $row['answer'],
                    'category' => $row['category'],
                    'status' => CmsFaqItem::STATUS_ACTIVE,
                    'sort_order' => $row['sort_order'],
                ],
            );
        }

        $this->command?->info('FAQ default siap ('.count($defaults).' item).');
    }
}
