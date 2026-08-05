<?php

namespace App\Http\Controllers;

use App\Services\CartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CartController extends Controller
{
    public function __construct(protected CartService $cart)
    {
    }

    public function index(): Response
    {
        $priced = $this->cart->pricedLines();
        $undoItem = $this->cart->getLastRemoved();

        return Inertia::render('Public/Cart', [
            'items' => $priced['items'],
            'subtotal' => $priced['subtotal'],
            'compare_subtotal' => $priced['compare_subtotal'],
            'discount_total' => $priced['discount_total'],
            'undo_item' => $undoItem,
        ]);
    }

    public function count(): JsonResponse
    {
        return response()->json(['count' => $this->cart->count()]);
    }

    public function add(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'parent_sku' => ['required', 'string'],
            'variant_sku' => ['nullable', 'string'],
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        $this->cart->add(
            $validated['parent_sku'],
            $validated['variant_sku'] ?? null,
            $validated['quantity']
        );

        return redirect()->route('cart.index')
            ->with('success', 'Produk ditambahkan ke keranjang.');
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'line_id' => ['required', 'string'],
            'quantity' => ['required', 'integer', 'min:0'],
        ]);

        $this->cart->update($validated['line_id'], $validated['quantity']);

        return redirect()->route('cart.index')
            ->with('success', 'Keranjang diperbarui.');
    }

    public function remove(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'line_id' => ['required', 'string'],
        ]);

        $this->cart->remove($validated['line_id']);

        return redirect()->route('cart.index')
            ->with('success', 'Item dihapus dari keranjang.');
    }

    public function select(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'line_ids' => ['required', 'array'],
            'line_ids.*' => ['string'],
        ]);

        $this->cart->selectLines($validated['line_ids']);

        return redirect()->route('checkout.index');
    }

    public function restore(): RedirectResponse
    {
        $restored = $this->cart->restoreLastRemoved();

        return redirect()->route('cart.index')
            ->with($restored ? 'success' : 'error', $restored
                ? 'Produk dikembalikan ke keranjang.'
                : 'Tidak ada produk yang bisa dikembalikan.');
    }

    public function removeSelected(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'line_ids' => ['required', 'array', 'min:1'],
            'line_ids.*' => ['string'],
        ]);

        $count = 0;
        foreach ($validated['line_ids'] as $lineId) {
            $this->cart->remove($lineId);
            $count++;
        }

        return redirect()->route('cart.index')
            ->with('success', "{$count} item dihapus dari keranjang.");
    }
}
