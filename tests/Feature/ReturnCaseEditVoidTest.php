<?php

namespace Tests\Feature;

use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturnCase;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ReturnCaseAdjustment;
use App\Models\User;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Koreksi (edit), penutupan administratif (void), dan retur manual pesanan
 * Selesai. Instruksi owner 2026-09-28: status workflow tetap terminal, tetapi
 * data kasus boleh dikoreksi dengan jejak audit, kasus selesai tidak pernah
 * dihapus fisik, dan pesanan Selesai bisa dicatat returnya lewat jalur admin
 * khusus dengan alasan pengecualian.
 */
class ReturnCaseEditVoidTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Concerns\TanamEventPengakuan;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeProduct(int $sku, int $stock = 50): Product
    {
        return Product::create([
            'parent_sku' => 'EV-'.$sku,
            'name' => 'Produk '.$sku,
            'category_id' => 1,
            'product_category' => 'JENDELA',
            'product_model' => 'SLIDING',
            'design_variant' => 'POLOS',
            'status' => 'active',
            'stock' => $stock,
        ]);
    }

    private function makeOrder(string $status = 'processing', string $payment = 'paid', float $total = 100000): Order
    {
        $order = Order::create([
            'order_number' => 'EV-'.uniqid(),
            'customer_name' => 'Cust',
            'customer_phone' => '081500000002',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => $status,
            'payment_status' => $payment,
            'shipping_status' => 'delivered',
            'subtotal_amount' => (int) $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => (int) $total,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);

        return $this->tanamEventPengakuan($order);
    }

    private function addItem(Order $order, Product $product, int $qty = 1, int $price = 100000): OrderItem
    {
        return OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'parent_sku' => $product->parent_sku,
            'name' => $product->name,
            'unit_price' => $price,
            'quantity' => $qty,
            'line_subtotal' => $price * $qty,
            'line_discount' => 0,
            'line_total' => $price * $qty,
        ]);
    }

    private function addPaidPayment(Order $order, float $amount): Payment
    {
        return Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => $amount,
            'status' => 'completed',
            'paid_at' => now(),
        ]);
    }

    private function makeCompletedCase(Order $order, OrderItem $item, float $refund = 50000, float $ongkir = 15000): OrderReturnCase
    {
        $case = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'completed',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'resolution_type' => 'refund',
            'refund_amount' => $refund,
            'return_shipping_cost' => $ongkir,
            'completed_at' => now(),
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);
        $case->items()->create([
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 1,
        ]);

        return $case;
    }

    private function makeOpenCase(Order $order, OrderItem $item): OrderReturnCase
    {
        $case = OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'created_by_user_id' => null,
            'updated_by_user_id' => null,
        ]);
        $case->items()->create([
            'order_item_id' => $item->id,
            'requested_quantity' => 1,
            'returned_quantity' => 0,
        ]);

        return $case;
    }

    private function koreksiPayload(array $overrides = []): array
    {
        return array_merge([
            'reason' => 'rusak',
            'customer_notes' => 'catatan pelanggan',
            'fault_party' => 'store',
            'resolution_type' => 'refund',
            'refund_amount' => 50000,
            'return_shipping_cost' => 15000,
            'replacement_amount' => 0,
            'adjustment_reason' => 'Koreksi nominal sesuai bukti transfer',
        ], $overrides);
    }

    // ---------------- Edit kasus retur ----------------

    public function test_koreksi_kasus_selesai_tersimpan_dan_teraudit(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(1);
        $o = $this->makeOrder('return_completed', 'paid');
        $this->addPaidPayment($o, 100000);
        $item = $this->addItem($o, $p);
        $case = $this->makeCompletedCase($o, $item);

        $resp = $this->actingAs($admin)->patch(
            route('admin.orders.returns.update', ['order' => $o, 'returnCase' => $case]),
            $this->koreksiPayload(['refund_amount' => 30000, 'return_shipping_cost' => 20000]),
        );
        $resp->assertSessionHasNoErrors();

        $case->refresh();
        $this->assertSame('30000.00', (string) $case->refund_amount);
        $this->assertSame('20000.00', (string) $case->return_shipping_cost);
        // Status workflow TIDAK berubah.
        $this->assertSame('completed', $case->status);
        $o->refresh();
        $this->assertSame('return_completed', $o->order_status);

        // Jejak audit: satu baris per field yang berubah (termasuk
        // customer_notes yang berubah dari null menjadi catatan).
        $audit = ReturnCaseAdjustment::where('return_case_id', $case->id)->get();
        $this->assertSame(
            ['customer_notes', 'refund_amount', 'return_shipping_cost'],
            $audit->pluck('field')->sort()->values()->all(),
        );
        // Nilai lama/baru disimpan apa adanya sesuai representasi kolom uang.
        $this->assertSame('50000.00', (string) $audit->firstWhere('field', 'refund_amount')->old_value);
        $this->assertSame('30000.00', (string) $audit->firstWhere('field', 'refund_amount')->new_value);
        $this->assertSame('Koreksi nominal sesuai bukti transfer', $audit->firstWhere('field', 'refund_amount')->reason);
        $this->assertSame($admin->id, (int) $audit->firstWhere('field', 'refund_amount')->changed_by_user_id);
    }

    public function test_koreksi_refund_kumulatif_tidak_boleh_melebihi_pembayaran(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(2);
        $o = $this->makeOrder('return_completed', 'paid');
        $this->addPaidPayment($o, 100000);
        $item = $this->addItem($o, $p);
        // Kasus lain sudah merefund 50000.
        $this->makeCompletedCase($o, $item, 50000, 0);
        $case = $this->makeCompletedCase($o, $item, 50000, 0);

        // 60000 + 50000 kumulatif = 110000 > pembayaran tercatat 100000.
        $resp = $this->actingAs($admin)->patch(
            route('admin.orders.returns.update', ['order' => $o, 'returnCase' => $case]),
            $this->koreksiPayload(['refund_amount' => 60000, 'return_shipping_cost' => 0]),
        );
        $resp->assertSessionHasErrors('refund_amount');

        $case->refresh();
        $this->assertSame('50000.00', (string) $case->refund_amount, 'kasus tidak boleh berubah saat validasi menolak');
    }

    public function test_koreksi_refund_ditolak_untuk_pesanan_belum_lunas(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(3);
        $o = $this->makeOrder('return_completed', 'pending');
        $item = $this->addItem($o, $p);
        $case = $this->makeCompletedCase($o, $item, 0, 15000);

        $resp = $this->actingAs($admin)->patch(
            route('admin.orders.returns.update', ['order' => $o, 'returnCase' => $case]),
            $this->koreksiPayload(['refund_amount' => 20000]),
        );
        $resp->assertSessionHasErrors('refund_amount');
    }

    public function test_koreksi_non_refund_wajib_refund_nol(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(4);
        $o = $this->makeOrder('return_completed', 'paid');
        $this->addPaidPayment($o, 100000);
        $item = $this->addItem($o, $p);
        $case = $this->makeCompletedCase($o, $item, 0, 15000);

        $resp = $this->actingAs($admin)->patch(
            route('admin.orders.returns.update', ['order' => $o, 'returnCase' => $case]),
            $this->koreksiPayload(['resolution_type' => 'replacement', 'refund_amount' => 25000]),
        );
        $resp->assertSessionHasErrors('refund_amount');
    }

    public function test_koreksi_wajib_punya_alasan(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(5);
        $o = $this->makeOrder('return_completed', 'paid');
        $this->addPaidPayment($o, 100000);
        $item = $this->addItem($o, $p);
        $case = $this->makeCompletedCase($o, $item);

        $resp = $this->actingAs($admin)->patch(
            route('admin.orders.returns.update', ['order' => $o, 'returnCase' => $case]),
            $this->koreksiPayload(['adjustment_reason' => '']),
        );
        $resp->assertSessionHasErrors('adjustment_reason');
        $this->assertSame(0, ReturnCaseAdjustment::where('return_case_id', $case->id)->count());
    }

    public function test_edit_route_membuka_kasus_terpilih(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(6);
        $o = $this->makeOrder('return_completed', 'paid');
        $item = $this->addItem($o, $p);
        $case = $this->makeCompletedCase($o, $item);

        $resp = $this->actingAs($admin)->get(
            route('admin.orders.returns.edit', ['order' => $o, 'returnCase' => $case]),
        );
        $resp->assertOk();
        $resp->assertInertia(
            fn (\Inertia\Testing\AssertableInertia $page) => $page
                ->component('Admin/Orders/Show')
                ->where('editReturnCaseId', $case->id)
        );
    }

    // ---------------- Void / batalkan kasus ----------------

    public function test_void_kasus_open_menjadi_cancelled_tanpa_dihapus(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(7);
        $o = $this->makeOrder('return_in_process', 'pending');
        $item = $this->addItem($o, $p);
        $case = $this->makeOpenCase($o, $item);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.void', ['order' => $o, 'returnCase' => $case]),
            ['void_reason' => 'Pelanggan membatalkan pengajuan lewat WhatsApp'],
        );
        $resp->assertSessionHasNoErrors();

        // Kasus TETAP ADA di database (tidak dihapus fisik).
        $this->assertDatabaseHas('order_return_cases', ['id' => $case->id]);
        $case->refresh();
        $this->assertSame('cancelled', $case->status);
        $this->assertNotNull($case->voided_at);
        $this->assertSame($admin->id, (int) $case->voided_by_user_id);
        $this->assertSame(1, ReturnCaseAdjustment::where('return_case_id', $case->id)->where('field', 'void')->count());
    }

    public function test_void_kasus_completed_keluar_dari_laporan_tapi_riwayat_utuh(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(8);
        $o = $this->makeOrder('return_completed', 'paid');
        $item = $this->addItem($o, $p);
        $case = $this->makeCompletedCase($o, $item, 50000, 15000);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.void', ['order' => $o, 'returnCase' => $case]),
            ['void_reason' => 'Kasus ganda, seharusnya tidak dicatat'],
        );
        $resp->assertSessionHasNoErrors();

        $case->refresh();
        // Status workflow tetap completed (terminal), hanya diberi tanda void.
        $this->assertSame('completed', $case->status);
        $this->assertNotNull($case->voided_at);
        $o->refresh();
        $this->assertSame('return_completed', $o->order_status);

        // Laporan berhenti menghitung kasus yang di-void.
        $report = app(StorePerformanceService::class)->build('today');
        $this->assertSame(0.0, (float) $report['financial']['return_shipping_store']);
        $this->assertSame(0.0, (float) $report['financial']['refund_adjustments']);
        // Riwayat finansial tidak hilang: nilainya masih tersimpan di kasus.
        $this->assertSame('50000.00', (string) $case->refund_amount);
        $this->assertSame('15000.00', (string) $case->return_shipping_cost);
    }

    public function test_void_wajib_punya_alasan(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(9);
        $o = $this->makeOrder('return_in_process', 'pending');
        $item = $this->addItem($o, $p);
        $case = $this->makeOpenCase($o, $item);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.void', ['order' => $o, 'returnCase' => $case]),
            ['void_reason' => ''],
        );
        $resp->assertSessionHasErrors('void_reason');
        $case->refresh();
        $this->assertSame('open', $case->status);
    }

    public function test_void_dua_kali_ditolak(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(10);
        $o = $this->makeOrder('return_in_process', 'pending');
        $item = $this->addItem($o, $p);
        $case = $this->makeOpenCase($o, $item);

        $this->actingAs($admin)->post(
            route('admin.orders.returns.void', ['order' => $o, 'returnCase' => $case]),
            ['void_reason' => 'salah catat'],
        );
        $case->refresh();
        $this->assertSame('cancelled', $case->status);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.void', ['order' => $o, 'returnCase' => $case]),
            ['void_reason' => 'coba lagi'],
        );
        $resp->assertSessionHasErrors('return');
    }

    // ---------------- Retur manual pesanan Selesai ----------------

    public function test_pesanan_selesai_bisa_dicatat_retur_manual(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(11);
        $o = $this->makeOrder('completed', 'paid');
        $item = $this->addItem($o, $p);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.store', ['order' => $o]),
            [
                'reason' => 'rusak',
                'customer_notes' => 'Kesepakatan retur lewat WhatsApp',
                'late_return' => 1,
                'override_reason' => 'Retur di luar jendela karena pelanggan baru melaporkan kerusakan',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ],
        );
        $resp->assertSessionHasNoErrors();

        $case = OrderReturnCase::where('order_id', $o->id)->first();
        $this->assertNotNull($case, 'kasus retur manual tercipta');
        $this->assertSame('open', $case->status);
        $this->assertTrue((bool) $case->late_return);
        $this->assertStringContainsString('jendela', (string) $case->override_reason);

        $o->refresh();
        $this->assertSame('return_in_process', $o->order_status);

        // Kronologi lengkap: perpindahan tercatat dengan sumber jalur manual.
        $this->assertDatabaseHas('event_logs', [
            'entity_type' => 'order',
            'entity_id' => $o->id,
            'event_type' => 'order_status_changed',
        ]);
        $sumber = EventLog::where('entity_id', $o->id)
            ->where('event_type', 'order_status_changed')
            ->latest('id')->first();
        $this->assertSame('admin_late_return', $sumber->payload['source']);
        $this->assertSame(1, (int) $sumber->payload['late_return']);
    }

    public function test_retur_manual_wajib_alasan_pengecualian(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(12);
        $o = $this->makeOrder('completed', 'paid');
        $item = $this->addItem($o, $p);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.store', ['order' => $o]),
            [
                'reason' => 'rusak',
                'customer_notes' => 'catatan',
                'late_return' => 1,
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ],
        );
        $resp->assertSessionHasErrors('override_reason');
        $this->assertSame(0, OrderReturnCase::where('order_id', $o->id)->count());
    }

    public function test_retur_manual_kedua_ditolak_selama_kasus_aktif(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(13);
        $o = $this->makeOrder('completed', 'paid');
        $item = $this->addItem($o, $p);

        $payload = [
            'reason' => 'rusak',
            'customer_notes' => 'catatan',
            'late_return' => 1,
            'override_reason' => 'kesepakatan WhatsApp',
            'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
        ];

        $this->actingAs($admin)->post(route('admin.orders.returns.store', ['order' => $o]), $payload)
            ->assertSessionHasNoErrors();

        $resp = $this->actingAs($admin)->post(route('admin.orders.returns.store', ['order' => $o]), $payload);
        $resp->assertSessionHasErrors('return');
        $this->assertSame(1, OrderReturnCase::where('order_id', $o->id)->count());
    }

    public function test_retur_manual_setelah_return_completed_ditolak(): void
    {
        $admin = $this->admin();
        $p = $this->makeProduct(14);
        $o = $this->makeOrder('return_completed', 'paid');
        $item = $this->addItem($o, $p);

        $resp = $this->actingAs($admin)->post(
            route('admin.orders.returns.store', ['order' => $o]),
            [
                'reason' => 'rusak',
                'customer_notes' => 'catatan',
                'late_return' => 1,
                'override_reason' => 'coba buka ulang',
                'items' => [['order_item_id' => $item->id, 'requested_quantity' => 1]],
            ],
        );
        $resp->assertSessionHasErrors('return');
        $o->refresh();
        $this->assertSame('return_completed', $o->order_status, 'return_completed tidak boleh terbuka ulang');
    }
}
