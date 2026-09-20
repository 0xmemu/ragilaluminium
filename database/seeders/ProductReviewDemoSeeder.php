<?php

namespace Database\Seeders;

use App\Models\CmsTestimonial;
use App\Models\Product;
use App\Support\TestimonialPageSettings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * Sepuluh ulasan contoh untuk produk SP57802368148 (Jendela 1 Daun Aluminium
 * Jungkit Polos, 140x50) di database dev.
 *
 * Halaman produk perlu contoh ulasan yang beragam supaya tampilan dan filter
 * ulasan bisa diperiksa apa adanya: bintang 1 sampai 5, ulasan berfoto,
 * ulasan bervideo, ulasan teks saja, dan balasan admin.
 *
 * Idempoten: tiap baris ditandai source_reference unik berawalan
 * `demo:review:SP57802368148:`, jadi menjalankan seeder dua kali tidak
 * menghasilkan duplikat. Baris lain di cms_testimonials tidak disentuh.
 *
 * Menghapus kembali (dev saja, jalankan eksplisit):
 *   DELETE FROM cms_testimonials
 *   WHERE source_reference LIKE 'demo:review:SP57802368148:%';
 *
 * Seeder ini tidak dipanggil DatabaseSeeder, jadi tidak ikut jalan otomatis.
 */
class ProductReviewDemoSeeder extends Seeder
{
    private const SKU = 'SP57802368148';

    private const REF_PREFIX = 'demo:review:SP57802368148:';

    /** Foto produk ini, dipakai ulang sebagai foto ulasan. */
    private const PHOTOS = [
        'https://media.333labs.tech/products/98/fQkS0OqNCjWhTW1i-card.webp',
        'https://media.333labs.tech/products/98/LVAVvFcucq5DpI7K-card.webp',
        'https://media.333labs.tech/products/98/3c38Cp2im5NRXjmt-card.webp',
        'https://media.333labs.tech/products/98/DjscUhGr9VLlqAbt-card.webp',
        'https://media.333labs.tech/products/98/PuF14Khf3ZxDmAaP-card.webp',
    ];

    /**
     * Tiga pesanan dev yang benar-benar memuat produk ini beserta pilihan
     * variannya. Label varian di kartu ulasan diturunkan dari baris pesanan
     * (CmsTestimonial::orderVariantLabel), bukan disimpan di tabel ulasan,
     * jadi ulasan tanpa pesanan tidak akan pernah menampilkan varian.
     * Dipakai contoh supaya tampilan label varian ikut terperiksa.
     */
    private const ORDER_COKELAT_BENING = 100001;

    private const ORDER_HITAM_ES = 100017;

    private const ORDER_HITAM_ES_KEDUA = 100019;

    /** Video contoh dari pustaka media, dipakai ulasan bervideo. */
    private const VIDEO = 'https://media.333labs.tech/media/library/2026/09/67d2e859-44bb-4bf9-ac21-fe055f1a344c.mp4';

    public function run(): void
    {
        if (! Schema::hasTable('cms_testimonials') || ! Schema::hasTable('products')) {
            return;
        }

        $product = Product::query()->where('parent_sku', self::SKU)->first();

        if (! $product) {
            $this->command?->warn('Produk '.self::SKU.' tidak ditemukan, seeder dilewati.');

            return;
        }

        $pageId = TestimonialPageSettings::pageId();
        $inserted = 0;
        $updated = 0;

        foreach ($this->reviews(self::PHOTOS) as $index => $row) {
            $reference = self::REF_PREFIX.str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);

            $media = [];
            foreach ($row['photos'] as $url) {
                $media[] = ['type' => 'image', 'url' => $url, 'source' => 'admin'];
            }
            if ($row['video']) {
                $media[] = ['type' => 'video', 'url' => self::VIDEO, 'source' => 'admin'];
            }

            // Jam dibuat berbeda-beda supaya urutan waktu tidak seragam.
            $when = now()->subDays($row['days_ago'])->setTime(9 + ($index % 9), (13 + $index * 7) % 60);

            $attributes = [
                'cms_page_id' => $pageId,
                'product_id' => $product->id,
                // Sebagian ulasan contoh sengaja tidak tertaut pesanan
                // (order_id null) supaya keduanya ikut terlihat di halaman.
                'order_id' => $row['order_id'] ?? null,
                'author_admin_id' => null,
                'author_type' => 'customer',
                'moderation_status' => 'approved',
                'verified_at' => $row['verified'] ? $when : null,
                'admin_reply' => $row['reply'],
                'admin_replied_at' => $row['reply'] ? $when : null,
                'admin_reply_admin_id' => null,
                'customer_name' => $row['customer_name'],
                'message' => $row['message'],
                'rating' => $row['rating'],
                'source' => 'website',
                'source_reference' => $reference,
                'location' => $row['location'],
                'image_url' => $row['photos'][0] ?? null,
                'image_urls' => $row['photos'] ?: null,
                'media_items' => $media ?: null,
                'published' => true,
                'sort_order' => $index + 1,
            ];

            $existing = CmsTestimonial::query()->where('source_reference', $reference)->first();

            if ($existing) {
                // Baris sudah ada: isinya diselaraskan supaya seeder tetap
                // idempoten, tetapi created_at tidak diubah agar tanggal
                // ulasan tidak bergeser setiap kali seeder dijalankan.
                $existing->forceFill($attributes);
                $existing->save();
                $updated++;

                continue;
            }

            $review = new CmsTestimonial();
            $review->forceFill($attributes + ['created_at' => $when, 'updated_at' => $when]);
            $review->save();

            $inserted++;
        }

        $this->command?->info(sprintf(
            'Ulasan demo %s: %d baris ditambahkan, %d baris diselaraskan.',
            self::SKU,
            $inserted,
            $updated,
        ));
    }

    /**
     * Rancangan empat belas ulasan, urut tampil (sort_order 1 tampil paling awal).
     *
     * Sebaran rating: bintang 5 tujuh baris, bintang 4 empat baris, lalu
     * bintang 3, 2, dan 1 masing-masing satu baris.
     *
     * Bentuk ulasan sengaja diragamkan supaya seluruh keadaan tampilan ikut
     * terperiksa:
     * - ulasan berteks, sebagian berfoto dan sebagian bervideo;
     * - ulasan berfoto tanpa teks sama sekali (kolom `message` null);
     * - ulasan hanya bintang, tanpa teks dan tanpa media;
     * - ulasan yang teksnya murni dari chip saran di form pelanggan, tanpa
     *   kalimat tambahan yang diketik sendiri.
     *
     * Dua bentuk terakhir tidak bisa dibuat lewat form mana pun saat ini:
     * form pelanggan mewajibkan teks minimal 3 karakter, dan form admin
     * mewajibkan teks atau gambar. Barisnya ada di sini khusus untuk menguji
     * tampilan kartu saat kolom teks kosong.
     *
     * @param  list<string>  $photos
     * @return list<array<string,mixed>>
     */
    private function reviews(array $photos): array
    {
        return [
            [
                'customer_name' => 'Ratna Sari', 'location' => 'Palembang', 'rating' => 5,
                'days_ago' => 2, 'verified' => false, 'video' => false, 'reply' => null,
                'photos' => [$photos[0], $photos[2], $photos[4], $photos[1]],
                'message' => 'Kaca bening dan tebal, cahaya masuk banyak tapi panas tetap tertahan. Rumah jadi jauh lebih terang dan terasa lebih sejuk. Puas sekali dengan hasilnya.',
            ],
            [
                'customer_name' => 'Andi Prasetyo', 'location' => 'Makassar', 'rating' => 4,
                'days_ago' => 6, 'verified' => false, 'video' => false, 'reply' => null,
                'photos' => [$photos[3], $photos[0]],
                'message' => 'Pemasangan saya kerjakan sendiri dengan panduan admin lewat video call, jadi tidak perlu cari tukang tambahan. Hasilnya sesuai ekspektasi, hanya saja baut tambahan harus saya beli sendiri.',
            ],
            [
                'customer_name' => 'Dewi Anggraini', 'location' => 'Surabaya', 'rating' => 5,
                'days_ago' => 11, 'verified' => true, 'video' => true, 'reply' => null,
                'photos' => [],
                'message' => 'Saya rekam proses pemasangannya supaya kelihatan detilnya. Aluminiumnya tebal dan tidak lentur saat ditekan. Tukang saya bilang rangkanya lurus dan sikunya rapi.',
            ],
            [
                'customer_name' => 'Rizky Pratama', 'location' => 'Bandung', 'rating' => 5,
                'days_ago' => 15, 'verified' => true, 'video' => false, 'order_id' => self::ORDER_COKELAT_BENING,
                'reply' => 'Terima kasih atas ulasannya. Senang mendengar ukurannya pas. Kalau nanti butuh tambahan unit untuk ruangan lain, silakan hubungi kami lewat WhatsApp.',
                'photos' => [$photos[1], $photos[3], $photos[2]],
                'message' => 'Ukuran 140x50 pas dengan bukaan yang saya ukur sendiri. Engsel halus dan tidak bunyi saat daun jendela dibuka tutup. Packing kayu rapat, tidak ada lecet sedikit pun.',
            ],
            [
                'customer_name' => 'Sri Wahyuni', 'location' => 'Yogyakarta', 'rating' => 5,
                'days_ago' => 21, 'verified' => true, 'video' => false, 'order_id' => self::ORDER_HITAM_ES,
                'reply' => null,
                'photos' => [],
                'message' => 'Sudah dua kali pesan di sini. Yang pertama untuk kamar anak, sekarang untuk dapur. Adminnya sabar membantu menghitung kebutuhan kaca dan tidak memaksa untuk upgrade.',
            ],
            [
                'customer_name' => 'Hendra Setiawan', 'location' => 'Tangerang', 'rating' => 4,
                'days_ago' => 28, 'verified' => true, 'video' => true, 'reply' => null,
                'photos' => [$photos[4]],
                'message' => 'Harga sesuai kualitas. Saya bandingkan dengan beberapa toko lain, di sini lebih murah untuk ukuran yang sama dan aksesorinya lengkap. Pengiriman butuh waktu karena luar Jawa.',
            ],
            [
                'customer_name' => 'Ahmad Fauzi', 'location' => 'Medan', 'rating' => 4,
                'days_ago' => 34, 'verified' => true, 'video' => false,
                'reply' => 'Terima kasih atas masukannya. Kami sedang memperbarui estimasi rute luar Jawa bersama ekspedisi agar lebih akurat. Senang mendengar barang sampai dengan aman.',
                'photos' => [$photos[2], $photos[1]],
                'message' => 'Kualitas bagus dan finishing catnya rata, tidak ada bagian yang tajam. Satu bintang saya tahan karena pengiriman ke Medan lebih lama dari perkiraan, tapi barang sampai dengan selamat.',
            ],
            [
                'customer_name' => 'Bayu Nugroho', 'location' => 'Semarang', 'rating' => 3,
                'days_ago' => 41, 'verified' => true, 'video' => false, 'order_id' => self::ORDER_HITAM_ES_KEDUA,
                'reply' => null,
                'photos' => [$photos[0]],
                'message' => 'Barangnya sesuai deskripsi dan rangkanya kokoh. Yang kurang pas buat saya, seal karet di sisi bawah agak longgar sehingga perlu saya rekatkan ulang. Fungsi jendelanya tetap normal.',
            ],
            [
                'customer_name' => 'Nurul Hidayah', 'location' => 'Bekasi', 'rating' => 2,
                'days_ago' => 49, 'verified' => true, 'video' => false,
                'reply' => 'Mohon maaf atas ketidaknyamanannya. Kami sudah memperbaiki alur pengecekan ukuran sebelum barang dikirim. Terima kasih sudah memberi kesempatan kami untuk memperbaikinya.',
                'photos' => [$photos[3]],
                'message' => 'Pesanan saya sempat tertukar ukurannya. Setelah dihubungi, admin langsung memproses penggantian tanpa biaya tambahan. Produknya sendiri sebenarnya bagus, hanya prosesnya jadi lebih lama.',
            ],
            [
                'customer_name' => 'Joko Susilo', 'location' => 'Malang', 'rating' => 1,
                'days_ago' => 56, 'verified' => true, 'video' => false,
                'reply' => 'Mohon maaf sebesar-besarnya atas keterlambatan ini. Kendalanya ada di pihak ekspedisi untuk rute tersebut dan sudah kami tindak lanjuti. Tim kami menghubungi Anda lewat WhatsApp untuk penyelesaiannya.',
                'photos' => [],
                'message' => 'Saya beri satu bintang karena barang datang hampir dua minggu dari estimasi. Saya membutuhkannya untuk renovasi yang sudah dijadwalkan, jadi jadwal tukang ikut mundur.',
            ],
            [
                // Foto tanpa teks: pembeli hanya mengirim gambar hasil pemasangan.
                'customer_name' => 'Rina Anggraini', 'location' => 'Balikpapan', 'rating' => 5,
                'days_ago' => 62, 'verified' => true, 'video' => false, 'reply' => null,
                'photos' => [$photos[2], $photos[4]],
                'message' => null,
            ],
            [
                // Bintang saja: tanpa teks dan tanpa media.
                'customer_name' => 'Hasan Basri', 'location' => 'Denpasar', 'rating' => 4,
                'days_ago' => 70, 'verified' => true, 'video' => false, 'reply' => null,
                'photos' => [],
                'message' => null,
            ],
            [
                // Teks murni dari satu chip saran pada form ulasan pelanggan.
                'customer_name' => 'Maya Puspita', 'location' => 'Pontianak', 'rating' => 5,
                'days_ago' => 77, 'verified' => true, 'video' => false, 'reply' => null,
                'photos' => [],
                'message' => 'Pengiriman cepat',
            ],
            [
                // Tiga chip berturut-turut: chip pertama apa adanya, chip
                // berikutnya dihuruf-kecilkan dan dipisah koma, sama seperti
                // hasil toggleSuggestion di form pelanggan.
                'customer_name' => 'Gilang Ramadhan', 'location' => 'Pekanbaru', 'rating' => 5,
                'days_ago' => 84, 'verified' => true, 'video' => false, 'reply' => null,
                'photos' => [],
                'message' => 'Pengiriman cepat, barang berkualitas, pelayanan ramah',
            ],
        ];
    }
}
