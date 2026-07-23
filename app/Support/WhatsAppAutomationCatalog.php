<?php

namespace App\Support;

/**
 * Fixed Stage-8 / Figma automation triggers shown on WhatsApp Otomatis.
 * Rows live in whatsapp_templates; labels/descriptions are catalog-owned.
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
                'description' => 'Dikirim saat pelanggan menyelesaikan pesanan dengan metode Cash on Delivery (COD).',
                'icon' => 'hand-coins',
                'default_provider_name' => 'order_created_cod',
                'default_body' => "Terima kasih telah berbelanja di Ragil Aluminium!\n\nPesanan {{order_number}} sedang kami proses.\n\n📦 Rincian Pesanan:\n{{items}}\nTotal Tagihan: {{total}}\n\nAlamat pengiriman:\n{{address}}\n\nMohon siapkan uang pas sesuai total tagihan saat kurir datang ya, Kak.\n\nSalam hangat,\nRagil Aluminium",
                'variables' => [
                    ['token' => '{{order_number}}', 'label' => 'Nomor Order'],
                    ['token' => '{{items}}', 'label' => 'Rincian Produk'],
                    ['token' => '{{total}}', 'label' => 'Total Tagihan'],
                    ['token' => '{{address}}', 'label' => 'Alamat'],
                    ['token' => '{{ordered_at}}', 'label' => 'Waktu Order'],
                ],
            ],
            [
                'internal_key' => 'payment_instructions',
                'label' => 'WA Order Transfer',
                'description' => 'Berisi informasi rekening dan instruksi pembayaran untuk metode transfer bank.',
                'icon' => 'credit-card',
                'default_provider_name' => 'payment_instructions',
                'default_body' => "Terima kasih atas pesanan Anda di Ragil Aluminium.\n\nNomor pesanan: {{order_number}}\nTotal tagihan: {{total}}\n\nSilakan transfer sesuai nominal, lalu balas pesan ini dengan bukti pembayaran.\n\nSalam hangat,\nRagil Aluminium",
                'variables' => [
                    ['token' => '{{order_number}}', 'label' => 'Nomor Order'],
                    ['token' => '{{total}}', 'label' => 'Total Tagihan'],
                    ['token' => '{{items}}', 'label' => 'Rincian Produk'],
                    ['token' => '{{ordered_at}}', 'label' => 'Waktu Order'],
                ],
            ],
            [
                'internal_key' => 'payment_confirmed',
                'label' => 'WA Pesanan Diproses',
                'description' => "Dikirim ketika status pesanan diubah menjadi 'Diproses' atau siap dikemas.",
                'icon' => 'clipboard-list',
                'default_provider_name' => 'payment_confirmed',
                'default_body' => "Pembayaran untuk pesanan {{order_number}} sudah kami terima.\n\nPesanan Anda sedang diproses dan segera dikemas.\n\nSalam hangat,\nRagil Aluminium",
                'variables' => [
                    ['token' => '{{order_number}}', 'label' => 'Nomor Order'],
                    ['token' => '{{total}}', 'label' => 'Total Tagihan'],
                ],
            ],
            [
                'internal_key' => 'order_shipped',
                'label' => 'WA Resi Dikirim',
                'description' => 'Menginformasikan nomor resi pengiriman setelah paket diserahkan ke kurir.',
                'icon' => 'truck',
                'default_provider_name' => 'order_shipped',
                'default_body' => "Pesanan {{order_number}} sudah dikirim.\n\nNomor resi: {{waybill}}\n\nAnda dapat melacak status pengiriman di halaman pesanan.\n\nSalam hangat,\nRagil Aluminium",
                'variables' => [
                    ['token' => '{{order_number}}', 'label' => 'Nomor Order'],
                    ['token' => '{{waybill}}', 'label' => 'Nomor Resi'],
                ],
            ],
            [
                'internal_key' => 'order_delivered',
                'label' => 'WA Pesanan Sampai',
                'description' => "Pesan terima kasih dan permintaan review setelah status kurir 'Delivered'.",
                'icon' => 'check-circle',
                'default_provider_name' => 'order_delivered',
                'default_body' => "Pesanan {{order_number}} sudah sampai.\n\nTerima kasih sudah berbelanja di Ragil Aluminium. Jika berkenan, bagikan pengalaman Anda di halaman testimoni kami.\n\nSalam hangat,\nRagil Aluminium",
                'variables' => [
                    ['token' => '{{order_number}}', 'label' => 'Nomor Order'],
                    ['token' => '{{waybill}}', 'label' => 'Nomor Resi'],
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
