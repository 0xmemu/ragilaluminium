# Arsip Fitur: Konfirmasi Otomatis Pesanan COD via Balasan WhatsApp Pelanggan
## Status: NONAKTIF / DIARSIPKAN (Diubah Menjadi Fully Manual oleh Admin per 09 September 2026)

- **Tanggal Arsip:** 09 September 2026
- **Alasan Pengarsipan:** Keputusan pemilik toko untuk menonaktifkan transisi otomatis dan menerapkan alur verifikasi pesanan 100% manual oleh Admin sebelum pesanan diproses gudang.
- **Lokasi Kode Terkait:**
  - `app/Services/WhatsAppService.php` (`handleInboundCustomerAction`, `isOrderConfirmation`, `matchesConfirmationPhrase`)
  - `app/Services/OrderService.php` (`beginProcessing`)
  - `tests/Feature/WhatsAppCustomerConfirmTest.php`

---

## 1. Logika Asli yang Pernah Berjalan

Sebelum dinonaktifkan, alur kerja fitur ini adalah:
1. Pelanggan melakukan checkout dengan metode COD di website (`order_status = 'awaiting_confirmation'`).
2. Gateway WhatsApp mengirim pesan notifikasi pesanan ke nomor pembeli (`order_created`).
3. Pembeli membalas pesan WhatsApp dengan teks persetujuan (seperti "YA", "Oke", "Konfirmasi", "Setuju", "Proses Pesanan") atau menekan tombol interaktif di WhatsApp.
4. Gateway Baileys menangkap pesan masuk dan mengirim webhook ke `/webhook/whatsapp/baileys`.
5. `WhatsAppService::handleInboundCustomerAction()` mendeteksi frasa konfirmasi, mencocokkan nomor telepon dengan pesanan berstatus `awaiting_confirmation`, dan memanggil `OrderService::beginProcessing($order, null, 'whatsapp_customer')`.
6. Status pesanan otomatis berpindah dari `awaiting_confirmation` ke `processing` dengan event log tercatat `source = 'whatsapp_customer'`.

---

## 2. Salinan Kode Asli (Original Implementation Snippet)

### A. `app/Services/WhatsAppService.php`
```php
    /**
     * Tombol / balasan konfirmasi COD -> pending -> processing + WA "pesanan diproses".
     *
     * @param  array<string, mixed>  $msg
     */
    protected function handleInboundCustomerAction(WhatsAppMessage $message, array $msg, ?string $phone): void
    {
        if (! $this->isOrderConfirmation($msg, $message->content_text)) {
            return;
        }

        $order = $this->resolveOrderForInbound($phone, $msg);
        if (! $order) {
            Log::info('WhatsApp confirm: no pending order for phone', ['phone' => $phone]);

            return;
        }

        $message->update(['order_id' => $order->id]);

        $started = $this->orders->beginProcessing($order, null, 'whatsapp_customer');
        if (! $started) {
            Log::info('WhatsApp confirm: order not started', [
                'order_id' => $order->id,
                'status' => $order->fresh()?->order_status,
            ]);
        }
    }
```

### B. `app/Services/OrderService.php`
```php
    public function beginProcessing(Order $order, ?int $actorUserId = null, string $source = 'admin'): bool
    {
        $order = $order->fresh() ?? $order;

        if ($order->order_status !== 'awaiting_confirmation') {
            return false;
        }

        $isCod = $order->cod_flag || $order->payment_method === 'cod';

        // Konfirmasi pelanggan via WA hanya untuk COD, transfer butuh bukti bayar.
        if ($source === 'whatsapp_customer' && ! $isCod) {
            return false;
        }

        $changed = $this->states->transition(
            $order,
            'processing',
            $actorUserId,
            $source,
            ['flow' => $isCod ? 'cod' : 'transfer'],
        );

        if (! $changed) {
            return false;
        }

        OrderProcessingStarted::dispatch($order->fresh(), $source);

        return true;
    }
```

---

## 3. Cara Mengaktifkan Kembali di Masa Mendatang

Jika pemilik toko di masa depan memutuskan untuk mengaktifkan kembali konfirmasi COD otomatis via WhatsApp:
1. Pada `app/Services/WhatsAppService.php`, aktifkan kembali pemanggilan `$this->orders->beginProcessing($order, null, 'whatsapp_customer')` di dalam `handleInboundCustomerAction()`.
2. Pada `app/Services/OrderService.php`, izinkan kembali `$source === 'whatsapp_customer'` untuk pesanan berstatus COD (`$isCod`).
3. Pada `tests/Feature/WhatsAppCustomerConfirmTest.php`, kembalikan assertion `$this->assertSame('processing', $order->order_status)`.
