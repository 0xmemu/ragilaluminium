<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\OrderReturnCase;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Item 8 antrean pekerjaan: kompensasi tunai kini bernilai dan terlihat.
 *
 * Kontrak:
 * - Kompensasi boleh mengisi nominal dengan penjaga yang sama seperti refund:
 *   hanya untuk pesanan yang sudah lunas, tidak melebihi pembayaran riil.
 * - Nominalnya tersimpan di refund_amount kasus (yang dibaca laporan), dan
 *   pesanan tetap 'paid': kompensasi tidak menggerakkan transaksi pembayaran
 *   (refund hanyalah angka, keputusan owner).
 */
class CompensationFlowTest extends TestCase
{
    use RefreshDatabase;

    private function orderLunas(): Order
    {
        $order = Order::create([
            'order_number' => 'RA-KOM-'.random_int(1000, 9999),
            'customer_name' => 'Pelanggan Uji',
            'customer_phone' => '081200000123',
            'shipping_address_line1' => 'Jl Uji 1',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'return_in_process',
            'payment_status' => 'paid',
            'shipping_status' => 'pending_pickup',
            'subtotal_amount' => 1000000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 1000000,
            'payment_method' => 'cod',
            'cod_flag' => true,
        ]);
        Payment::create([
            'order_id' => $order->id,
            'payment_method' => 'cod',
            'amount' => 1000000,
            'status' => 'completed',
        ]);

        return $order;
    }

    private function kasus(Order $order): OrderReturnCase
    {
        return OrderReturnCase::create([
            'order_id' => $order->id,
            'status' => 'open',
            'reason' => 'rusak',
            'reason_detail' => 'uji',
            'fault_party' => 'store',
            'shipping_cost_borne_by_store' => true,
            'customer_notes' => 'uji',
        ]);
    }

    private function selesaikan(Order $order, OrderReturnCase $case, array $payload = [])
    {
        Http::fake(['*' => Http::response(['id' => 'WA-KOM'], 200)]);

        return $this->actingAs(User::factory()->create(['role' => 'admin', 'status' => 'active']))
            ->post(route('admin.orders.returns.complete', ['order' => $order->id, 'returnCase' => $case->id]), array_merge([
                'resolution_type' => 'compensation',
                'admin_notes' => 'Kompensasi uji',
                'refund_amount' => '500',
                'return_shipping_cost' => '15000',
            ], $payload));
    }

    public function test_kompensasi_bernominal_tercatat_dan_tidak_menggerakkan_pembayaran(): void
    {
        $order = $this->orderLunas();
        $case = $this->kasus($order);

        $this->selesaikan($order, $case)->assertRedirect();

        $this->assertDatabaseHas('order_return_cases', [
            'id' => $case->id,
            'resolution_type' => 'compensation',
            'refund_amount' => 500,
        ]);

        // Tidak ada transaksi pembayaran baru; uang kompensasi ditangani
        // manual di luar sistem (keputusan owner: refund hanyalah angka).
        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertSame(1, $order->payments()->count());
    }

    public function test_kompensasi_pada_pesanan_belum_lunas_ditolak(): void
    {
        $order = $this->orderLunas();
        $order->update(['payment_status' => 'pending']);
        $case = $this->kasus($order);

        $this->selesaikan($order, $case)
            ->assertSessionHasErrors('refund_amount');
        $this->assertSame('open', $case->fresh()->status);
    }
}
