<?php

namespace Database\Seeders;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class TestimonialSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('cms_testimonials') || ! Schema::hasTable('cms_pages')) {
            return;
        }

        $page = CmsPage::query()->firstOrCreate(
            ['slug' => 'testimoni'],
            [
                'title' => 'Testimoni & Ulasan',
                'content' => ['html' => ''],
                'published' => true,
            ]
        );

        // Real, active products (with a local main image) to link a portion of
        // reviews to actual PDPs and to reuse their photos as installation shots.
        $products = Product::query()
            ->where('status', 'active')
            ->with('mainImage')
            ->orderBy('id')
            ->limit(20)
            ->get();

        $productImage = static function (?Product $product): ?string {
            return $product?->mainImage?->urlFor('card');
        };

        $reviews = [
            [
                'customer_name' => 'Budi Santoso',
                'location' => 'Bandung, Jawa Barat',
                'source' => 'shopee',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Jendela aluminium jungkit-nya rapi banget, kacanya tebal dan engselnya kokoh. Pemasangan gampang karena sudah lengkap fisher. Sesuai ukuran custom yang saya minta.',
            ],
            [
                'customer_name' => 'Siti Rahmawati',
                'location' => 'Sleman, DI Yogyakarta',
                'source' => 'whatsapp',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Admin fast respon, dibantu pilih ukuran yang pas untuk kamar mandi. Barang sampai dengan packing kayu rapat, tidak ada lecet sama sekali. Recommended!',
            ],
            [
                'customer_name' => 'Agus Prasetyo',
                'location' => 'Surabaya, Jawa Timur',
                'source' => 'website',
                'rating' => 4,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Kualitas bagus untuk harganya. Pengiriman agak lama karena beda pulau, tapi produk aman dan sesuai foto. Warna aluminium coklat sesuai pesanan.',
            ],
            [
                'customer_name' => 'Dewi Lestari',
                'location' => 'Bekasi, Jawa Barat',
                'source' => 'shopee',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Boven jungkit ornamen-nya cantik, bikin dapur lebih terang. Sirkulasi udara jadi bagus. Sudah pesan kedua kali di sini, tidak pernah kecewa.',
            ],
            [
                'customer_name' => 'Rizky Ramadhan',
                'location' => 'Depok, Jawa Barat',
                'source' => 'whatsapp',
                'rating' => 5,
                'with_product' => false,
                'with_image' => true,
                'message' => 'Pesan custom ukuran besar untuk ruang tamu, hasilnya presisi dan kokoh. Tim pemasangan lokal saya bilang framenya rapi dan mudah dipasang.',
            ],
            [
                'customer_name' => 'Nurul Hidayah',
                'location' => 'Semarang, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 4,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Sliding-nya halus digeser, kunci rapat. Cuma kaca ada sedikit sidik jari saat datang, tapi tinggal dilap. Overall puas dengan pembelian ini.',
            ],
            [
                'customer_name' => 'Hendra Wijaya',
                'location' => 'Tangerang, Banten',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Sudah terpasang di rumah baru, tampilannya modern dan minimalis. Anti rayap karena aluminium, cocok untuk iklim lembab. Terima kasih Ragil Aluminium.',
            ],
            [
                'customer_name' => 'Maya Anggraini',
                'location' => 'Malang, Jawa Timur',
                'source' => 'whatsapp',
                'rating' => 5,
                'with_product' => false,
                'with_image' => false,
                'message' => 'Konsultasi dulu via WhatsApp sebelum beli, dijelaskan detail perbedaan model. Tidak dipaksa beli. Akhirnya cocok dan hasilnya memuaskan.',
            ],
            [
                'customer_name' => 'Fajar Nugroho',
                'location' => 'Solo, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 4,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Kaca mati untuk area tangga, cahaya masuk maksimal. Pemasangan butuh 2 orang karena lumayan besar, tapi hasil akhirnya sangat rapi.',
            ],
            [
                'customer_name' => 'Indah Permatasari',
                'location' => 'Cirebon, Jawa Barat',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Harga bersaing dibanding toko lain dan sudah termasuk packing. Barang datang lengkap dengan aksesoris. Jendela swing-nya kokoh saat dibuka lebar.',
            ],
            [
                'customer_name' => 'Doni Kurniawan',
                'location' => 'Purwokerto, Jawa Tengah',
                'source' => 'whatsapp',
                'rating' => 5,
                'with_product' => false,
                'with_image' => true,
                'message' => 'Order untuk proyek kos-kosan, ambil banyak unit. Diskon lumayan dan kualitas seragam semua. Pasti repeat order untuk lantai berikutnya.',
            ],
            [
                'customer_name' => 'Wulan Sari',
                'location' => 'Magelang, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Boven ornamennya jadi focal point ruang tamu. Motif kacanya elegan. Penjual amanah, ukuran sesuai dan dikirim cepat. Bintang lima!',
            ],
            [
                'customer_name' => 'Bayu Saputra',
                'location' => 'Klaten, Jawa Tengah',
                'source' => 'website',
                'rating' => 4,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Frame tebal dan terasa premium. Cocok untuk rumah minimalis. Sedikit menunggu antrean produksi karena custom, tapi hasil sepadan.',
            ],
            [
                'customer_name' => 'Rina Marlina',
                'location' => 'Kudus, Jawa Tengah',
                'source' => 'whatsapp',
                'rating' => 5,
                'with_product' => false,
                'with_image' => true,
                'message' => 'Pelayanan ramah dari awal sampai barang datang. Diberi update foto sebelum dikirim. Jendela sudah terpasang dan rumah jadi lebih adem.',
            ],
            [
                'customer_name' => 'Teguh Iman',
                'location' => 'Kediri, Jawa Timur',
                'source' => 'shopee',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Barang berkualitas, kaca bening tebal, engsel mulus. Sudah cocok dari model sampai warna. Toko aluminium andalan sekarang.',
            ],
            [
                'customer_name' => 'Lestari Ningsih',
                'location' => 'Madiun, Jawa Timur',
                'source' => 'website',
                'rating' => 4,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Pemesanan mudah lewat website, checkout jelas. Konfirmasi cepat via WhatsApp. Ukuran pas untuk jendela kamar anak.',
            ],
            [
                'customer_name' => 'Yoga Pratama',
                'location' => 'Sidoarjo, Jawa Timur',
                'source' => 'whatsapp',
                'rating' => 5,
                'with_product' => false,
                'with_image' => true,
                'message' => 'Ambil beberapa unit untuk renovasi ruko. Semua rapi dan seragam. Packing kayu kuat, tidak ada yang penyok saat sampai.',
            ],
            [
                'customer_name' => 'Ayu Kartika',
                'location' => 'Gresik, Jawa Timur',
                'source' => 'shopee',
                'rating' => 5,
                'with_product' => true,
                'with_image' => true,
                'message' => 'Sudah terpasang dan hasilnya rapi banget. Warna aluminium sesuai ekspektasi. Terima kasih sudah sabar bantu pilih ukuran yang tepat.',
            ],
            [
                'customer_name' => 'Rahmat Hidayat',
                'location' => 'Pekalongan, Jawa Tengah',
                'source' => 'website',
                'rating' => 4,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Value for money. Kualitas di atas harga. Pengiriman aman sampai luar kota. Akan pertimbangkan order lagi untuk proyek berikutnya.',
            ],
            [
                'customer_name' => 'Bambang Kurniawan',
                'location' => 'Kudus, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Order langsung dari website Ragil Aluminium sangat cepat. Pengemasan kayu aman tanpa lecet, engsel jungkit rapi dan kedap saat ditutup.',
            ],
            [
                'customer_name' => 'Siti Rahmawati',
                'location' => 'Pati, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Kaca mati ornamen dipasang di ruang tamu depan, hasilnya estetik dan presisi. Konsultasi ukuran via WhatsApp juga ramah dan membantu.',
            ],
            [
                'customer_name' => 'Tri Sutrisno',
                'location' => 'Jepara, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Model jungkit 3 daun kombinasi ini pas banget buat ventilasi dapur dan ruang tengah. Aluminium tebal dan rapi finishing-nya.',
            ],
            [
                'customer_name' => 'Dewi Susanti',
                'location' => 'Demak, Jawa Tengah',
                'source' => 'website',
                'rating' => 4,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Pengiriman cargo cepat sampai rumah. Paket dibungkus kayu tebal, karet pelindung kaca rapat. Tinggal pasang oleh tukang bangunan.',
            ],
            [
                'customer_name' => 'Aris Wibowo',
                'location' => 'Surakarta, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Jendela sliding luncurannya halus, aksesoris kunci dan kancing berfungsi lancar. Beli di website prosesnya transparan dan terpercaya.',
            ],
            [
                'customer_name' => 'Eko Purwanto',
                'location' => 'Salatiga, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'with_product' => true,
                'with_image' => false,
                'message' => 'Pintu & jendela swing ornamen aluminium bikin fasad rumah kelihatan mewah. Seller responsif dan rincian resi otomatis masuk WhatsApp.',
            ],
        ];

        foreach ($reviews as $index => $data) {
            $product = $data['with_product'] && $products->isNotEmpty()
                ? $products[$index % $products->count()]
                : null;

            $imageUrl = null;
            if ($data['with_image']) {
                $imageSource = $product ?: ($products[$index % max($products->count(), 1)] ?? null);
                $imageUrl = $productImage($imageSource);
            }

            CmsTestimonial::updateOrCreate(
                [
                    'cms_page_id' => $page->id,
                    'customer_name' => $data['customer_name'],
                ],
                [
                    'product_id' => $product?->id,
                    'message' => $data['message'],
                    'rating' => $data['rating'],
                    'source' => $data['source'],
                    'location' => $data['location'],
                    'image_url' => $imageUrl,
                    'published' => true,
                    'sort_order' => $index,
                ]
            );
        }

        // Populate the Home "Hasil Pemasangan" gallery from real product photos.
        if (Schema::hasTable('cms_gallery_items')) {
            $galleryProducts = $products->filter(fn (Product $p) => filled($productImage($p)))->take(8)->values();

            foreach ($galleryProducts as $index => $product) {
                CmsGalleryItem::updateOrCreate(
                    [
                        'cms_page_id' => $page->id,
                        'image_url' => $productImage($product),
                    ],
                    [
                        'label' => 'Hasil pemasangan ' . ($product->short_name ?: $product->name),
                        'published' => true,
                        'sort_order' => $index,
                    ]
                );
            }
        }
    }
}
