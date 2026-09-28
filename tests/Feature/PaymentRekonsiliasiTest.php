<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Rekonsiliasi Pembayaran (P2-01, instruksi owner 2026-09-28).
 *
 * Semua status di panel adalah LABEL INTERNAL hasil pencatatan website:
 * tidak ada klaim berasal dari bank. Tagihan dibaca dari total pesanan yang
 * punya catatan pembayaran pada periode terpilih; pembayaran dan refund
 * dibaca dari tabel payments (status completed / refunded).
 */
class PaymentRekonsiliasiTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'status' => 'active']);
    }

    private function makeOrder(float $total = 100000, ?string $createdAt = null): Order
    {
        $order = Order::create([
            'order_number' => 'RC-'.uniqid(),
            'customer_name' => 'Cust',
            'customer_phone' => '081500000003',
            'shipping_address_line1' => 'Jl A',
            'shipping_city' => 'Semarang',
            'shipping_province' => 'Jawa Tengah',
            'shipping_postal_code' => '50254',
            'shipping_country' => 'Indonesia',
            'order_status' => 'completed',
            'payment_status' => 'pending',
            'shipping_status' => 'delivered',
            'subtotal_amount' => (int) $total,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => (int) $total,
        ]);
        if ($createdAt !== null) {
            \Illuminate\Support\Facades\DB::table('orders')->where('id', $order->id)->update(['created_at' => $createdAt]);
        }

        return $order;
    }

    private function addPayment(Order $order, string $status, float $amount, string $method = 'transfer', ?string $createdAt = null): Payment
    {
        $payment = Payment::create([
            'order_id' => $order->id,
            'payment_method' => $method,
            'amount' => $amount,
            'status' => $status,
            'paid_at' => $status === 'completed' ? now() : null,
        ]);
        if ($createdAt !== null) {
            \Illuminate\Support\Facades\DB::table('payments')->where('id', $payment->id)->update(['created_at' => $createdAt]);
        }

        return $payment;
    }

    private function getRekonsiliasi(): array
    {
        $admin = $this->admin();
        $data = null;
        $this->actingAs($admin)->get(route('admin.payments.index'))
            ->assertInertia(function (AssertableInertia $page) use (&$data) {
                $data = $page->component('Admin/Payments/Index')->toArray()['props']['rekonsiliasi'] ?? null;
            });

        return $data ?? [];
    }

    public function test_paid_penuh(): void
    {
        $o = $this->makeOrder(100000);
        $this->addPayment($o, 'completed', 100000);

        $r = $this->getRekonsiliasi();
        $this->assertSame(100000.0, (float) $r['total_tagihan']);
        $this->assertSame(100000.0, (float) $r['pembayaran_tercatat']);
        $this->assertSame(0.0, (float) $r['sisa_tercatat']);
        $this->assertSame('paid', $r['status']);
    }

    public function test_pembayaran_parsial(): void
    {
        $o = $this->makeOrder(100000);
        $this->addPayment($o, 'completed', 40000);

        $r = $this->getRekonsiliasi();
        $this->assertSame('partially_paid', $r['status']);
        $this->assertSame(60000.0, (float) $r['sisa_tercatat']);
    }

    public function test_refund_parsial(): void
    {
        $o = $this->makeOrder(100000);
        $this->addPayment($o, 'completed', 100000);
        $this->addPayment($o, 'refunded', 30000);

        $r = $this->getRekonsiliasi();
        $this->assertSame('refunded_partially', $r['status']);
        $this->assertSame(30000.0, (float) $r['refund_tercatat']);
        $this->assertSame(30000.0, (float) $r['sisa_tercatat']);
    }

    public function test_refund_penuh(): void
    {
        $o = $this->makeOrder(100000);
        $this->addPayment($o, 'completed', 100000);
        $this->addPayment($o, 'refunded', 100000);

        $r = $this->getRekonsiliasi();
        $this->assertSame('refunded_fully', $r['status']);
    }

    public function test_cod_delivered_masuk_pembayaran_tercatat(): void
    {
        $o = $this->makeOrder(200000);
        $this->addPayment($o, 'completed', 200000, 'cod');

        $r = $this->getRekonsiliasi();
        $this->assertSame(200000.0, (float) $r['pembayaran_tercatat']);
        $this->assertSame('paid', $r['status']);
    }

    public function test_payment_dibatalkan_tidak_menghitung_tercatat(): void
    {
        $o = $this->makeOrder(100000);
        $this->addPayment($o, 'cancelled', 100000);

        $r = $this->getRekonsiliasi();
        $this->assertSame(0.0, (float) $r['pembayaran_tercatat']);
        $this->assertSame(1, (int) $r['payment_dibatalkan_count']);
        $this->assertSame('unpaid', $r['status']);
        $this->assertStringContainsString('Dibatalkan', (string) $r['catatan_verifikasi']);
    }

    public function test_settlement_lintas_periode_mengikuti_filter(): void
    {
        // Pesanan dan pembayaran bulan lalu: tidak masuk periode hari ini.
        $o = $this->makeOrder(100000, now()->subMonth()->toDateTimeString());
        $this->addPayment($o, 'completed', 100000, 'transfer', now()->subMonth()->toDateTimeString());

        $admin = $this->admin();
        $this->actingAs($admin)->get(route('admin.payments.index', ['date_preset' => 'today']))
            ->assertInertia(function (AssertableInertia $page) {
                $r = $page->component('Admin/Payments/Index')->toArray()['props']['rekonsiliasi'];
                $this->assertSame(0.0, (float) $r['total_tagihan']);
                $this->assertSame('unpaid', $r['status']);
            });

        // Tanpa filter (semua waktu): masuk.
        $r = $this->getRekonsiliasi();
        $this->assertSame(100000.0, (float) $r['pembayaran_tercatat']);
        $this->assertSame('paid', $r['status']);
    }

    public function test_disclaimer_tidak_mengklaim_bank_otomatis(): void
    {
        $r = $this->getRekonsiliasi();
        $this->assertStringContainsString('pencatatan website', (string) $r['disclaimer']);
        $this->assertStringContainsString('tidak membaca mutasi rekening', (string) $r['disclaimer']);
    }
}
