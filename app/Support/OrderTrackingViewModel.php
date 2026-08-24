<?php

namespace App\Support;

use App\Models\Order;
use App\Models\ShippingRecord;
use App\Models\ShippingTrackingEvent;

/**
 * ViewModel terpadu untuk halaman tracking order (customer-facing).
 *
 * Menyatukan status order, pembayaran, fulfillment ready-stock, dan pengiriman
 * menjadi satu sumber kebenaran yang sudah dinormalisasi (SOT). UI membaca dari
 * view model ini saja; jangan menghitung status sendiri-sendiri di komponen.
 *
 * Fokus ready-stock: TIDAK menampilkan milestone validasi ukuran / produksi /
 * quality control / packing / estimasi produksi / approval spesifikasi / DP.
 * Milestone yang tampil adalah alur ready-stock: dibuat -> pembayaran/konfirmasi
 * -> siap dikirim -> diserahkan ke kurir -> dalam perjalanan -> sedang diantar -> terkirim.
 */
class OrderTrackingViewModel
{
    public function __construct(
        private Order $order,
        private ?ShippingRecord $shipping = null,
    ) {
        if ($shipping === null && $order->relationLoaded('shippingRecords')) {
            $this->shipping = $order->shippingRecords->first(
                fn (ShippingRecord $r) => $r->status !== 'cancelled',
            ) ?? $order->shippingRecords->first();
        }
    }

    /**
     * Normalisasi status pengiriman J&T internal -> status yang dipahami UI.
     *
     * @return string salah satu: waybill_created|picked_up|in_transit|out_for_delivery|delivered|delivery_failed|returned|exception|not_shipped
     */
    private function normalizedShippingStatus(): string
    {
        // Tidak ada shipping record / belum ada resi -> belum dikirim.
        if ($this->shipping === null || ! filled($this->shipping->waybill_number)) {
            return 'not_shipped';
        }

        $raw = (string) $this->shipping->status;

        return match ($raw) {
            'picked_up' => 'picked_up',
            'in_transit' => 'in_transit',
            'delivered' => 'delivered',
            'returned' => 'returned',
            'exception' => 'exception',
            'cancelled' => 'returned',
            default => 'waybill_created',
        };
    }

    /** Status order yang dipahami UI (kanonik ready-stock C). */
    private function orderStatus(): string
    {
        return (string) $this->order->order_status;
    }

    private function isCod(): bool
    {
        return (bool) ($this->order->cod_flag || $this->order->payment_method === 'cod');
    }

    private function isPaid(): bool
    {
        return $this->order->payment_status === 'paid';
    }

    /** Payment status kanonik (unpaid/pending_verification/paid/failed/expired/refunded/pending_collection). */
    private function paymentStatus(): string
    {
        $status = (string) $this->order->payment_status;

        if ($this->isCod()) {
            // COD sebelum barang diterima = belum dibayar (pengumpulan saat diterima).
            if ($status === 'paid') {
                return 'paid';
            }
            $shipping = $this->normalizedShippingStatus();

            return $shipping === 'delivered' ? 'pending_collection' : 'pending_collection';
        }

        return match ($status) {
            'paid' => 'paid',
            'refunded' => 'refunded',
            'pending' => 'unpaid',     // order baru menunggu pembayaran transfer
            default => 'unpaid',
        };
    }

    /**
     * Child primary status (headline + message) sesuai prioritas:
     * cancelled/refunded > exception/delivery_failed > unpaid/payment > fulfillment/shipping.
     *
     * @return array{key:string,label:string,tone:string,headline:string,message:string,updatedAt?:string}
     */
    public function primaryStatus(): array
    {
        $status = $this->orderStatus();
        $shipping = $this->normalizedShippingStatus();
        $payment = $this->paymentStatus();

        // 0. Issue / kendala pada pesanan (prioritas tertinggi setelah cancelled)
        if ($status === 'issue') {
            return $this->mk('issue', 'Perlu perhatian', 'warning',
                'Pesanan memerlukan perhatian',
                'Ada kendala pada pesanan. Tim kami akan menghubungi Anda melalui WhatsApp.');
        }

        // 1. Cancelled / return terminal
        if ($status === 'cancelled') {
            return $this->mk('cancelled', 'Pesanan dibatalkan', 'danger',
                'Pesanan dibatalkan',
                'Pesanan ini tidak akan diproses atau dikirim.');
        }
        if (in_array($status, ['return_completed'], true)) {
            return $this->mk('refunded', 'Retur selesai', 'success', 'Retur selesai',
                'Proses retur telah selesai dan dicatat oleh tim kami.');
        }
        if (in_array($status, ['return_in_process'], true)) {
            return $this->mk('return_in_process', 'Retur diproses', 'warning', 'Retur sedang diproses',
                'Tim kami akan memberi kabar selanjutnya melalui WhatsApp.');
        }

        // 2. Refund
        if ($payment === 'refunded') {
            return $this->mk('refunded', 'Refund diproses', 'info', 'Refund sedang diproses',
                'Dana akan dikembalikan melalui metode pembayaran yang digunakan.');
        }

        // 3. Delivery exception / failed
        if ($shipping === 'exception' || $shipping === 'delivery_failed' || $shipping === 'returned') {
            return $this->mk('delivery_failed', 'Pengiriman perlu perhatian', 'danger',
                'Pengiriman belum berhasil',
                'Kurir belum dapat menyerahkan paket ke alamat tujuan. Hubungi kami untuk bantuan.');
        }

        // 4. Payment unpaid/pending (hanya transfer; COD tidak minta bayar sekarang)
        if ($payment === 'unpaid' && ! $this->isCod()) {
            return $this->mk('payment_pending', 'Menunggu pembayaran', 'warning',
                'Pesanan menunggu pembayaran',
                'Pesanan akan mulai disiapkan setelah pembayaran dikonfirmasi.');
        }
        if ($payment === 'pending_verification' && ! $this->isCod()) {
            return $this->mk('payment_verification', 'Pembayaran diverifikasi', 'info',
                'Pembayaran sedang diverifikasi',
                'Bukti pembayaran Anda sedang diperiksa oleh tim kami.');
        }

        // 5. COD aktif pengiriman -> primary mengikuti shipping
        if (! $this->isPaid()) {
            // Belum lanjut ke delivery -> order pending (belum konfirmasi/proses) utk COD
            if ($status === 'awaiting_confirmation') {
                return $this->mk('confirmed', 'Pesanan dikonfirmasi', 'neutral',
                    'Pesanan dikonfirmasi',
                    'Pembayaran dilakukan saat barang diterima sesuai ketentuan COD.');
            }
        }

        // 6. Fulfillment/shipping normal
        return $this->primaryByShipping($shipping);
    }

    private function primaryByShipping(string $shipping): array
    {
        $isCod = $this->isCod();

        return match ($shipping) {
            'waybill_created' => $this->mk('ready_to_ship', 'Siap dikirim', 'info',
                'Pesanan siap dikirim',
                $isCod
                    ? 'Paket sedang disiapkan untuk diserahkan ke kurir. Siapkan pembayaran sesuai total saat barang diterima.'
                    : 'Paket sedang disiapkan untuk diserahkan ke kurir.'),
            'picked_up', 'in_transit' => $this->mk('in_transit', 'Dalam perjalanan', 'info',
                'Dalam perjalanan',
                'Paket sedang menuju kota tujuan.',
                $this->shipping?->last_status_at?->toIso8601String()),
            'out_for_delivery' => $this->mk('out_for_delivery', 'Sedang diantar', 'info',
                'Sedang diantar',
                'Kurir sedang menuju alamat Anda.',
                $this->shipping?->last_status_at?->toIso8601String()),
            'delivered' => $this->mk('delivered', 'Pesanan terkirim', 'success',
                'Pesanan terkirim',
                'Paket telah diterima.',
                $this->shipping?->last_status_at?->toIso8601String()),
            'returned' => $this->mk('returned', 'Paket dikembalikan', 'danger',
                'Paket dikembalikan ke pengirim',
                'Pengiriman tidak dapat diselesaikan. Tim kami akan menghubungi Anda untuk langkah selanjutnya.'),
            default => $this->primaryByNotShipped($isCod),
        };
    }

    private function primaryByNotShipped(bool $isCod): array
    {
        $status = $this->orderStatus();

        // Order sedang diproses admin (belum resi) -> fase siap dikirim (ready-stock).
        if ($status === 'processing') {
            return $this->mk('ready_to_ship', 'Pesanan siap dikirim', 'info',
                'Pesanan siap dikirim',
                'Pesanan sedang disiapkan untuk diserahkan ke kurir.');
        }

        return $this->mk('pending', $isCod ? 'Pesanan dikonfirmasi' : 'Menunggu pembayaran', 'neutral',
            $isCod ? 'Pesanan dikonfirmasi' : 'Pesanan menunggu pembayaran',
            $isCod
                ? 'Pembayaran dilakukan saat barang diterima sesuai ketentuan COD.'
                : 'Pesanan akan mulai disiapkan setelah pembayaran dikonfirmasi.');
    }

    /**
     * @return array{type:string,title:string,message:string,ctaLabel?:string,ctaHref?:string}|null
     */
    public function actionRequired(): ?array
    {
        $status = $this->orderStatus();
        if (in_array($status, ['cancelled', 'return_completed', 'completed'], true)) {
            return null;
        }

        $payment = $this->paymentStatus();
        $shipping = $this->normalizedShippingStatus();

        // Issue pesanan -> hubungi support
        if ($status === 'issue') {
            return [
                'type' => 'contact_support',
                'title' => 'Pesanan memerlukan perhatian',
                'message' => 'Ada kendala pada pesanan. Tim kami akan menghubungi Anda melalui WhatsApp.',
                'ctaLabel' => 'Hubungi Kami',
                'ctaHref' => '#bantuan',
            ];
        }

        // Transfer unpaid -> bayar sekarang
        if ($payment === 'unpaid' && ! $this->isCod()) {
            return [
                'type' => 'pay_now',
                'title' => 'Menunggu pembayaran',
                'message' => 'Selesaikan pembayaran agar pesanan segera dikirim.',
                'ctaLabel' => 'Bayar Sekarang',
                'ctaHref' => '#pembayaran',
            ];
        }
        // Transfer pending verification
        if ($payment === 'pending_verification' && ! $this->isCod()) {
            return [
                'type' => 'await_verification',
                'title' => 'Pembayaran sedang diverifikasi',
                'message' => 'Bukti pembayaran Anda sedang diperiksa oleh tim kami.',
                'ctaLabel' => 'Lihat Detail Pembayaran',
                'ctaHref' => '#pembayaran',
            ];
        }
        // Delivery exception
        if ($shipping === 'exception' || $shipping === 'delivery_failed' || $shipping === 'returned') {
            return [
                'type' => 'contact_support',
                'title' => 'Pengiriman memerlukan perhatian',
                'message' => 'Kurir mengalami kendala saat mengantarkan pesanan. Hubungi kami untuk bantuan.',
                'ctaLabel' => 'Hubungi Kami',
                'ctaHref' => '#bantuan',
            ];
        }

        return null;
    }

    /**
     * Milestone ready-stock. Satu state 'current'.
     *
     * @return list<array{key:string,label:string,state:string,occurredAt?:string,customerMessage?:string}>
     */
    public function milestones(): array
    {
        $status = $this->orderStatus();
        $payment = $this->paymentStatus();
        $shipping = $this->normalizedShippingStatus();
        $isCod = $this->isCod();

        $cancel = ['cancelled', 'return_completed', 'return_in_process', 'issue'];

        $orderMade = ['key' => 'order_created', 'label' => 'Pesanan dibuat', 'state' => 'completed'];

        if (in_array($status, $cancel, true)) {
            return [
                $orderMade,
                ['key' => 'exception', 'label' => $this->cancelLabel($status), 'state' => 'exception'],
            ];
        }

        // Langkah pembayaran/konfirmasi
        $paymentStep = $isCod
            ? ['key' => 'order_confirmed', 'label' => 'Pesanan dikonfirmasi', 'state' => 'completed', 'occurredAt' => $this->createdAt()]
            : ['key' => 'payment_verified', 'label' => 'Pembayaran dikonfirmasi', 'state' => 'completed', 'occurredAt' => $this->createdAt()];

        // Jika transfer belum bayar -> current di sini
        if ($payment === 'unpaid' && ! $isCod) {
            $paymentStep['state'] = 'current';
            $paymentStep['label'] = 'Menunggu pembayaran';

            return [$orderMade, $paymentStep];
        }
        if ($payment === 'pending_verification' && ! $isCod) {
            $paymentStep['state'] = 'current';
            $paymentStep['label'] = 'Pembayaran sedang diverifikasi';

            return [$orderMade, $paymentStep];
        }

        // Status order sebelum processing (COD belum di-proses / transfer belum lanjut)
        if ($isCod && in_array($status, ['awaiting_confirmation'], true)) {
            $paymentStep['state'] = 'current';
            $paymentStep['label'] = 'Pesanan dikonfirmasi';

            return [$orderMade, $paymentStep];
        }

        // Ready-stock fulfillment + shipping
        $ms = [$orderMade, $paymentStep];
        // Orders yang sudah lolos payment/konfirmasi masuk ke siap dikirim & seterusnya
        $ms = array_merge($ms, [
            ['key' => 'ready_to_ship', 'label' => 'Pesanan siap dikirim', 'state' => 'upcoming'],
            ['key' => 'handover_to_carrier', 'label' => 'Diserahkan ke kurir', 'state' => 'upcoming'],
            ['key' => 'in_transit', 'label' => 'Dalam perjalanan', 'state' => 'upcoming'],
            ['key' => 'out_for_delivery', 'label' => 'Sedang diantar', 'state' => 'upcoming'],
            ['key' => 'delivered', 'label' => 'Terkirim', 'state' => 'upcoming'],
        ]);

        // Tandai current bedasarkan shipping
        return $this->markShippingMilestones($ms, $shipping, $status);
    }

    private function cancelLabel(string $status): string
    {
        return match ($status) {
            'cancelled' => 'Pesanan dibatalkan',
            'return_completed' => 'Retur selesai',
            'return_in_process' => 'Retur diproses',
            'issue' => 'Pesanan memerlukan perhatian',
            default => 'Perlu perhatian',
        };
    }

    /**
     * @param  list<array<string,mixed>>  $ms
     * @return list<array<string,mixed>>
     */
    private function markShippingMilestones(array $ms, string $shipping, string $orderStatus): array
    {
        // sesuai ship progress
        $progress = match ($shipping) {
            'waybill_created' => 2,   // siap dikirim
            'picked_up' => 3,         // diserahkan ke kurir
            'in_transit' => 4,        // dalam perjalanan
            'out_for_delivery' => 5,  // sedang diantar
            'delivered' => 6,         // terkirim
            default => null,
        };

        foreach ($ms as $i => $m) {
            if ($m['key'] === 'order_created') {
                $ms[$i]['state'] = 'completed';
                $ms[$i]['occurredAt'] = $this->createdAt();
                continue;
            }
            if ($m['key'] === 'payment_verified' || $m['key'] === 'order_confirmed') {
                $ms[$i]['state'] = 'completed';
                continue;
            }
            if ($progress === null) {
                // Order diproses admin (belum resi) = fase siap dikirim untuk ready-stock.
                if ($orderStatus === 'processing' && $m['key'] === 'ready_to_ship') {
                    $ms[$i]['state'] = 'current';
                }
                continue;
            }
            $position = ['ready_to_ship' => 2, 'handover_to_carrier' => 3, 'in_transit' => 4, 'out_for_delivery' => 5, 'delivered' => 6][$m['key']] ?? null;
            if ($position === null) {
                continue;
            }
            if ($position < $progress) {
                $ms[$i]['state'] = 'completed';
            } elseif ($position === $progress) {
                $ms[$i]['state'] = 'current';
            }
        }

        return $ms;
    }

    /**
     * @return array{label:string,startAt?:string,endAt?:string,isShipEstimate:bool}|null
     */
    public function estimate(): ?array
    {
        $payment = $this->paymentStatus();
        // Jangan tampilkan estimasi tiba bila belum bayar / belum konfirmasi.
        if ($payment === 'unpaid' || $payment === 'pending_verification') {
            return null;
        }
        $status = $this->orderStatus();
        if (in_array($status, ['cancelled', 'return_completed', 'return_in_process', 'issue'], true)) {
            return null;
        }

        $shipping = $this->normalizedShippingStatus();
        $eta = OrderEta::forOrder($this->order);

        if (in_array($shipping, ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'], true) && $eta) {
            return [
                'label' => 'Estimasi tiba',
                'startAt' => $eta['start_at'],
                'endAt' => $eta['end_at'],
                'isShipEstimate' => true,
            ];
        }

        return null;
    }

    /** @return array{customerName:string,phoneMasked:string,address:string,method:string} */
    public function recipient(): array
    {
        $phone = (string) $this->order->customer_phone;
        $masked = $phone;
        if (strlen($phone) >= 7) {
            $masked = substr($phone, 0, 3).'••••'.substr($phone, -2);
        }
        $address = trim(implode(', ', array_filter([
            (string) $this->order->shipping_city,
            (string) $this->order->shipping_province,
        ], fn ($v) => $v !== '')));

        return [
            'customerName' => (string) $this->order->customer_name,
            'phoneMasked' => $masked,
            'address' => $address,
            'method' => $this->shipping?->carrier_name ?: ($this->shipping ? 'J&T Cargo' : 'Ekspedisi'),
        ];
    }

    /** @return array{carrierName:string,waybill:string|null,trackingUrl:string|null,lastStatusAt:string|null,paymentTerm:string,payAmount:float}|null */
    public function carrier(): ?array
    {
        $shipping = $this->shipping;
        if ($shipping === null || ! filled($shipping->waybill_number)) {
            return null;
        }

        return [
            'carrierName' => (string) $shipping->carrier_name,
            'waybill' => (string) $shipping->waybill_number,
            'trackingUrl' => $shipping->tracking_url,
            'lastStatusAt' => $shipping->last_status_at?->toIso8601String(),
            'paymentTerm' => $this->isCod() ? 'COD' : 'Transfer',
            'payAmount' => (float) $this->order->total_amount,
        ];
    }

    /** @return array{paymentMethod:string,statusLabel:string,statusKey:string,total:float,paidAt?:string|null} */
    public function payment(): array
    {
        $isCod = $this->isCod();
        $method = $isCod ? 'Bayar di Tempat (COD)' : ($this->order->payment_method === 'cod' ? 'Bayar di Tempat (COD)' : 'Transfer Bank');
        $payment = $this->paymentStatus();
        $orderStatus = (string) $this->order->order_status;

        // Order dibatalkan/diselesaikan -> pembayaran tidak lagi ditagih.
        if (in_array($orderStatus, ['cancelled', 'return_completed'], true)) {
            return [
                'paymentMethod' => $method,
                'statusLabel' => 'Dibatalkan',
                'statusKey' => 'cancelled',
                'total' => (float) $this->order->total_amount,
                'paidAt' => null,
            ];
        }

        [$statusKey, $statusLabel] = match (true) {
            $payment === 'paid' => ['paid', 'Lunas'],
            $isCod && $this->normalizedShippingStatus() === 'delivered' => ['pending_collection', 'Menunggu pengumpulan'],
            $isCod => ['pending_collection', 'Dibayar saat barang diterima'],
            $payment === 'pending_verification' => ['pending_verification', 'Sedang diverifikasi'],
            $payment === 'refunded' => ['refunded', 'Dikembalikan'],
            default => ['unpaid', 'Menunggu pembayaran'],
        };

        // Instruksi transfer utk order transfer yang belum lunas.
        $bank = null;
        if (! $isCod && in_array($statusKey, ['unpaid', 'pending_verification'], true)) {
            $bank = \App\Support\BankTransferInstructions::forStorefront();
        }

        return [
            'paymentMethod' => $method,
            'statusLabel' => $statusLabel,
            'statusKey' => $statusKey,
            'total' => (float) $this->order->total_amount,
            'paidAt' => null,
            'bank' => $bank,
        ];
    }

    /** Ekspos objek view model penuh untuk payload. @return array<string,mixed> */
    public function toArray(): array
    {
        return [
            'primaryStatus' => $this->primaryStatus(),
            'actionRequired' => $this->actionRequired(),
            'milestones' => $this->milestones(),
            'estimate' => $this->estimate(),
            'recipient' => $this->recipient(),
            'carrier' => $this->carrier(),
            'payment' => $this->payment(),
            'canShowCarrierDetails' => $this->shipping !== null && filled($this->shipping->waybill_number),
        ];
    }

    private function createdAt(): string
    {
        return optional($this->order->created_at)?->toIso8601String() ?? now()->toIso8601String();
    }

    /**
     * @return array{key:string,label:string,tone:string,headline:string,message:string,updatedAt?:string}
     */
    private function mk(string $key, string $label, string $tone, string $headline, string $message, ?string $updatedAt = null): array
    {
        $out = [
            'key' => $key,
            'label' => $label,
            'tone' => $tone,
            'headline' => $headline,
            'message' => $message,
        ];
        if ($updatedAt !== null) {
            $out['updatedAt'] = $updatedAt;
        }

        return $out;
    }
}