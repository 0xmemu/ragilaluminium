<?php

namespace Tests\Feature;

use App\Support\OrderStatusView;
use PHPUnit\Framework\TestCase as BaseTestCase;

class OrderStatusViewTest extends BaseTestCase
{
    private function order(array $overrides = []): object
    {
        return (object) array_merge([
            'payment_status' => 'pending',
            'cod_flag' => false,
            'payment_method' => 'transfer',
            'order_status' => 'awaiting_confirmation',
        ], $overrides);
    }

    public function test_paid_maps_to_lunas(): void
    {
        $this->assertSame('Lunas', OrderStatusView::paymentLabel($this->order(['payment_status' => 'paid'])));
        $this->assertSame(OrderStatusView::BUCKET_PAID, OrderStatusView::paymentBucket($this->order(['payment_status' => 'paid'])));
    }

    public function test_transfer_pending_in_awaiting_is_unpaid(): void
    {
        $this->assertSame('Menunggu pembayaran', OrderStatusView::paymentLabel($this->order()));
        $this->assertSame(OrderStatusView::BUCKET_TRANSFER_UNPAID, OrderStatusView::paymentBucket($this->order()));
    }

    public function test_cod_pending_is_cod_not_unpaid(): void
    {
        $this->assertSame('COD, bayar saat barang diterima', OrderStatusView::paymentLabel($this->order(['cod_flag' => true, 'payment_method' => 'cod'])));
        $this->assertSame(OrderStatusView::BUCKET_COD_PENDING, OrderStatusView::paymentBucket($this->order(['cod_flag' => true, 'payment_method' => 'cod'])));
    }

    public function test_cancelled_is_not_shown_as_active_payment(): void
    {
        $this->assertSame(OrderStatusView::BUCKET_NEED_REVIEW, OrderStatusView::paymentBucket($this->order(['cod_flag' => true, 'order_status' => 'cancelled'])));
        $this->assertSame('Perlu ditinjau', OrderStatusView::paymentLabel($this->order(['cod_flag' => true, 'order_status' => 'cancelled'])));
    }

    public function test_ambiguous_transfer_pending_after_processing_needs_review(): void
    {
        $this->assertSame(OrderStatusView::BUCKET_NEED_REVIEW, OrderStatusView::paymentBucket($this->order(['order_status' => 'processing'])));
        $this->assertSame('Perlu ditinjau', OrderStatusView::paymentLabel($this->order(['order_status' => 'processing'])));
    }
}