<?php

namespace App\Support;

/**
 * Fixed Stage-8 automation triggers shown on WhatsApp Otomatis.
 * Rows live in whatsapp_templates; labels/descriptions/scripts are catalog-owned.
 *
 * Meta Cloud API: variabel body berurutan {{1}}, {{2}}, … dan **setiap indeks
 * hanya boleh muncul sekali** di naskah (tidak boleh {{1}} dua kali).
 * Kalau nama perlu disebut lagi, pakai slot baru (nilai sama dikirim 2x).
 *
 * @phpstan-type Trigger array{
 *   internal_key: string,
 *   label: string,
 *   description: string,
 *   icon: string,
 *   default_provider_name: string,
 *   default_body: string,
 *   variables: list<array{token: string, label: string}>
 * }
 */
class WhatsAppAutomationCatalog
{
    /**
     * @return list<Trigger>
     */
    public static function all(): array
    {
        return [
            [
                'internal_key' => 'order_created',
                'label' => 'WA Order COD',
                'description' => 'Dikirim saat pelanggan menyelesaikan pesanan COD. Tombol/balasan konfirmasi pelanggan otomatis memproses pesanan (pending → diproses).',
                'icon' => 'hand-coins',
                'default_provider_name' => 'order_created_cod',
                'default_body' => <<<'TXT'
Halo Kak *{{1}}*,
terima kasih sudah order di Ragil Aluminium 😊

Berikut rincian pesanan Kakak dengan nomor order : *{{2}}*
Mohon bantu dicek kembali, apakah rincian produk dan alamat pengiriman di bawah ini sudah sesuai ya Kak 🙏

*DATA PENERIMA*
Nama: {{3}}
Alamat: {{4}}
Detail tambahan: {{5}}

*RINCIAN PRODUK*
{{6}}

Estimasi sampai Tujuan : *{{7}}*
Metode Pembayaran : *COD*
Total Tagihan : *Rp {{8}}*

Mohon menyiapkan pembayaran *COD* saat barang diterima ya Kak.

Untuk konfirmasi pesanan, tolong tekan tombol dibawah ya kak,
agar pesanan kakak segera diproses

Terima kasih Kak 🙏
TXT,
                'variables' => [
                    ['token' => '{{1}}', 'label' => 'Nama pelanggan (sapaan)'],
                    ['token' => '{{2}}', 'label' => 'Nomor order'],
                    ['token' => '{{3}}', 'label' => 'Nama pelanggan (data penerima)'],
                    ['token' => '{{4}}', 'label' => 'Alamat pengiriman'],
                    ['token' => '{{5}}', 'label' => 'Detail tambahan / catatan'],
                    ['token' => '{{6}}', 'label' => 'Rincian produk'],
                    ['token' => '{{7}}', 'label' => 'Estimasi sampai tujuan'],
                    ['token' => '{{8}}', 'label' => 'Total tagihan (tanpa Rp)'],
                ],
            ],
            [
                'internal_key' => 'payment_instructions',
                'label' => 'WA Order Transfer',
                'description' => 'Berisi rincian pesanan + rekening dan instruksi pembayaran untuk metode transfer bank.',
                'icon' => 'credit-card',
                'default_provider_name' => 'payment_instructions',
                'default_body' => <<<'TXT'
Halo Kak *{{1}}*,
terima kasih sudah order di Ragil Aluminium 😊

Berikut rincian pesanan Kakak dengan nomor order : *{{2}}*
Mohon bantu dicek kembali, apakah rincian produk dan alamat pengiriman di bawah ini sudah sesuai ya Kak 🙏

*DATA PENERIMA*
Nama: {{3}}
Alamat: {{4}}
Detail tambahan: {{5}}

*RINCIAN PRODUK*
{{6}}

Estimasi sampai Tujuan : *{{7}}*
Metode Pembayaran : *Transfer*
Total Tagihan : *Rp {{8}}*

Jika detail pesanan dan alamat sudah sesuai, silakan melakukan pembayaran ke rekening berikut :
Bank : *{{9}}*
No. Rekening : *{{10}}*
Atas Nama : *{{11}}*

Setelah transfer, mohon kirim bukti pembayaran di chat ini ya Kak,
agar pesanan kakak segera diproses

Terima kasih Kak 🙏
TXT,
                'variables' => [
                    ['token' => '{{1}}', 'label' => 'Nama pelanggan (sapaan)'],
                    ['token' => '{{2}}', 'label' => 'Nomor order'],
                    ['token' => '{{3}}', 'label' => 'Nama pelanggan (data penerima)'],
                    ['token' => '{{4}}', 'label' => 'Alamat pengiriman'],
                    ['token' => '{{5}}', 'label' => 'Detail tambahan / catatan'],
                    ['token' => '{{6}}', 'label' => 'Rincian produk'],
                    ['token' => '{{7}}', 'label' => 'Estimasi sampai tujuan'],
                    ['token' => '{{8}}', 'label' => 'Total tagihan (tanpa Rp)'],
                    ['token' => '{{9}}', 'label' => 'Nama bank'],
                    ['token' => '{{10}}', 'label' => 'No. rekening'],
                    ['token' => '{{11}}', 'label' => 'Atas nama rekening'],
                ],
            ],
            [
                'internal_key' => 'payment_confirmed',
                'label' => 'WA Pesanan Diproses',
                'description' => "Dikirim ketika admin menekan 'Proses Pesanan' (status diproses / siap dikemas).",
                'icon' => 'clipboard-list',
                'default_provider_name' => 'payment_confirmed',
                'default_body' => <<<'TXT'
Halo Kak *{{1}}*,
pesanan Kakak dengan nomor order : *{{2}}* saat ini sudah mulai kami proses 😊

Detail pesanan, alamat pengiriman, dan pembayaran sudah kami konfirmasi sebelumnya melalui WhatsApp.

Estimasi sampai Tujuan : *{{3}}*

Nanti kami akan mengabari kembali setelah pesanan dikirim dan nomor resi sudah tersedia ya Kak.

Terima kasih sudah order di Ragil Aluminium 🙏
TXT,
                'variables' => [
                    ['token' => '{{1}}', 'label' => 'Nama pelanggan'],
                    ['token' => '{{2}}', 'label' => 'Nomor order'],
                    ['token' => '{{3}}', 'label' => 'Estimasi sampai tujuan'],
                ],
            ],
            [
                'internal_key' => 'order_shipped',
                'label' => 'WA Resi Dikirim',
                'description' => 'Menginformasikan ekspedisi + nomor resi setelah paket diserahkan ke kurir / resi diinput di website.',
                'icon' => 'truck',
                'default_provider_name' => 'order_shipped',
                'default_body' => <<<'TXT'
Halo Kak *{{1}}*,
pesanan Kakak dengan nomor order : *{{2}}* saat ini sudah kami kirim 😊

Berikut informasi pengirimannya

*INFORMASI PENGIRIMAN*
Ekspedisi : *{{3}}*
No. Resi : *{{4}}*

Kakak bisa cek status pengiriman pesanan melalui link berikut : {{5}}

Estimasi sampai Tujuan : *{{6}}*

Mohon ditunggu ya Kak, terima kasih sudah order di Ragil Aluminium 🙏
TXT,
                'variables' => [
                    ['token' => '{{1}}', 'label' => 'Nama pelanggan'],
                    ['token' => '{{2}}', 'label' => 'Nomor order'],
                    ['token' => '{{3}}', 'label' => 'Ekspedisi'],
                    ['token' => '{{4}}', 'label' => 'Nomor resi'],
                    ['token' => '{{5}}', 'label' => 'Link lacak pesanan'],
                    ['token' => '{{6}}', 'label' => 'Estimasi sampai tujuan'],
                ],
            ],
            [
                'internal_key' => 'order_delivered',
                'label' => 'WA Pesanan Sampai',
                'description' => 'Konfirmasi sampai dari tracking otomatis + minta cek kondisi barang.',
                'icon' => 'check-circle',
                'default_provider_name' => 'order_delivered',
                'default_body' => <<<'TXT'
Halo Kak *{{1}}*,
berdasarkan tracking pengiriman, pesanan dengan nomor order : *{{2}}* saat ini sudah dinyatakan *sampai / diterima* 😊

Mohon bantu dicek kembali kondisi barang dan kesesuaian pesanan ya Kak.

Jika ada kendala, kerusakan pengiriman, atau ketidaksesuaian pesanan, silakan langsung infokan di chat ini agar bisa segera kami bantu tindak lanjuti.

Terima kasih sudah order di Ragil Aluminium 🙏
TXT,
                'variables' => [
                    ['token' => '{{1}}', 'label' => 'Nama pelanggan'],
                    ['token' => '{{2}}', 'label' => 'Nomor order'],
                ],
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return array_column(self::all(), 'internal_key');
    }

    /**
     * @return Trigger|null
     */
    public static function find(string $internalKey): ?array
    {
        foreach (self::all() as $trigger) {
            if ($trigger['internal_key'] === $internalKey) {
                return $trigger;
            }
        }

        return null;
    }
}
