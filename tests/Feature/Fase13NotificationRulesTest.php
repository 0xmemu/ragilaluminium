<?php

namespace Tests\Feature;

use App\Models\AdminNotification;
use App\Models\ImportJob;
use App\Models\MediaAsset;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Support\ImportFailureNotifier;
use App\Support\MediaFailureNotifier;
use App\Support\ShippingQuoteManualReviewNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesVisibleProducts;
use Tests\TestCase;

class Fase13NotificationRulesTest extends TestCase
{
    use RefreshDatabase;
    use CreatesVisibleProducts;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    public function test_media_failure_creates_admin_notification(): void
    {
        $asset = MediaAsset::create([
            'kind' => 'image',
            'label' => 'Gagal media',
            'checksum' => hash('sha256', 'fail-media'),
            'object_key' => 'media-assets/fail-media/card.webp',
            'status' => 'failed',
            'visibility' => 'visible',
        ]);

        MediaFailureNotifier::notify($asset, 'Ukuran file melebihi batas.');

        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'media_failed',
            'related_type' => MediaAsset::class,
            'related_id' => $asset->id,
        ]);
    }

    public function test_import_failure_creates_admin_notification(): void
    {
        $job = ImportJob::create([
            'type' => 'internal_bulk_update',
            'source_file_name' => 'catalog.xlsx',
            'source_file_path' => 'catalog/catalog.xlsx',
            'status' => 'failed',
        ]);

        ImportFailureNotifier::notify($job->id, 'Berkas rusak.');

        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'import_failed',
            'related_type' => ImportJob::class,
            'related_id' => $job->id,
        ]);
    }

    public function test_import_failure_notifier_dedupes_unread_notifications(): void
    {
        $job = ImportJob::create([
            'type' => 'internal_bulk_update',
            'source_file_name' => 'catalog.xlsx',
            'source_file_path' => 'catalog/catalog.xlsx',
            'status' => 'failed',
        ]);

        ImportFailureNotifier::notify($job->id, 'Berkas rusak.');
        ImportFailureNotifier::notify($job->id, 'Berkas rusak lagi.');

        $this->assertSame(1, AdminNotification::where('type', 'import_failed')
            ->where('related_type', ImportJob::class)
            ->where('related_id', $job->id)
            ->whereNull('read_at')
            ->count());
    }

    public function test_shipping_quote_manual_review_creates_admin_notification(): void
    {
        $order = Order::create([
            'order_number' => 'ORD-QT-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        ShippingQuoteManualReviewNotifier::notify($order, ['net' => 45000]);

        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'shipping_quote_manual_review',
            'related_type' => Order::class,
            'related_id' => $order->id,
        ]);
    }

    public function test_return_creation_notifies_admin(): void
    {
        $admin = $this->admin();
        $product = $this->createVisibleProduct();
        $variant = $product->variants()->first();

        $order = Order::create([
            'order_number' => 'ORD-RT-'.strtoupper(uniqid()),
            'customer_name' => 'Budi',
            'customer_phone' => '628123456789',
            'shipping_address_line1' => 'Jl. Uji 1',
            'shipping_city' => 'Bandung',
            'shipping_province' => 'Jawa Barat',
            'shipping_postal_code' => '40111',
            'order_status' => 'delivered',
            'payment_status' => 'paid',
            'shipping_status' => 'delivered',
            'subtotal_amount' => 100000,
            'shipping_amount' => 10000,
            'discount_amount' => 0,
            'total_amount' => 110000,
            'payment_method' => 'transfer',
            'cod_flag' => false,
        ]);

        $item = OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'parent_sku' => $product->parent_sku,
            'variant_sku' => $variant->variant_sku,
            'name' => $product->name,
            'unit_price' => 100000,
            'quantity' => 2,
            'line_subtotal' => 200000,
            'line_discount' => 0,
            'line_total' => 200000,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.orders.returns.store', $order), [
                'reason' => 'cacat produksi',
                'customer_notes' => 'barang rusak',
                'resolution_type' => 'refund',
                'refund_amount' => 100000,
                'items' => [[
                    'order_item_id' => $item->id,
                    'requested_quantity' => 1,
                ]],
            ])
            ->assertRedirect(route('admin.orders.show', $order));

        $this->assertDatabaseHas('admin_notifications', [
            'type' => 'return_created',
            'related_type' => Order::class,
            'related_id' => $order->id,
        ]);
        $this->assertSame('return_in_process', $order->fresh()->order_status);
    }
}
