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
<p>Kebijakan ini menjelaskan bagaimana Ragil Aluminium mengumpulkan, memakai, menyimpan, dan melindungi data pribadi pembeli yang berbelanja melalui website, WhatsApp, maupun marketplace resmi kami.</p>

<h2>Data yang kami kumpulkan</h2>
<ul>
<li>Identitas dan kontak: nama penerima, nomor WhatsApp atau telepon, dan alamat email bila diisi.</li>
<li>Data pengiriman: provinsi, kota atau kabupaten, kecamatan, desa atau kelurahan, kode pos, alamat lengkap, serta catatan patokan lokasi.</li>
<li>Data pesanan: nomor pesanan, produk dan varian yang dibeli, ukuran custom, jumlah unit, metode pembayaran, dan total tagihan.</li>
<li>Data pembayaran terbatas: bukti transfer yang Anda kirimkan. Kami tidak menyimpan data kartu, PIN, OTP, atau kredensial perbankan apa pun.</li>
<li>Data teknis dasar: alamat IP, jenis perangkat, dan halaman yang diakses untuk menjaga keamanan serta memperbaiki layanan.</li>
</ul>

<h2>Tujuan penggunaan data</h2>
<ul>
<li>Memproses pesanan, konfirmasi ukuran, produksi, pengemasan, dan pengiriman.</li>
<li>Mengirim notifikasi WhatsApp resmi berisi konfirmasi pesanan, instruksi pembayaran, status proses, nomor resi, dan konfirmasi barang diterima.</li>
<li>Melayani pertanyaan, keluhan, klaim kerusakan pengiriman, serta permintaan garansi.</li>
<li>Menyusun statistik penjualan internal dalam bentuk agregat tanpa mengidentifikasi pembeli.</li>
<li>Memenuhi kewajiban hukum, pembukuan, dan penyelesaian sengketa bila diperlukan.</li>
</ul>

<h2>Pembagian data kepada pihak ketiga</h2>
<p>Kami hanya membagikan data seminimal mungkin dan sebatas kebutuhan operasional:</p>
<ul>
<li><strong>Jasa pengiriman (J&amp;T Cargo dan mitra ekspedisi lain):</strong> nama penerima, alamat lengkap, nomor telepon, dan detail paket agar barang dapat dikirim serta dilacak.</li>
<li><strong>Layanan pesan WhatsApp Business resmi (Meta):</strong> nomor WhatsApp dan isi variabel notifikasi pesanan.</li>
<li><strong>Marketplace resmi:</strong> apabila Anda memesan melalui Shopee, Tokopedia, Lazada, atau TikTok Shop, data pesanan tunduk pada kebijakan platform terkait.</li>
<li><strong>Penegak hukum atau instansi berwenang:</strong> hanya bila diwajibkan oleh peraturan yang berlaku.</li>
</ul>
<p>Kami tidak menjual, menyewakan, atau menukarkan data pribadi Anda untuk kepentingan pemasaran pihak lain.</p>

<h2>Penyimpanan dan keamanan</h2>
<p>Data pesanan disimpan pada sistem kami selama masa layanan purna jual, penanganan garansi, dan kebutuhan pembukuan. Akses ke data dibatasi hanya untuk admin toko yang berkepentingan, dengan akun terpisah dan pencatatan aktivitas. Riwayat percakapan WhatsApp yang berkaitan dengan pesanan disimpan sebagai bukti konfirmasi ukuran dan pengiriman.</p>

<h2>Ulasan dan foto hasil pemasangan</h2>
<p>Ulasan yang Anda tulis di website atau marketplace dapat kami tampilkan di halaman Ulasan dan pada halaman produk, dengan nama tampil singkat serta kota. Foto hasil pemasangan hanya dipublikasikan setelah Anda mengizinkan. Bila Anda ingin ulasan atau foto dicabut, sampaikan melalui WhatsApp resmi kami dan akan kami turunkan.</p>

<h2>Hak Anda</h2>
<ul>
<li>Meminta salinan data pesanan Anda.</li>
<li>Meminta perbaikan data penerima atau alamat sebelum pesanan dikirim.</li>
<li>Meminta penghapusan data yang tidak lagi diperlukan, sepanjang tidak bertentangan dengan kewajiban pembukuan dan penyelesaian sengketa.</li>
<li>Menolak menerima pesan promosi tanpa memengaruhi notifikasi transaksi pesanan Anda.</li>
</ul>

<h2>Cookie dan pelacakan</h2>
<p>Website memakai cookie fungsional untuk menjaga sesi keranjang, preferensi tampilan, dan keamanan formulir. Kami tidak memakai cookie untuk membangun profil iklan lintas situs.</p>

<h2>Data anak</h2>
<p>Layanan ini ditujukan untuk pembeli dewasa. Kami tidak dengan sengaja mengumpulkan data anak di bawah umur tanpa pendampingan orang tua atau wali.</p>

<h2>Perubahan kebijakan</h2>
<p>Kebijakan dapat diperbarui bila ada perubahan proses layanan, mitra pengiriman, atau ketentuan hukum. Versi terbaru selalu ditampilkan pada halaman ini.</p>

<h2>Kontak</h2>
<p>Pertanyaan mengenai data pribadi dapat disampaikan melalui WhatsApp resmi Ragil Aluminium yang tercantum pada halaman Kontak.</p>
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
<p>Ketentuan berikut berlaku untuk seluruh pembelian jendela, pintu, dan bouven aluminium Ragil Aluminium melalui website ini. Dengan melanjutkan pemesanan, Anda dianggap telah membaca dan menyetujui ketentuan ini.</p>

<h2>1. Pemesanan</h2>
<ul>
<li>Pesanan dibuat melalui checkout website dengan data penerima yang benar dan dapat dihubungi.</li>
<li>Setelah checkout, Anda menerima notifikasi WhatsApp berisi rincian produk, alamat, estimasi, dan total tagihan.</li>
<li>Pesanan diproses setelah Anda mengonfirmasi rincian tersebut. Konfirmasi dilakukan dengan menekan tombol konfirmasi pada pesan WhatsApp atau membalas persetujuan.</li>
<li>Kami berhak menunda pesanan bila data penerima tidak lengkap, nomor tidak aktif, atau alamat tidak dapat dijangkau ekspedisi.</li>
</ul>

<h2>2. Ukuran custom</h2>
<ul>
<li>Ukuran ditulis dalam format Tinggi x Panjang dalam sentimeter.</li>
<li>Permintaan ukuran custom wajib dicantumkan pada catatan pesanan atau disampaikan saat konfirmasi WhatsApp.</li>
<li>Toleransi produksi wajar sebesar lebih kurang satu sentimeter dapat terjadi karena proses pemotongan dan perakitan aluminium.</li>
<li>Produk custom dibuat khusus sesuai permintaan Anda sehingga tidak dapat dibatalkan setelah produksi berjalan.</li>
</ul>

<h2>3. Harga dan pembayaran</h2>
<ul>
<li>Harga yang berlaku adalah harga yang tertera saat pesanan dibuat, sudah termasuk pengemasan standar.</li>
<li>Metode pembayaran yang tersedia adalah COD atau bayar di tempat, dan transfer bank ke rekening resmi toko.</li>
<li>Pada metode COD, pembeli menyiapkan pembayaran sesuai total tagihan saat barang diterima. Biaya penanganan COD, bila berlaku, ditampilkan di checkout.</li>
<li>Pada metode transfer, pesanan diproses setelah bukti pembayaran diterima dan diverifikasi.</li>
<li>Voucher atau subsidi ongkir berlaku sesuai syarat yang ditampilkan pada saat checkout dan tidak dapat diuangkan.</li>
</ul>

<h2>4. Produksi dan pengiriman</h2>
<ul>
<li>Waktu produksi dihitung setelah konfirmasi pesanan dan pembayaran, tergantung jumlah unit dan tingkat kesulitan model.</li>
<li>Pengiriman dilakukan melalui J&amp;T Cargo atau mitra ekspedisi lain ke seluruh Indonesia.</li>
<li>Estimasi tiba yang kami sampaikan bersifat perkiraan dari ekspedisi dan dapat berubah karena kondisi jalur, cuaca, atau kebijakan kurir.</li>
<li>Nomor resi dikirim melalui WhatsApp dan dapat dipantau melalui menu Pesanan tanpa perlu masuk akun.</li>
<li>Biaya bongkar, kuli angkut, atau akses khusus di lokasi penerima bukan bagian dari layanan pengiriman.</li>
</ul>

<h2>5. Pemeriksaan barang saat diterima</h2>
<ul>
<li>Periksa jumlah paket, kondisi kemasan, kaca, dan kelengkapan aksesoris saat barang diterima.</li>
<li>Jika terdapat kerusakan akibat pengiriman, dokumentasikan dengan foto atau video kemasan dan produk, lalu laporkan melalui WhatsApp maksimal 2x24 jam sejak barang diterima.</li>
<li>Laporan tanpa dokumentasi kondisi kemasan menyulitkan proses klaim ke ekspedisi dan dapat memperlambat penyelesaian.</li>
</ul>

<h2>6. Retur, penggantian, dan garansi</h2>
<ul>
<li>Penggantian atau perbaikan diberikan untuk kerusakan pengiriman dan kesalahan produksi dari pihak kami, misalnya ukuran tidak sesuai spesifikasi yang telah dikonfirmasi.</li>
<li>Tidak termasuk garansi: kerusakan akibat pemasangan tidak sesuai panduan, benturan setelah diterima, modifikasi produk, atau keausan wajar pada karet dan aksesoris.</li>
<li>Perbedaan tampilan warna karena pencahayaan foto tidak termasuk cacat produk.</li>
<li>Proses klaim dimulai setelah dokumentasi lengkap diterima dan diverifikasi oleh tim kami.</li>
</ul>

<h2>7. Pemasangan</h2>
<p>Produk dikirim siap pasang beserta aksesoris dan baut fisher. Kami menyediakan panduan pemasangan melalui WhatsApp. Pekerjaan pemasangan di lokasi dilakukan oleh tukang atau aplikator pembeli, kecuali disepakati lain secara tertulis.</p>

<h2>8. Ketersediaan dan perubahan produk</h2>
<p>Spesifikasi, varian, dan harga dapat berubah tanpa pemberitahuan terlebih dahulu. Perubahan tidak berlaku untuk pesanan yang sudah dikonfirmasi.</p>

<h2>9. Hak kekayaan intelektual</h2>
<p>Seluruh foto produk, deskripsi, dan materi pada website ini merupakan milik Ragil Aluminium dan tidak boleh digunakan untuk kepentingan komersial pihak lain tanpa izin.</p>

<h2>10. Komunikasi resmi</h2>
<p>Komunikasi resmi hanya melalui nomor WhatsApp dan akun marketplace yang tercantum pada website ini. Kami tidak pernah meminta OTP, PIN, atau data perbankan Anda.</p>

<h2>11. Penyelesaian sengketa</h2>
<p>Setiap perselisihan diselesaikan secara musyawarah terlebih dahulu. Bila tidak tercapai kesepakatan, penyelesaian dilakukan sesuai hukum yang berlaku di Indonesia.</p>
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
            'subtitle' => 'Cerita pembeli yang sudah memasang jendela, pintu, dan bouven Ragil Aluminium.',
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
