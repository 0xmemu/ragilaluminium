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
            'out_for_delivery' => 'out_for_delivery',
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
            return $this->mk('payment_pending', 'Menunggu Konfirmasi', 'warning',
                'Pesanan menunggu konfirmasi',
                'Pesanan belum dapat dikonfirmasi sebelum pembayaran diterima.');
        }
        if ($payment === 'pending_verification' && ! $this->isCod()) {
            return $this->mk('payment_verification', 'Pembayaran diverifikasi', 'info',
                'Pembayaran sedang diverifikasi',
                'Bukti pembayaran Anda sedang diperiksa oleh tim kami.');
        }

        // 5. COD aktif pengiriman -> primary mengikuti shipping
        if (! $this->isPaid()) {
            // Belum lanjut ke delivery -> order pending (belum konfirmasi/proses) utk COD.
            // Kontrak A: order baru/menunggu verifikasi = "Pesanan sedang dikonfirmasi".
            if ($status === 'awaiting_confirmation') {
                return $this->mk('awaiting_confirmation', 'Pesanan menunggu konfirmasi', 'warning',
                    'Pesanan menunggu konfirmasi',
                    'Kami sedang memverifikasi pesanan Anda.');
            }
        }

        // 5b. Order selesai: tidak ada retur baru, hanya dukungan historis.
        if ($status === 'completed') {
            return $this->mk('completed', 'Pesanan selesai', 'success',
                'Pesanan selesai',
                'Terima kasih, pesanan Anda telah selesai. Retur baru tidak tersedia untuk pesanan ini; jika butuh bantuan, hubungi kami melalui WhatsApp.');
        }

        // 6. Fulfillment/shipping normal
        return $this->primaryByShipping($shipping);
    }

    private function primaryByShipping(string $shipping): array
    {
        $isCod = $this->isCod();

        return match ($shipping) {
            // Resi ada tapi belum ada scan carrier = menunggu penjemputan kurir.
            'waybill_created' => $this->mk('awaiting_pickup', 'Menunggu penjemputan kurir', 'info',
                'Menunggu penjemputan kurir',
                'Resi telah dibuat dan paket menunggu dijemput atau diterima kurir.',
                $this->shipping?->last_status_at?->toIso8601String()),
            // Carrier menerima paket (pickup/scan) = pesanan DITERIMA kurir.
            'picked_up' => $this->mk('shipped', 'Pesanan dikirim', 'info',
                'Pesanan dikirim',
                'Paket telah diterima kurir dan akan segera diproses untuk pengiriman.',
                $this->shipping?->last_status_at?->toIso8601String()),
            'in_transit' => $this->mk('in_transit', 'Paket dalam perjalanan', 'info',
                'Paket dalam perjalanan',
                'Paket sedang dalam perjalanan ke wilayah tujuan.',
                $this->shipping?->last_status_at?->toIso8601String()),
            'out_for_delivery' => $this->mk('out_for_delivery', 'Paket sedang diantar', 'info',
                'Paket sedang diantar',
                'Kurir sedang mengantar paket ke alamat tujuan Anda.',
                $this->shipping?->last_status_at?->toIso8601String()),
            'delivered' => $this->mk('delivered', 'Sampai', 'success',
                'Sampai',
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

        // Order sedang diproses admin (belum resi) -> fase siap dikirim (kontrak A
        // & skenario 3/10): judul 'Pesanan siap dikirim', posisi paket menyatakan
        // masih menunggu diserahkan ke kurir (tidak mengklaim sudah dikirim).
        if ($status === 'processing') {
            return $this->mk('ready_to_ship', 'Menyiapkan', 'info',
                'Menyiapkan',
                'Tim kami sedang menyiapkan pesanan Anda.');
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
            unset($paymentStep['occurredAt']); // belum terjadi: tanpa timestamp palsu

            return [$orderMade, $paymentStep];
        }
        if ($payment === 'pending_verification' && ! $isCod) {
            $paymentStep['state'] = 'current';
            $paymentStep['label'] = 'Pembayaran sedang diverifikasi';
            unset($paymentStep['occurredAt']);

            return [$orderMade, $paymentStep];
        }

        // Status order sebelum processing (COD belum di-proses / transfer belum lanjut)
        if ($isCod && in_array($status, ['awaiting_confirmation'], true)) {
            $paymentStep['state'] = 'current';
            $paymentStep['label'] = 'Menunggu konfirmasi';
            unset($paymentStep['occurredAt']);

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
            ['key' => 'delivered', 'label' => 'Sampai', 'state' => 'upcoming'],
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
            'city' => (string) $this->order->shipping_city,
            'province' => (string) $this->order->shipping_province,
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

    /**
     * Blok pengiriman (kontrak sinkronisasi status UI pelanggan).
     *
     * @return array{hasWaybill:bool,waybill:string|null,carrierName:string|null,statusKey:string,label:string,location:string|null,latestEventText:string|null,latestEventAt:string|null,syncedAt:string|null,trackingAvailable:bool,stale:bool}
     */
    public function shipment(): array
    {
        $shipping = $this->shipping;
        $hasWaybill = $shipping !== null && filled($shipping->waybill_number);
        $statusKey = $this->normalizedShippingStatus();

        $latestEvent = null;
        if ($shipping !== null) {
            $latestEvent = $shipping->trackingEvents()
                ->orderByDesc('occurred_at')
                ->orderByDesc('id')
                ->first();
        }

        // Stale: pengiriman aktif (belum terminal) tanpa sinkronisasi > 2 jam.
        $stale = false;
        if ($hasWaybill && ! in_array($statusKey, ['delivered', 'exception', 'returned'], true)) {
            $synced = $shipping->updated_at;
            $stale = $synced === null || $synced->lt(now()->subMinutes(120));
        }

        return [
            'hasWaybill' => $hasWaybill,
            'waybill' => $hasWaybill ? (string) $shipping->waybill_number : null,
            'carrierName' => $hasWaybill ? (string) $shipping->carrier_name : null,
            'statusKey' => $statusKey,
            'label' => $this->shipmentLabel($statusKey, $hasWaybill),
            // URL resmi terverifikasi dari integrasi (jet.co.id/track/trace?waybill=...).
            'officialTrackingUrl' => $hasWaybill
                ? ($shipping->tracking_url ?: 'https://www.jet.co.id/track/trace?waybill='.rawurlencode((string) $shipping->waybill_number))
                : null,
            'location' => $latestEvent?->location,
            'latestEventText' => $latestEvent?->description,
            'latestEventAt' => $latestEvent?->occurred_at?->utc()->toIso8601String()
                ?? $shipping?->last_status_at?->utc()->toIso8601String(),
            'syncedAt' => $shipping?->updated_at?->utc()->toIso8601String(),
            'trackingAvailable' => $shipping !== null && $shipping->trackingEvents()->exists(),
            'stale' => $stale,
        ];
    }

    private function shipmentLabel(string $statusKey, bool $hasWaybill): string
    {
        if (! $hasWaybill) {
            return 'Belum diserahkan ke kurir';
        }

        return match ($statusKey) {
            'waybill_created' => 'Menunggu dijemput atau diterima kurir',
            'picked_up' => 'Paket diterima kurir',
            'in_transit' => 'Paket dalam perjalanan',
            'out_for_delivery' => 'Paket sedang diantar',
            'delivered' => 'Paket telah diterima di tujuan',
            'exception' => 'Pengiriman perlu perhatian',
            'returned' => 'Paket dikembalikan ke pengirim',
            default => 'Informasi posisi paket belum tersedia',
        };
    }

    /**
     * Status customer tunggal (title+description) dari kontrak banner.
     *
     * @return array{key:string,title:string,description:string,stage:string}
     */
    public function customerStatus(): array
    {
        $primary = $this->primaryStatus();
        $key = (string) $primary['key'];
        $status = $this->orderStatus();
        $shipping = $this->normalizedShippingStatus();
        $payment = $this->paymentStatus();

        $stage = match (true) {
            in_array($status, ['cancelled', 'issue', 'return_in_process', 'return_completed'], true) => 'attention',
            $status === 'completed' => 'completed',
            $payment === 'unpaid' && ! $this->isCod() => 'payment',
            $payment === 'pending_verification' && ! $this->isCod() => 'verification',
            $status === 'awaiting_confirmation' => 'confirmed',
            $shipping === 'not_shipped' => 'preparing',
            $shipping === 'waybill_created' => 'awaiting_pickup',
            $shipping === 'picked_up' => 'shipped',
            $shipping === 'in_transit' => 'transit',
            $shipping === 'out_for_delivery' => 'last_mile',
            $shipping === 'delivered' => 'delivered',
            in_array($shipping, ['exception', 'delivery_failed', 'returned'], true) => 'attention',
            default => 'preparing',
        };

        $position = $this->position();
        $shipment = $this->shipment();
        $term = in_array($status, ['cancelled', 'issue', 'return_in_process', 'return_completed'], true);
        $attention = $term || in_array($shipping, ['exception', 'delivery_failed', 'returned'], true);

        // Source: toko (belum ada event carrier) vs carrier (event carrier) vs system (fallback).
        if ($attention) {
            $source = $term ? 'store' : 'carrier';
        } elseif (in_array($shipping, ['picked_up', 'in_transit', 'out_for_delivery', 'delivered'], true)) {
            $source = 'carrier';
        } else {
            $source = 'store';
        }

        $eventAt = $source === 'carrier'
            ? ($shipment['latestEventAt'] ?? $shipment['syncedAt'])
            : $this->order->updated_at?->toIso8601String();

        return [
            'key' => $key,
            'title' => (string) $primary['headline'],
            'description' => (string) $primary['message'],
            'position' => $position['text'],
            'source' => $source,
            'eventAt' => $eventAt,
            'syncedAt' => $shipment['syncedAt'],
            'stale' => (bool) $shipment['stale'],
            'attention' => $attention,
            'stage' => $stage,
        ];
    }

    /**
     * StatusSummary 4 makro stabil (kontrak): Dikonfirmasi -> Disiapkan ->
     * Dikirim -> Selesai. State dihitung dari progress() (satu mapper).
     *
     * @return array{steps: list<array{key:string,label:string,state:string,icon:string}>}
     */
    public function summary(): array
    {
        $progress = collect($this->progress())->keyBy('key');
        $state = static fn (string $key): string => (string) ($progress[$key]['state'] ?? 'upcoming');

        $status = $this->orderStatus();

        // Dikonfirmasi: current saat menunggu (belum tervalidasi), completed setelahnya.
        $confirmation = $state('confirmed') === 'current' ? 'current' : 'completed';

        // Disiapkan: current saat preparing/ready/waybill; completed bila carrier
        // benar-benar menerima (handover completed/current).
        $fulfillment = match (true) {
            $state('handover') === 'completed' || $state('handover') === 'current' => 'completed',
            $state('prepared') === 'current' || $status === 'awaiting_confirmation' && $confirmation === 'completed' => 'current',
            default => 'upcoming',
        };
        if ($status === 'awaiting_confirmation' && $confirmation === 'current') {
            $fulfillment = 'upcoming';
        }

        // Dikirim: current sejak carrier menerima sampai delivered; completed saat delivered.
        $shipping = match (true) {
            $state('delivered') === 'completed' || $state('delivered') === 'current' => 'completed',
            in_array($state('handover'), ['current', 'completed'])
                || in_array($state('transit'), ['current', 'completed'])
                || in_array($state('last_mile'), ['current', 'completed']) => 'current',
            default => 'upcoming',
        };

        // Selesai: current saat delivered (menunggu completion); completed saat order completed.
        $completion = match (true) {
            $status === 'completed' => 'completed',
            $state('delivered') === 'current' || $state('delivered') === 'completed' => 'current',
            default => 'upcoming',
        };

        // TEXT adaptif per substate (keputusan owner 2026-08-25):
        // menunggu pembayaran (transfer) / menunggu konfirmasi / menyiapkan /
        // dikirim / sampai / selesai. State completed memakai kata dasar.
        // Sinkron: label step tunggal "Menunggu konfirmasi" utk semua state menunggu
        // (transfer & COD); status pembayaran ditampilkan di teks Metode Pembayaran.
        $confirmationLabel = $confirmation === 'current' ? 'Menunggu konfirmasi' : 'Dikonfirmasi';
        $fulfillmentLabel = $fulfillment === 'current' ? 'Menyiapkan' : 'Disiapkan';
        $shippingLabel = match (true) {
            $shipping === 'completed' => 'Sampai',
            default => 'Dikirim',
        };

        // Ikon adaptif: menunggu pembayaran = credit-card, menunggu konfirmasi = clock,
        // menyiapkan = package, dikirim = truck, selesai = check-circle.
        $confirmationIcon = $confirmation === 'completed' ? 'check-circle' : 'clock';
        $fulfillmentIcon = $fulfillment === 'completed' ? 'check-circle' : 'package';
        $shippingIcon = $shipping === 'completed' ? 'check-circle' : 'truck';
        $completionIcon = $completion === 'completed' ? 'check-circle' : 'check-circle';

        $steps = [
            ['key' => 'confirmation', 'label' => $confirmationLabel, 'state' => $confirmation, 'icon' => $confirmationIcon],
            ['key' => 'fulfillment', 'label' => $fulfillmentLabel, 'state' => $fulfillment, 'icon' => $fulfillmentIcon],
            ['key' => 'shipping', 'label' => $shippingLabel, 'state' => $shipping, 'icon' => $shippingIcon],
            ['key' => 'completion', 'label' => 'Selesai', 'state' => $completion, 'icon' => $completionIcon],
        ];

        // Exception carrier (kontrak 8.4): makro Dikirim = attention.
        if (in_array($this->normalizedShippingStatus(), ['exception', 'delivery_failed', 'returned'], true)) {
            foreach ($steps as &$st) {
                if ($st['key'] === 'shipping') {
                    $st['state'] = 'attention';
                }
            }
            unset($st);
        } elseif (in_array($status, ['cancelled', 'issue', 'return_in_process', 'return_completed'], true)) {
            // Terminal order: tandai makro terakhir yang tercapai = attention.
            $lastActive = null;
            foreach (array_reverse($steps) as $st) {
                if (in_array($st['state'], ['completed', 'current'], true)) {
                    $lastActive = $st['key'];
                    break;
                }
            }
            foreach ($steps as &$st) {
                if ($st['key'] === $lastActive) {
                    $st['state'] = 'attention';
                } elseif ($st['state'] !== 'completed') {
                    $st['state'] = 'upcoming';
                }
            }
            unset($st);
        }

        return ['steps' => $steps];
    }

    /**
     * Kartu "Posisi paket saat ini" (kontrak B), tanpa mengarang lokasi.
     *
     * @return array{stateKey:string,text:string,description:string,latestEventAt:string|null,syncedAt:string|null,stale:bool}
     */
    public function position(): array
    {
        $shipment = $this->shipment();
        $statusKey = (string) $shipment['statusKey'];
        $stale = (bool) $shipment['stale'];

        [$stateKey, $text, $description] = match ($statusKey) {
            'waybill_created' => [
                'awaiting_pickup',
                'Menunggu dijemput atau diterima kurir',
                'Resi telah dibuat. Paket menunggu dijemput atau diterima kurir.',
            ],
            'picked_up' => ['picked_up', 'Paket diterima kurir', 'Kurir telah menerima paket dan akan segera memprosesnya untuk pengiriman.'],
            'in_transit' => $shipment['location'] !== null
                ? ['in_transit', 'Paket berada di '.$shipment['location'], 'Paket sedang dalam perjalanan ke wilayah tujuan.']
                : ['in_transit', 'Paket dalam perjalanan', 'Paket sedang dalam perjalanan ke wilayah tujuan.'],
            'out_for_delivery' => ['out_for_delivery', 'Paket sedang dibawa kurir ke alamat tujuan', 'Kurir sedang mengantar paket ke alamat Anda.'],
            'delivered' => ['delivered', 'Paket telah diterima di tujuan', 'Paket tercatat telah diterima.'],
            'exception' => ['exception', 'Pengiriman perlu perhatian', 'Ada pembaruan pengiriman yang memerlukan tindak lanjut. Hubungi kami bila perlu.'],
            'returned' => ['returned', 'Paket dikembalikan ke pengirim', 'Pengiriman tidak dapat diselesaikan. Tim kami akan menghubungi Anda.'],
            default => ['not_shipped', 'Belum diserahkan ke kurir', 'Paket masih berada di proses toko dan belum dititipkan ke kurir.'],
        };

        if ($stale && ! in_array($statusKey, ['delivered', 'exception', 'returned'], true)) {
            $description = 'Pembaruan pengiriman terakhir belum tersedia. Timestamp di bawah adalah waktu sinkronisasi data, bukan kejadian fisik paket.';
        }

        return [
            'stateKey' => $stateKey,
            'text' => $text,
            'description' => $description,
            'latestEventAt' => $shipment['latestEventAt'],
            'syncedAt' => $shipment['syncedAt'],
            'stale' => $stale,
        ];
    }

    /**
     * Progress tracker 7 tahap customer-facing (kontrak C), satu sumber.
     *
     * @return list<array{key:string,label:string,state:string,occurredAt?:string}>
     */
    public function progress(): array
    {
        $status = $this->orderStatus();
        $milestones = $this->milestones();

        $keyMap = [
            'order_created' => ['confirmed', 'Pesanan dikonfirmasi'],
            'payment_verified' => ['confirmed', 'Pesanan dikonfirmasi'],
            'order_confirmed' => ['confirmed', 'Pesanan dikonfirmasi'],
            'ready_to_ship' => ['prepared', 'Pesanan disiapkan'],
            'handover_to_carrier' => ['handover', 'Diserahkan ke kurir'],
            'in_transit' => ['transit', 'Dalam perjalanan'],
            'out_for_delivery' => ['last_mile', 'Sedang diantar'],
            'delivered' => ['delivered', 'Terkirim'],
        ];

        $seen = [];
        $steps = [];
        foreach ($milestones as $m) {
            if (! isset($keyMap[$m['key']])) {
                continue;
            }
            [$key, $label] = $keyMap[$m['key']];
            $state = (string) ($m['state'] ?? 'upcoming');
            if (isset($seen[$key])) {
                // Duplikat confirmed (order_created + payment/order_confirmed):
                // state 'current' lebih bermakna daripada 'completed' (menunggu aksi).
                if ($state === 'current') {
                    foreach ($steps as &$existing) {
                        if ($existing['key'] === $key) {
                            $existing['state'] = 'current';
                        }
                    }
                    unset($existing);
                }
                continue;
            }
            $seen[$key] = true;
            $step = [
                'key' => $key,
                'label' => $label,
                'state' => $state,
            ];
            if (! empty($m['occurredAt'])) {
                $step['occurredAt'] = (string) $m['occurredAt'];
            }
            $steps[] = $step;
        }

        // Tahap akhir Selesai hanya saat order benar-benar completed.
        $steps[] = [
            'key' => 'completed',
            'label' => 'Selesai',
            'state' => $status === 'completed' ? 'completed' : 'upcoming',
        ];

        // Terminal (cancelled/issue/return): tahap terakhir yang pernah tercapai
        // ditandai 'attention' (masalah di situ), sisanya upcoming. Pelanggan melihat
        // titik gagal di-highlight, bukan semua langkah jadi abu-abu.
        if (in_array($status, ['cancelled', 'issue', 'return_in_process', 'return_completed'], true)) {
            $lastReached = null;
            foreach (array_reverse($steps) as $st) {
                if (in_array($st['state'], ['completed', 'current', 'attention'], true)) {
                    $lastReached = $st['key'];
                    break;
                }
            }
            foreach ($steps as &$step) {
                $step['state'] = $step['key'] === $lastReached ? 'attention' : 'upcoming';
            }
            unset($step);
        }

        return $steps;
    }

    /**
     * Translation matrix customer-facing (revisi final 20): satu-satunya sumber
     * label + posisi + sumber utk timeline. RAW event J&T TIDAK pernah muncul.
     */
    private const EVENT_TRANSLATION = [
        'order_created' => ['label' => 'Pesanan dibuat', 'position' => 'Pesanan diterima oleh toko.', 'source' => 'store'],
        'order_confirmed' => ['label' => 'Pesanan dikonfirmasi', 'position' => 'Pesanan dikonfirmasi oleh toko.', 'source' => 'store'],
        'payment_verified' => ['label' => 'Pembayaran dikonfirmasi', 'position' => 'Pembayaran telah dikonfirmasi.', 'source' => 'store'],
        'ready_to_ship' => ['label' => 'Pesanan siap dikirim', 'position' => 'Paket sudah siap dan menunggu diserahkan ke kurir.', 'source' => 'store'],
        'waybill_created' => ['label' => 'Resi pengiriman dibuat', 'position' => 'Resi telah dibuat; paket menunggu dijemput kurir.', 'source' => 'store'],
        'picked_up' => ['label' => 'Paket diterima kurir', 'position' => 'Paket telah diterima oleh J&T Cargo.', 'source' => 'carrier'],
        'in_transit' => ['label' => 'Paket dalam perjalanan', 'position' => 'Paket sedang dalam perjalanan ke wilayah tujuan.', 'source' => 'carrier'],
        'arrived_destination_hub' => ['label' => 'Paket tiba di wilayah tujuan', 'position' => 'Paket telah tiba di wilayah tujuan.', 'source' => 'carrier'],
        'out_for_delivery' => ['label' => 'Paket sedang diantar', 'position' => 'Kurir sedang mengantar paket ke alamat Anda.', 'source' => 'carrier'],
        'delivered' => ['label' => 'Sampai', 'position' => 'Paket tercatat telah diterima di tujuan.', 'source' => 'carrier'],
        'completed' => ['label' => 'Pesanan selesai', 'position' => 'Pesanan telah selesai. Terima kasih telah berbelanja.', 'source' => 'store'],
        'delivery_failed' => ['label' => 'Pengantaran belum berhasil', 'position' => 'Kurir belum berhasil mengantar paket.', 'source' => 'carrier'],
        'delivery_exception' => ['label' => 'Kendala pengiriman', 'position' => 'Ada kendala dalam pengiriman paket.', 'source' => 'carrier'],
        'returned_to_sender' => ['label' => 'Paket dikembalikan ke toko', 'position' => 'Paket sedang dikembalikan kepada toko.', 'source' => 'carrier'],
        'cancelled_shipment' => ['label' => 'Pengiriman dibatalkan', 'position' => 'Pengiriman dibatalkan; tim kami akan menghubungi Anda.', 'source' => 'carrier'],
        'cancelled' => ['label' => 'Pesanan dibatalkan', 'position' => 'Pesanan telah dibatalkan.', 'source' => 'store'],
        'return_in_process' => ['label' => 'Retur sedang diproses', 'position' => 'Tim kami sedang menangani retur.', 'source' => 'store'],
        'return_completed' => ['label' => 'Retur selesai', 'position' => 'Proses retur telah selesai.', 'source' => 'store'],
    ];

    /**
     * Timeline event penting yang SUDAH TERJADI, diterjemahkan (revisi final 9-15).
     * Store steps dari milestones (completed/current) + carrier events canonical
     * (dedupe per key, ambil yang terakhir). Tidak pernah menampilkan raw text.
     *
     * @return list<array{key:string,label:string,at:string,position:string,source:string}>
     */
    public function events(): array
    {
        $events = [];

        // 1. Store milestones yang SUDAH TERJADI (completed saja; milestone
        // 'current' belum terjadi dan dirender sebagai satu item akhir).
        // HANYA tahap source=store: tahap carrier (in_transit/out_for_delivery/
        // delivered) tidak boleh diambil dari milestones karena timestamp-nya
        // tidak ada (createdAt = palsu) dan duplikat dgn event carrier asli.
        foreach ($this->milestones() as $m) {
            if (($m['state'] ?? '') !== 'completed') {
                continue;
            }
            $key = (string) ($m['key'] ?? '');
            $t = self::EVENT_TRANSLATION[$key] ?? null;
            if ($t === null || $t['source'] !== 'store') {
                continue;
            }
            // occurredAt hanya tersedia utk order_created (tahap store lain tidak
            // menyimpan waktu kejadian). Tanpa timestamp nyata, tahap itu TIDAK
            // masuk timeline (jangan karang now()/created_at); state saat ini
            // tetap diwakili item 'current' di akhir.
            if (empty($m['occurredAt'])) {
                continue;
            }
            $events[$key] = [
                'key' => $key,
                'label' => $t['label'],
                'at' => \Illuminate\Support\Carbon::parse($m['occurredAt'])->utc()->toIso8601String(),
                'position' => $t['position'],
                'source' => $t['source'],
                'detail' => null,
            ];
        }

        // 2. Status terminal order (cancelled/issue/return) sebagai store event.
        $status = $this->orderStatus();
        if (in_array($status, ['cancelled', 'return_in_process', 'return_completed'], true)) {
            $key = $status === 'cancelled' ? 'cancelled' : $status;
            $t = self::EVENT_TRANSLATION[$key] ?? null;
            if ($t !== null) {
                $events[$key] = [
                    'key' => $key,
                    'label' => $t['label'],
                    'at' => $this->order->updated_at?->utc()->toIso8601String() ?? now()->utc()->toIso8601String(),
                    'position' => $t['position'],
                    'source' => $t['source'],
                    'detail' => null,
                ];
            }
        }

        // 3. Carrier events canonical (dedupe per key, ambil terakhir).
        $shipping = $this->shipping;
        if ($shipping !== null) {
            $carrier = $shipping->trackingEvents()
                ->orderByDesc('occurred_at')->orderByDesc('id')
                ->get();
            $seen = [];
            foreach ($carrier as $ev) {
                $canonical = (string) ($ev->normalized_status ?? '');
                if ($canonical === '' || isset($seen[$canonical])) {
                    continue;
                }
                $seen[$canonical] = true;
                $t = self::EVENT_TRANSLATION[$canonical] ?? null;
                if ($t === null) {
                    continue;
                }
                $detail = JntEventDetail::parse($ev->description);
                $events[$canonical] = [
                    'key' => $canonical,
                    'label' => $t['label'],
                    'at' => ($ev->occurred_at?->utc()->toIso8601String())
                        ?? $shipping->last_status_at?->utc()->toIso8601String()
                        ?? now()->utc()->toIso8601String(),
                    'position' => $t['position'],
                    'source' => $t['source'],
                    'detail' => $detail,
                ];
            }
        }

        // Urutkan kronologis; stable by at.
        $sorted = array_values($events);
        usort($sorted, static fn (array $a, array $b): int => strcmp((string) $a['at'], (string) $b['at']));

        // Origin rute: lokasi dari event carrier sebelumnya (kota sebelumnya).
        foreach ($sorted as $i => &$ev) {
            if (($ev['detail']['destination'] ?? null) === null || $i === 0) {
                continue;
            }
            $prev = $sorted[$i - 1];
            if (($prev['source'] ?? '') === 'carrier' && ($prev['detail']['location'] ?? null) !== null) {
                $ev['detail']['origin'] = $prev['detail']['location'];
            }
        }
        unset($ev);

        // State saat ini (milestone current atau status lanjutan): satu item
        // terakhir dgn label & posisi dari customerStatus (tidak pernah
        // menerjemahkan event yang belum terjadi). Skip bila item terakhir
        // sudah mewakili state yang sama (dedupe canonical, bukan label).
        $current = $this->customerStatus();
        $stageKey = match ((string) ($current['stage'] ?? '')) {
            'payment', 'verification', 'confirmed' => 'order_confirmed',
            'preparing' => 'ready_to_ship',
            'awaiting_pickup' => 'waybill_created',
            'shipped' => 'picked_up',
            'transit' => 'in_transit',
            'last_mile' => 'out_for_delivery',
            'delivered' => 'delivered',
            'completed' => 'completed',
            default => null,
        };
        $lastKey = $sorted[count($sorted) - 1]['key'] ?? '';
        if ($stageKey !== null && $stageKey !== $lastKey && ! empty($current['title'])) {
            // State saat ini di-end: clamp timestamp ke event valid terakhir bila
            // lebih awal (hindari urutan turun di UI; tidak mengarang waktu).
            $lastAt = $sorted[count($sorted) - 1]['at'] ?? null;
            $currentAt = (string) ($current['eventAt'] ?? now()->toIso8601String());
            if (is_string($lastAt) && $currentAt < $lastAt) {
                $currentAt = $lastAt;
            }
            $lastEvent = $sorted === [] ? null : $sorted[count($sorted) - 1];
            $sorted[] = [
                'key' => 'current',
                'label' => (string) $current['title'],
                'at' => $currentAt,
                'position' => (string) ($current['position'] ?? ''),
                'source' => (string) $current['source'],
                'detail' => ($lastEvent['detail'] ?? null) !== null ? $lastEvent['detail'] : null,
            ];
        }

        return $sorted;
    }

    /** Ekspos objek view model penuh untuk payload. @return array<string,mixed> */
    public function toArray(): array
    {
        return [
            'primaryStatus' => $this->primaryStatus(),
            'actionRequired' => $this->actionRequired(),
            'milestones' => $this->milestones(),
            'shipment' => $this->shipment(),
            'customerStatus' => $this->customerStatus(),
            'summary' => $this->summary(),
            'position' => $this->position(),
            'progress' => $this->progress(),
            'events' => $this->events(),
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