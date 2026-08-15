<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Services\CartService;
use Tests\TestCase;

class CartSelectionTest extends TestCase
{
    use RefreshDatabase;

    private function cart(): array
    {
        return [
            'LINE-A' => ['line_id' => 'LINE-A', 'parent_sku' => 'P-A', 'quantity' => 1],
            'LINE-B' => ['line_id' => 'LINE-B', 'parent_sku' => 'P-B', 'quantity' => 1],
        ];
    }

    public function test_checkout_without_selection_uses_all_cart_lines(): void
    {
        $this->withSession(['ragil_cart' => $this->cart()]);
        $service = app(CartService::class);
        $this->assertCount(2, $service->get());
        $this->assertSame([], $service->getSelectedLines());
    }

    public function test_selection_mode_uses_only_checked_lines(): void
    {
        $this->withSession(['ragil_cart' => $this->cart()])
            ->post('/cart/select', ['line_ids' => ['LINE-B']])
            ->assertRedirect('/checkout')
            ->assertSessionHas('ragil_cart_selected', ['LINE-B']);
    }

    public function test_empty_or_stale_selection_is_rejected(): void
    {
        $this->withSession(['ragil_cart' => $this->cart()])
            ->post('/cart/select', ['line_ids' => []])
            ->assertSessionHasErrors('line_ids');

        $this->withSession(['ragil_cart' => $this->cart()])
            ->post('/cart/select', ['line_ids' => ['GHOST']])
            ->assertSessionHasErrors('line_ids');
    }
}
