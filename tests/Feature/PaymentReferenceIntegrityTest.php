<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentReferenceIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_payment_reference_is_trimmed_and_duplicate_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $firstOrder = $this->makeOrder('RA-PAY-REF-1');
        $secondOrder = $this->makeOrder('RA-PAY-REF-2');

        $this->actingAs($admin)
            ->post(route('admin.payments.store', $firstOrder), [
                'payment_method' => 'transfer',
                'amount' => 100000,
                'status' => 'pending',
                'transaction_reference' => '  TX-UNIQUE-1  ',
            ])
            ->assertRedirect(route('admin.orders.show', $firstOrder));

        $payment = Payment::query()->sole();
        $this->assertSame('TX-UNIQUE-1', $payment->transaction_reference);

        $this->actingAs($admin)
            ->put(route('admin.payments.update', $payment), [
                'status' => 'pending',
                'transaction_reference' => ' TX-UNIQUE-1 ',
            ])
            ->assertRedirect(route('admin.orders.show', $firstOrder));

        $this->actingAs($admin)
            ->from(route('admin.orders.show', $secondOrder))
            ->post(route('admin.payments.store', $secondOrder), [
                'payment_method' => 'transfer',
                'amount' => 100000,
                'status' => 'pending',
                'transaction_reference' => ' TX-UNIQUE-1 ',
            ])
            ->assertRedirect(route('admin.orders.show', $secondOrder))
            ->assertSessionHasErrors('transaction_reference');

        $this->assertSame(1, Payment::query()->count());
    }

    public function test_database_unique_constraint_closes_concurrent_validation_race(): void
    {
        $firstOrder = $this->makeOrder('RA-PAY-DB-1');
        $secondOrder = $this->makeOrder('RA-PAY-DB-2');

        Payment::create([
            'order_id' => $firstOrder->id,
            'payment_method' => 'transfer',
            'amount' => 100000,
            'status' => 'pending',
            'transaction_reference' => 'TX-DB-UNIQUE-1',
        ]);

        $this->expectException(QueryException::class);
        Payment::create([
            'order_id' => $secondOrder->id,
            'payment_method' => 'transfer',
            'amount' => 100000,
            'status' => 'pending',
            'transaction_reference' => 'TX-DB-UNIQUE-1',
        ]);
    }

    private function makeOrder(string $number): Order
    {
        return Order::create([
            'order_number' => $number,
            'customer_name' => 'Budi',
            'customer_phone' => '081234567890',
            'shipping_address_line1' => 'Jl. Test',
            'shipping_city' => 'Jakarta',
            'shipping_province' => 'DKI Jakarta',
            'shipping_postal_code' => '12345',
            'subtotal_amount' => 100000,
            'shipping_amount' => 0,
            'discount_amount' => 0,
            'total_amount' => 100000,
            'payment_method' => 'transfer',
            'order_status' => 'pending_payment',
            'payment_status' => 'pending',
            'shipping_status' => 'pending_pickup',
        ]);
    }
}
