<?php

namespace Database\Seeders;

use App\Models\CmsGalleryItem;
use App\Models\CmsPage;
use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Support\CmsDocumentSettings;
use App\Support\InstallationPageSettings;
use App\Support\TestimonialPageSettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * Isi dokumen panjang + konten sosial yang dikelola admin:
 * Kebijakan Privasi, Ketentuan Layanan, Informasi Toko, meta + caption Hasil Pemasangan,
 * dan ulasan Shopee / website / WhatsApp.
 *
 * Body dokumen memakai subset HTML yang diizinkan CmsDocumentSettings::bodyToHtml().
 */
class StorefrontDocumentSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedPrivacyPolicy();
        $this->seedTermsOfService();
        $this->seedStoreProfile();
        $this->seedContactPage();
        $this->seedInstallationPage();
        $this->seedMarketplaceReviews();
    }

    protected function seedPrivacyPolicy(): void
    {
        CmsDocumentSettings::update(CmsDocumentSettings::KEY_PRIVASI, [
            'title' => 'Kebijakan Privasi',
            'heading' => 'Kebijakan Privasi',
            'published' => true,
            'body' => <<<'HTML'
<p>Kami berkomitmen untuk melindungi privasi dan menjaga keamanan data pribadi Anda.</p>

<p><strong>1. Data yang Kami Kumpulkan</strong></p>
<p>Kami hanya mengumpulkan data yang diperlukan untuk keperluan transaksi, yaitu:</p>
<ul>
<li>Nama</li>
<li>Nomor WhatsApp</li>
<li>Alamat pengiriman</li>
</ul>

<p><strong>2. Penggunaan Data</strong></p>
<p>Data yang kami terima digunakan untuk:</p>
<ul>
<li>Memproses pesanan Anda</li>
<li>Mengonfirmasi detail pesanan melalui WhatsApp</li>
<li>Mengatur pengiriman produk ke alamat tujuan</li>
</ul>
<p>Kami tidak menggunakan data Anda untuk keperluan lain di luar proses transaksi.</p>

<p><strong>3. Keamanan Data</strong></p>
<p>Kami menjaga data pelanggan dengan baik dan tidak membagikannya kepada pihak lain tanpa izin, kecuali jika diperlukan untuk proses pengiriman (misalnya jasa ekspedisi).</p>

<p><strong>4. Penyimpanan Data</strong></p>
<p>Data pelanggan disimpan hanya selama diperlukan untuk keperluan transaksi dan pelayanan, serta tidak digunakan untuk aktivitas yang merugikan pelanggan.</p>

<p><strong>5. Hak Pelanggan</strong></p>
<p>Pelanggan berhak untuk:</p>
<ul>
<li>Menanyakan data yang kami simpan</li>
<li>Meminta penghapusan data setelah transaksi selesai</li>
</ul>
<p>Permintaan dapat diajukan melalui WhatsApp resmi Ragil Aluminium.</p>

<p><strong>6. Kontak</strong></p>
<p>Jika Anda memiliki pertanyaan terkait kebijakan privasi ini, silakan hubungi kami melalui WhatsApp resmi di bawah ini.</p>
HTML,
        ]);

        $this->command?->info('Kebijakan Privasi: dokumen lengkap tersimpan.');
    }

    protected function seedTermsOfService(): void
    {
        CmsDocumentSettings::update(CmsDocumentSettings::KEY_KETENTUAN, [
            'title' => 'Ketentuan Layanan',
            'heading' => 'Ketentuan Layanan',
            'published' => true,
            'body' => <<<'HTML'
<p>Harap baca Ketentuan Layanan ini dengan saksama sebelum melakukan pemesanan melalui website Ragil Aluminium. Dengan membuat pesanan, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan yang berlaku.</p>

<p><strong>1. Definisi</strong></p>
<ul>
<li><strong>Kami / Toko</strong> merujuk pada Ragil Aluminium sebagai penyedia produk dan layanan.</li>
<li><strong>Anda / Pelanggan</strong> merujuk pada individu atau pihak yang melakukan pemesanan.</li>
<li><strong>Produk</strong> mencakup jendela, pintu, bouven, serta kelengkapan terkait yang ditawarkan di website.</li>
<li><strong>Website</strong> merujuk pada situs resmi Ragil Aluminium yang digunakan untuk pemesanan.</li>
</ul>

<p><strong>2. Pemesanan</strong></p>
<ul>
<li>Pesanan dilakukan melalui website dengan mengisi data penerima secara lengkap, benar, dan dapat dihubungi.</li>
<li>Setelah pesanan dibuat, detail pesanan akan dikonfirmasi melalui WhatsApp resmi sebelum diproses.</li>
<li>Pesanan diproses setelah kedua pihak menyetujui rincian produk, ukuran, alamat, dan total pembayaran.</li>
<li>Kami berhak menunda atau membatalkan pesanan apabila data tidak lengkap, nomor tidak aktif, alamat tidak dapat dijangkau, atau terdapat indikasi penyalahgunaan.</li>
</ul>

<p><strong>3. Produk dan Kesesuaian</strong></p>
<ul>
<li>Produk tersedia dalam berbagai ukuran, model, warna, dan jenis kaca sesuai ketersediaan.</li>
<li>Ukuran yang tercantum pada katalog adalah ukuran total luar kusen, kecuali dinyatakan lain.</li>
<li>Pelanggan bertanggung jawab memastikan ukuran dan spesifikasi yang dipesan sesuai kebutuhan lokasi pemasangan.</li>
<li>Untuk ukuran atau model custom, konsultasi terlebih dahulu melalui WhatsApp resmi.</li>
<li>Perbedaan tampilan warna akibat pencahayaan foto atau layar tidak dianggap sebagai cacat produk.</li>
</ul>

<p><strong>4. Ukuran Custom</strong></p>
<ul>
<li>Ukuran custom ditulis dalam format Tinggi x Panjang (cm) pada catatan pesanan atau saat konfirmasi WhatsApp.</li>
<li>Produk custom diproduksi sesuai spesifikasi yang telah disepakati bersama.</li>
<li>Toleransi produksi wajar dapat terjadi karena proses pemotongan dan perakitan.</li>
<li>Setelah produksi custom dimulai, pesanan tidak dapat dibatalkan atau diubah kecuali atas kesepakatan tertulis kedua pihak.</li>
</ul>

<p><strong>5. Harga dan Pembayaran</strong></p>
<ul>
<li>Harga yang berlaku adalah harga yang tertera pada saat pesanan dibuat, termasuk pengemasan standar kecuali dinyatakan lain.</li>
<li>Metode pembayaran mengikuti opsi yang tersedia di website, termasuk transfer bank dan COD (bayar di tempat) bila diaktifkan.</li>
<li>Untuk COD, pelanggan menyiapkan pembayaran sesuai total tagihan saat barang diterima. Biaya penanganan COD, bila ada, ditampilkan pada checkout.</li>
<li>Untuk transfer bank, pesanan diproses setelah pembayaran diverifikasi.</li>
<li>Voucher, promo, atau subsidi ongkir berlaku sesuai syarat yang ditampilkan pada saat checkout dan tidak dapat diuangkan.</li>
</ul>

<p><strong>6. Produksi dan Pengiriman</strong></p>
<ul>
<li>Pesanan diproses dan dikirim maksimal 1 (satu) hari kerja setelah konfirmasi, sesuai antrian produksi dan ketersediaan material.</li>
<li>Hari Minggu dan hari libur nasional tidak dihitung sebagai hari kerja.</li>
<li>Pengiriman dilakukan melalui mitra ekspedisi (termasuk J&amp;T Cargo) ke seluruh Indonesia.</li>
<li>Estimasi waktu tiba bersifat perkiraan dari pihak ekspedisi dan dapat berubah karena kondisi jalur, cuaca, atau kebijakan kurir.</li>
<li>Nomor resi dikirim melalui WhatsApp dan dapat dipantau melalui menu Pesanan di website.</li>
<li>Biaya bongkar, kuli angkut, atau akses khusus di lokasi penerima bukan bagian dari layanan pengiriman standar.</li>
</ul>

<p><strong>7. Pemeriksaan Barang saat Diterima</strong></p>
<ul>
<li>Pelanggan wajib memeriksa jumlah paket, kondisi kemasan, kondisi produk, dan kelengkapan aksesoris saat barang diterima.</li>
<li>Apabila terdapat kerusakan atau ketidaksesuaian, dokumentasikan dengan foto atau video kemasan dan produk, lalu laporkan melalui WhatsApp resmi.</li>
<li>Laporan tanpa dokumentasi yang memadai dapat memperlambat proses verifikasi dan penyelesaian klaim.</li>
</ul>

<p><strong>8. Garansi</strong></p>
<ul>
<li>Garansi berlaku apabila barang rusak saat diterima atau tidak sesuai dengan pesanan yang telah dikonfirmasi.</li>
<li>Komplain wajib disertai foto atau video saat barang diterima.</li>
<li>Garansi tidak mencakup kerusakan akibat pemasangan yang tidak sesuai panduan, benturan setelah diterima, modifikasi produk, atau keausan wajar pada aksesoris.</li>
</ul>

<p><strong>9. Komplain, Penggantian, dan Pengembalian</strong></p>
<ul>
<li>Komplain diajukan maksimal 1 x 24 jam setelah barang diterima.</li>
<li>Produk yang dikomplain tidak boleh dalam kondisi sudah dipasang atau digunakan, kecuali kerusakan sudah tampak sebelum pemasangan dan terdokumentasi.</li>
<li>Apabila klaim dinyatakan valid, kami akan mengganti produk atau mengembalikan dana sesuai kesepakatan.</li>
<li>Biaya pengiriman ulang atau penjemputan ditentukan berdasarkan hasil verifikasi dan kesepakatan bersama.</li>
</ul>

<p><strong>10. Pembatalan Pesanan</strong></p>
<ul>
<li>Pesanan yang telah dikonfirmasi dan masuk proses produksi tidak dapat dibatalkan secara sepihak.</li>
<li>Untuk pesanan custom, pembatalan tidak dapat dilakukan setelah produksi dimulai.</li>
<li>Pembatalan sebelum konfirmasi dapat diajukan melalui WhatsApp resmi dan akan ditinjau sesuai status pesanan.</li>
</ul>

<p><strong>11. Batasan Tanggung Jawab</strong></p>
<ul>
<li>Kami bertanggung jawab atas produk sesuai spesifikasi yang dikonfirmasi dan atas kerusakan yang terbukti terjadi sebelum atau selama pengiriman sesuai ketentuan klaim.</li>
<li>Kami tidak bertanggung jawab atas kerugian tidak langsung, termasuk keterlambatan pemasangan di lokasi, biaya tukang, atau kerugian bisnis, sepanjang diizinkan oleh hukum yang berlaku.</li>
<li>Tanggung jawab maksimal Kami terbatas pada nilai produk yang dipesan terkait klaim tersebut.</li>
</ul>

<p><strong>12. Kekayaan Intelektual</strong></p>
<p>Seluruh konten pada website, termasuk foto produk, deskripsi, merek, dan materi visual, merupakan milik Ragil Aluminium atau pihak yang berwenang. Konten tersebut tidak boleh digunakan untuk kepentingan komersial pihak lain tanpa izin tertulis.</p>

<p><strong>13. Komunikasi Resmi</strong></p>
<ul>
<li>Komunikasi resmi hanya dilakukan melalui website, nomor WhatsApp resmi, dan akun marketplace resmi yang tercantum di website.</li>
<li>Kami tidak pernah meminta OTP, PIN, kata sandi, atau data perbankan pelanggan.</li>
</ul>

<p><strong>14. Perubahan Ketentuan</strong></p>
<ul>
<li>Ketentuan Layanan ini dapat diperbarui sewaktu-waktu untuk menyesuaikan proses layanan, mitra pengiriman, atau ketentuan hukum.</li>
<li>Versi terbaru selalu tersedia pada halaman ini. Perubahan tidak mengurangi hak pelanggan atas pesanan yang telah dikonfirmasi, kecuali diwajibkan oleh hukum.</li>
</ul>

<p><strong>15. Hukum yang Berlaku dan Penyelesaian Sengketa</strong></p>
<ul>
<li>Ketentuan ini tunduk pada hukum Republik Indonesia.</li>
<li>Setiap perselisihan diselesaikan terlebih dahulu secara musyawarah. Apabila tidak tercapai kesepakatan, penyelesaian dilakukan sesuai ketentuan hukum yang berlaku.</li>
</ul>

<p><strong>16. Kontak</strong></p>
<p>Pertanyaan terkait Ketentuan Layanan ini dapat disampaikan melalui WhatsApp resmi Ragil Aluminium atau halaman Informasi Toko pada website ini.</p>
HTML,
        ]);

        $this->command?->info('Ketentuan Layanan: dokumen lengkap tersimpan.');
    }

    protected function seedStoreProfile(): void
    {
        CmsDocumentSettings::update(CmsDocumentSettings::KEY_TENTANG_KAMI, [
            'title' => 'Informasi Toko Ragil Aluminium',
            'heading' => 'Informasi Toko',
            'published' => true,
            'body' => <<<'HTML'
<p>Ragil Aluminium adalah produsen dan penjual langsung jendela, pintu, dan bouven aluminium siap pasang. Kami mengerjakan pesanan ukuran standar maupun custom untuk rumah tinggal, renovasi, kontrakan, hingga proyek bangunan.</p>

<h2>Yang kami produksi</h2>
<ul>
<li>Jendela aluminium: sliding, swing, jungkit, dan kaca mati, dengan pilihan polos maupun ornamen.</li>
<li>Pintu aluminium: swing dan sliding, termasuk kombinasi kaca mati bagian atas.</li>
<li>Bouven atau boven: jungkit dan kaca mati untuk sirkulasi udara dan pencahayaan.</li>
</ul>

<h2>Material dan kelengkapan</h2>
<ul>
<li>Profil aluminium dengan pilihan warna putih, hitam, coklat, dan silver sesuai ketersediaan.</li>
<li>Pilihan kaca bening, kaca es, dan kaca riben sesuai kebutuhan privasi ruangan.</li>
<li>Setiap unit dikirim lengkap dengan aksesoris, engsel, handle sesuai model, serta baut fisher.</li>
<li>Pengemasan standar industri dengan pelindung sudut agar aman menempuh pengiriman antarpulau.</li>
</ul>

<h2>Layanan ukuran custom</h2>
<p>Ukuran dapat disesuaikan dengan bukaan bangunan Anda. Cantumkan model dan ukuran Tinggi x Panjang dalam sentimeter pada catatan pesanan, lalu tim kami mengonfirmasi ulang sebelum produksi agar tidak terjadi kesalahan pembuatan.</p>

<h2>Cara belanja</h2>
<ul>
<li>Checkout langsung di website ini, dengan pembayaran COD atau transfer bank.</li>
<li>Konsultasi ukuran dan model melalui WhatsApp resmi kami.</li>
<li>Belanja melalui marketplace resmi: Shopee, Tokopedia, Lazada, dan TikTok Shop.</li>
</ul>

<h2>Pengiriman</h2>
<p>Kami mengirim ke seluruh Indonesia melalui J&amp;T Cargo dan mitra ekspedisi lain. Setelah paket diserahkan ke kurir, nomor resi dikirim melalui WhatsApp dan status pengiriman dapat dipantau lewat menu Pesanan tanpa perlu membuat akun.</p>

<h2>Layanan purna jual</h2>
<p>Kami mendampingi pembeli sejak pemilihan ukuran sampai barang terpasang. Panduan pemasangan tersedia melalui WhatsApp, dan keluhan kerusakan pengiriman ditindaklanjuti sesuai Ketentuan Layanan.</p>
HTML,
        ]);

        $this->command?->info('Informasi Toko: profil lengkap tersimpan.');
    }

    protected function seedContactPage(): void
    {
        $page = CmsPage::query()->firstOrCreate(
            ['slug' => 'kontak'],
            ['title' => 'Kontak Kami', 'content' => [], 'published' => true],
        );

        $content = is_array($page->content) ? $page->content : [];
        $content['heading'] = 'Kontak';
        $content['body'] = <<<'TXT'
Tim Ragil Aluminium siap membantu Anda menentukan model, ukuran, dan jenis kaca yang tepat sebelum pesanan diproduksi.

Layanan yang bisa Anda tanyakan:
- Konsultasi ukuran custom sesuai bukaan bangunan.
- Rekomendasi model jendela, pintu, atau bouven untuk ruangan tertentu.
- Estimasi pengiriman ke kota Anda dan status resi pesanan yang sedang berjalan.
- Bantuan panduan pemasangan serta klaim kerusakan pengiriman.

Agar penanganan lebih cepat, sebutkan nomor pesanan Anda bila sudah pernah berbelanja, serta lampirkan foto lokasi pemasangan saat berkonsultasi ukuran.
TXT;
        $page->content = $content;
        $page->published = true;
        $page->save();

        $this->command?->info('Kontak: isi halaman tersimpan.');
    }

    protected function seedInstallationPage(): void
    {
        InstallationPageSettings::updatePageMeta([
            'title' => 'Hasil Pemasangan',
            'heading' => 'Hasil pemasangan',
            'subtitle' => 'Lihat contoh pemasangan nyata di rumah dan proyek di berbagai kota.',
        ]);

        TestimonialPageSettings::updatePageMeta([
            'title' => 'Ulasan Pelanggan',
            'heading' => 'Apa kata pelanggan kami',
            'subtitle' => 'Cerita pelanggan yang sudah belanja di Ragil Aluminium.',
        ]);

        $this->relabelGalleryItems();
    }

    protected function relabelGalleryItems(): void
    {
        if (! Schema::hasTable('cms_gallery_items')) {
            return;
        }

        $captions = [
            'Jendela sliding dua daun terpasang di ruang tamu, Karanganyar',
            'Bouven jungkit ornamen untuk sirkulasi dapur, Sragen',
            'Jendela kaca mati kamar tidur lantai dua, Sukoharjo',
            'Pintu swing aluminium akses samping rumah, Boyolali',
            'Jendela jungkit kamar mandi dengan kaca es, Solo',
            'Kombinasi jendela sliding dan kaca mati ruang keluarga, Klaten',
            'Bouven kaca mati di atas pintu utama, Wonogiri',
            'Jendela swing dua daun untuk kamar anak, Salatiga',
            'Jendela sliding kontrakan tiga pintu, Semarang',
            'Bouven jungkit deret untuk ruang jemur, Purwodadi',
            'Pintu sliding aluminium pemisah dapur, Magelang',
            'Jendela kaca mati fasad depan rumah, Yogyakarta',
        ];

        $items = CmsGalleryItem::query()->orderBy('sort_order')->orderBy('id')->get();

        foreach ($items as $index => $item) {
            $item->update([
                'label' => $captions[$index % count($captions)],
                'published' => true,
                'sort_order' => $index,
            ]);
        }

        $this->command?->info('Hasil pemasangan: '.$items->count().' caption dokumentasi diperbarui.');
    }

    protected function seedMarketplaceReviews(): void
    {
        if (! Schema::hasTable('cms_testimonials')) {
            return;
        }

        $page = TestimonialPageSettings::ensurePage();

        $products = Product::query()
            ->visible()
            ->with('mainImage')
            ->orderBy('id')
            ->get();

        if ($products->isEmpty()) {
            return;
        }

        $reviews = [
            [
                'customer_name' => 'Wahyu Setiawan',
                'location' => 'Karanganyar, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 5,
                'message' => 'Pesan sliding dua daun ukuran custom, hasilnya presisi dan rel-nya halus waktu digeser. Kaca sudah terpasang rapat, karet tidak ada yang lepas. Packing kayu tebal jadi aman sampai rumah.',
            ],
            [
                'customer_name' => 'Nur Hidayah',
                'location' => 'Sragen, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 5,
                'message' => 'Bouven jungkit ornamen buat dapur, sirkulasi udara langsung berasa lebih enak dan asap masakan cepat keluar. Warna hitamnya rata, tidak belang. Sudah dipakai sebulan masih mulus.',
            ],
            [
                'customer_name' => 'Andi Kurniawan',
                'location' => 'Sukoharjo, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 4,
                'message' => 'Barang bagus dan sesuai ukuran yang saya minta. Pengiriman sedikit lebih lama dari perkiraan, tapi admin update terus lewat WhatsApp jadi tetap tenang.',
            ],
            [
                'customer_name' => 'Sri Wahyuni',
                'location' => 'Boyolali, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 5,
                'message' => 'Ini pembelian ketiga untuk kontrakan saya. Kualitas selalu konsisten, aksesoris dan fisher lengkap, tukang saya tinggal pasang tanpa beli tambahan apa pun.',
            ],
            [
                'customer_name' => 'Bayu Nugroho',
                'location' => 'Klaten, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'message' => 'Checkout di website gampang, isi alamat sampai desa lengkap dan langsung dapat konfirmasi WhatsApp berisi rincian pesanan. Nomor resi juga dikirim sendiri jadi tidak perlu menanyakan.',
            ],
            [
                'customer_name' => 'Fitri Handayani',
                'location' => 'Semarang, Jawa Tengah',
                'source' => 'website',
                'rating' => 5,
                'message' => 'Ambil COD karena baru pertama beli online untuk barang sebesar ini. Kurir datang sesuai info resi, barang dibuka dulu bareng kurir, kondisi kaca utuh semua. Puas.',
            ],
            [
                'customer_name' => 'Dimas Prakoso',
                'location' => 'Yogyakarta, DI Yogyakarta',
                'source' => 'website',
                'rating' => 4,
                'message' => 'Jendela swing untuk kamar anak sudah terpasang. Handle terasa kokoh dan tidak goyang. Saran kecil, panduan pemasangan sebaiknya disertakan cetak di dalam paket juga.',
            ],
            [
                'customer_name' => 'Ratna Puspita',
                'location' => 'Solo, Jawa Tengah',
                'source' => 'whatsapp',
                'rating' => 5,
                'message' => 'Bingung menentukan ukuran kamar mandi, dibantu admin sampai fix pakai kaca es. Hasilnya pas dan privasi tetap terjaga tapi ruangan jadi terang.',
            ],
            [
                'customer_name' => 'Hendra Gunawan',
                'location' => 'Magelang, Jawa Tengah',
                'source' => 'whatsapp',
                'rating' => 5,
                'message' => 'Pesan borongan untuk renovasi rumah, total sembilan unit campur jendela dan bouven. Semua dikirim sekali jalan dan tidak ada yang tertukar ukurannya.',
            ],
            [
                'customer_name' => 'Lilis Suryani',
                'location' => 'Wonogiri, Jawa Tengah',
                'source' => 'shopee',
                'rating' => 5,
                'message' => 'Kaca mati untuk fasad depan, tampilannya bersih dan modern. Sudah kena hujan besar beberapa kali, tidak ada rembes masuk ke dalam ruangan.',
            ],
        ];

        // Ulasan detail ini tampil di halaman pertama /reviews (urut sort_order naik).
        CmsTestimonial::query()->increment('sort_order', count($reviews));

        foreach ($reviews as $index => $data) {
            $product = $products[$index % $products->count()];
            $imageUrl = $product->mainImage?->urlFor('card');

            CmsTestimonial::query()->updateOrCreate(
                [
                    'cms_page_id' => $page->id,
                    'customer_name' => $data['customer_name'],
                ],
                [
                    'product_id' => $product->id,
                    'message' => $data['message'],
                    'rating' => $data['rating'],
                    'source' => $data['source'],
                    'location' => $data['location'],
                    'image_url' => $index % 2 === 0 ? $imageUrl : null,
                    'published' => true,
                    'sort_order' => $index,
                ]
            );
        }

        $this->command?->info('Ulasan: '.count($reviews).' ulasan Shopee/website/WhatsApp ditambahkan.');
    }
}
