<?php

namespace Database\Seeders;

use App\Models\CmsPage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Seeder;

class CmsPageSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('cms_pages')) {
            return;
        }

        $pages = [
            'tentang-kami' => [
                'title' => 'Informasi Toko Ragil Aluminium',
                'content' => [
                    'heading' => 'Informasi Toko',
                    'body' => "Kami berkomitmen memproduksi jendela, pintu, dan bouven aluminium berkualitas dengan desain modern, daya tahan tinggi, serta keamanan yang andal untuk hunian dan proyek bangunan.\n\nSemua produk siap pasang, dilengkapi aksesoris dan baut fisher. Ukuran custom tersedia sesuai kebutuhan lapangan, dengan konfirmasi detail sebelum produksi.",
                ],
            ],
            'faq' => [
                'title' => 'Sering Ditanyakan',
                'content' => [
                    'heading' => 'Sering Ditanyakan',
                    'subtitle' => 'Jawaban singkat untuk pertanyaan yang paling sering diajukan pembeli.',
                ],
            ],
            'masalah-solusi' => [
                'title' => 'Masalah & Solusi',
                'content' => [
                    'heading' => 'Masalah & Solusi',
                    'subtitle' => 'Kendala umum di lapangan dan rekomendasi produk aluminium Ragil.',
                ],
            ],
            'kontak' => [
                'title' => 'Kontak Kami',
                'content' => [
                    'heading' => 'Kontak',
                    'body' => "Hubungi kami melalui WhatsApp untuk konsultasi ukuran dan model. Tim Ragil Aluminium siap membantu menentukan spesifikasi yang tepat agar tidak terjadi kesalahan produksi.",
                ],
            ],
            'cara-pemesanan' => [
                'title' => 'Cara Pemesanan',
                'content' => [
                    'heading' => 'Cara pesan jendela Anda',
                    'subtitle' => 'Alur ringkas dan aman, dari memilih model hingga pesanan tiba di lokasi Anda.',
                    'body' => "Catatan Ukuran Custom:\nKami melayani ukuran custom. Sertakan model dan ukuran (Tinggi x Panjang, cm) saat chat admin agar spesifikasi sesuai dan tidak terjadi kesalahan produksi.",
                    'steps' => [
                        [
                            'icon' => 'search',
                            'title' => 'Pilih model & produk',
                            'description' => 'Telusuri katalog jendela, pintu, dan bouven aluminium. Bandingkan model, desain, dan harga sebelum menentukan pilihan.',
                            'points' => ['Filter berdasarkan kategori & harga', 'Lihat detail material dan foto produk'],
                        ],
                        [
                            'icon' => 'ruler',
                            'title' => 'Tentukan ukuran & varian',
                            'description' => 'Atur ukuran, warna, jenis kaca, dan opsi lain langsung di halaman produk agar sesuai bukaan bangunan Anda.',
                            'points' => ['Sesuaikan ukuran dengan kebutuhan', 'Ragu ukuran? Tim kami bantu konfirmasi'],
                        ],
                        [
                            'icon' => 'credit-card',
                            'title' => 'Checkout & pembayaran',
                            'description' => 'Isi data pengiriman lengkap (provinsi hingga desa), pilih metode pembayaran, lalu buat pesanan.',
                            'points' => ['Pembayaran COD atau Transfer Bank', 'Opsi lain diproses manual via WhatsApp'],
                        ],
                        [
                            'icon' => 'truck',
                            'title' => 'Produksi & pengiriman',
                            'description' => 'Pesanan diproduksi dengan presisi, dikemas aman, lalu dikirim ke seluruh Indonesia. Pantau status tanpa perlu login.',
                            'points' => ['Packing standar industri', 'Lacak status lewat menu Pesanan'],
                        ],
                    ],
                    'info_cards' => [
                        [
                            'icon' => 'credit-card',
                            'title' => 'Metode pembayaran',
                            'description' => 'Tersedia COD dan Transfer Bank di checkout. Butuh metode lain? Tim kami bantu proses manual lewat WhatsApp.',
                        ],
                        [
                            'icon' => 'truck',
                            'title' => 'Pengiriman J&T',
                            'description' => 'Pengiriman ke seluruh Indonesia dengan pengemasan aman. Status pengiriman diperbarui otomatis di halaman pesanan.',
                        ],
                        [
                            'icon' => 'shield-check',
                            'title' => 'Garansi & bantuan',
                            'description' => 'Layanan purna jual dengan panduan instalasi. Ada kendala? Chat WhatsApp, kami bantu sampai jelas.',
                        ],
                    ],
                ],
            ],
            'kebijakan-privasi' => [
                'title' => 'Kebijakan Privasi',
                'content' => [
                    'heading' => 'Kebijakan Privasi',
                    'body' => "Kami menghargai privasi Anda. Data yang Anda berikan (nama, nomor WhatsApp, alamat pengiriman) digunakan semata-mata untuk memproses pesanan dan menghubungi Anda terkait pesanan. Kami tidak membagikan data Anda kepada pihak ketiga tanpa persetujuan.",
                ],
            ],
            'ketentuan-layanan' => [
                'title' => 'Ketentuan Layanan',
                'content' => [
                    'heading' => 'Ketentuan Layanan',
                    'body' => "Dengan menggunakan layanan Ragil Aluminium, Anda menyetujui bahwa pesanan diproses setelah konfirmasi. Produk custom diproduksi sesuai spesifikasi yang disepakati. Keluhan dan retur diatur berdasarkan kondisi kerusakan saat pengiriman.",
                ],
            ],
        ];

        foreach ($pages as $slug => $data) {
            CmsPage::updateOrCreate(
                ['slug' => $slug],
                [
                    'title' => $data['title'],
                    'content' => $data['content'],
                    'published' => true,
                ]
            );
        }

        $this->seedFaqItems();
        $this->seedProblemsSolutions();
    }

    protected function seedFaqItems(): void
    {
        if (! Schema::hasTable('cms_faq_items')) {
            return;
        }

        $page = CmsPage::query()->where('slug', 'faq')->first();
        if (! $page) {
            return;
        }

        if (DB::table('cms_faq_items')->where('cms_page_id', $page->id)->exists()) {
            return;
        }

        $items = [
            [
                'category' => 'Spesifikasi Material & Ukuran',
                'question' => 'Apakah bisa custom ukuran?',
                'answer' => 'Ya, kami melayani ukuran custom. Sertakan model dan ukuran (Tinggi x Panjang, cm) saat chat admin.',
                'sort_order' => 0,
            ],
            [
                'category' => 'Umum & Profil Toko',
                'question' => 'Apakah harga sudah termasuk packing?',
                'answer' => 'Ya, harga sudah termasuk packing kayu.',
                'sort_order' => 1,
            ],
            [
                'category' => 'Umum & Profil Toko',
                'question' => 'Bagaimana cara pemesanan?',
                'answer' => 'Pilih produk di katalog, tambahkan ke keranjang, lalu checkout. Atau chat WhatsApp kami.',
                'sort_order' => 2,
            ],
            [
                'category' => 'Metode Pembayaran',
                'question' => 'Metode pembayaran apa saja yang tersedia?',
                'answer' => 'COD (bayar di tempat) dan transfer bank.',
                'sort_order' => 3,
            ],
            [
                'category' => 'Pengiriman & Pemasangan',
                'question' => 'Apakah pengiriman ke seluruh Indonesia?',
                'answer' => 'Ya, kami melayani pengiriman ke seluruh Indonesia. Status bisa dilacak di menu Pesanan tanpa login.',
                'sort_order' => 4,
            ],
        ];

        foreach ($items as $item) {
            DB::table('cms_faq_items')->insert([
                'cms_page_id' => $page->id,
                'question' => $item['question'],
                'answer' => $item['answer'],
                'category' => $item['category'],
                'sort_order' => $item['sort_order'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    protected function seedProblemsSolutions(): void
    {
        if (! Schema::hasTable('cms_problems_solutions')) {
            return;
        }

        $page = CmsPage::query()->where('slug', 'masalah-solusi')->first();
        if (! $page) {
            return;
        }

        if (DB::table('cms_problems_solutions')->where('cms_page_id', $page->id)->exists()) {
            return;
        }

        $items = [
            [
                'problem' => 'Jendela kayu cepat lapuk, retak, atau dimakan rayap karena cuaca tropis.',
                'solution' => 'Gunakan jendela aluminium anti rayap dengan finishing powder coating. Tahan cuaca dan tidak memerlukan cat ulang berkala.',
                'sort_order' => 0,
            ],
            [
                'problem' => 'Bukaan jendela memakan ruang di dalam ruangan (engsel samping).',
                'solution' => 'Pilih model jungkit atau sliding agar daun jendela tidak mengganggu furnitur dan sirkulasi tetap optimal.',
                'sort_order' => 1,
            ],
            [
                'problem' => 'Ukuran bukaan di lapangan tidak sama dengan produk standar.',
                'solution' => 'Pesan ukuran custom (tinggi × panjang cm). Tim kami konfirmasi spesifikasi sebelum produksi agar pas di lubang tembok.',
                'sort_order' => 2,
            ],
        ];

        foreach ($items as $item) {
            DB::table('cms_problems_solutions')->insert([
                'cms_page_id' => $page->id,
                'problem' => $item['problem'],
                'solution' => $item['solution'],
                'sort_order' => $item['sort_order'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
