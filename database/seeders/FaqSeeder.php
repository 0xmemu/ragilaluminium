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
                'category' => 'Umum & Profil Toko',
                'question' => 'Apakah Ragil Aluminium toko resmi?',
                'answer' => "Ya. Kami menjual jendela, pintu, dan boven aluminium secara langsung. Katalog di website adalah stok yang kami kelola; pemesanan bisa lewat checkout website atau konsultasi WhatsApp.",
                'sort_order' => 0,
            ],
            [
                'category' => 'Spesifikasi Material & Ukuran',
                'question' => 'Apakah ukuran bisa custom?',
                'answer' => "Bisa. Pilih varian terdekat di katalog, lalu tulis ukuran (tinggi x lebar) di catatan checkout atau hubungi WhatsApp agar kami bantu hitung.",
                'sort_order' => 1,
            ],
            [
                'category' => 'Spesifikasi Material & Ukuran',
                'question' => 'Apa perbedaan model jungkit, sliding, swing, dan kaca mati?',
                'answer' => "Jungkit cocok untuk ventilasi dan area yang sering kena hujan. Sliding hemat ruang untuk bukaan lebar. Swing memberi sirkulasi maksimal. Kaca mati fokus pencahayaan tanpa daun bukaan. Pilih sesuai ruang dan kebutuhan udara.",
                'sort_order' => 2,
            ],
            [
                'category' => 'Metode Pembayaran',
                'question' => 'Metode pembayaran apa saja yang tersedia?',
                'answer' => "Checkout publik mendukung transfer bank dan COD (jika COD tersedia untuk produk/area Anda). Setelah transfer, kirim bukti via WhatsApp agar pesanan diproses.",
                'sort_order' => 3,
            ],
            [
                'category' => 'Metode Pembayaran',
                'question' => 'Apakah bisa bayar COD?',
                'answer' => "COD tersedia pada produk yang bertanda COD dan jika pengaturan toko mengaktifkannya. Status COD dicek otomatis di checkout sebelum pesanan dibuat.",
                'sort_order' => 4,
            ],
            [
                'category' => 'Pengiriman & Pemasangan',
                'question' => 'Apakah ada jasa pengiriman dan pemasangan?',
                'answer' => "Pengiriman memakai kurir (J&T Cargo untuk jalur yang terintegrasi). Detail ongkir dihitung di checkout. Untuk pemasangan, hubungi kami agar dijadwalkan sesuai area Anda.",
                'sort_order' => 5,
            ],
            [
                'category' => 'Pengiriman & Pemasangan',
                'question' => 'Berapa lama pengiriman sampai lokasi saya?',
                'answer' => "Estimasi tergantung kota tujuan dan kesiapan produksi. Setelah pembayaran dikonfirmasi, kami proses dan kirim. Lacak status di menu Pesanan dengan nomor pesanan Anda.",
                'sort_order' => 6,
            ],
            [
                'category' => 'Garansi & Retur',
                'question' => 'Bagaimana jika barang rusak atau tidak sesuai?',
                'answer' => "Laporkan segera via WhatsApp dengan foto/video dan nomor pesanan. Kami bantu cek dan proses penggantian atau perbaikan sesuai ketentuan toko.",
                'sort_order' => 7,
            ],
        ];

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
