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
        $undoCount = count($this->cart->getPendingRemovals());

        return Inertia::render('Public/Cart', [
            'items' => $priced['items'],
            'subtotal' => $priced['subtotal'],
            'compare_subtotal' => $priced['compare_subtotal'],
            'discount_total' => $priced['discount_total'],
            'undo_count' => $undoCount,
        ]);
    }

    public function count(): JsonResponse
    {
        return response()->json(['count' => $this->cart->count()]);
    }

    public function preview(): JsonResponse
    {
        $priced = $this->cart->pricedLines();

        return response()->json([
            'items' => collect($priced['items'])->take(5)->map(function (array $item) {
                return [
                    'line_id' => $item['line_id'],
                    'parent_sku' => $item['parent_sku'],
                    'name' => $item['name'],
                    'variation' => collect([
                        $item['variation_1_option'] ?? null,
                        $item['variation_2_option'] ?? null,
                    ])->filter()->implode(', '),
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => (float) $item['unit_price'],
                    'image' => $item['image'] ?? null,
                ];
            })->all(),
        ]);
    }

    public function add(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'parent_sku' => ['required', 'string'],
            'variant_sku' => ['nullable', 'string'],
            'quantity' => ['required', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:2000'],
            'intent' => ['nullable', 'string', 'in:cart,checkout'],
        ]);

        $this->cart->add(
            $validated['parent_sku'],
            $validated['variant_sku'] ?? null,
            $validated['quantity'],
            filled($validated['note'] ?? null) ? trim((string) $validated['note']) : null
        );

        // "Beli sekarang" mengirim intent=checkout; redirect langsung ke
        // checkout supaya user tidak melihat halaman produk/cart dulu.
        // "Tambah ke keranjang" tetap back() untuk animasi fly-to-cart.
        if (($validated['intent'] ?? null) === 'checkout') {
            return redirect()->route('checkout.index');
        }

        return back()->with('success', 'Produk ditambahkan ke keranjang.');
    }

    public function update(Request $request): RedirectResponse|JsonResponse
    {
        $validated = $request->validate([
            'line_id' => ['required', 'string'],
            'quantity' => ['required', 'integer', 'min:0'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $cart = $this->cart->update(
            $validated['line_id'],
            $validated['quantity'],
            array_key_exists('note', $validated) ? $validated['note'] : null
        );

        if ($request->expectsJson()) {
            $item = $cart[$validated['line_id']] ?? null;

            return response()->json([
                'line_id' => $validated['line_id'],
                'quantity' => (int) ($item['quantity'] ?? 0),
                'stock' => (int) ($item['stock'] ?? 0),
                'cart_count' => $this->cart->count(),
            ]);
        }

        return redirect()->route('cart.index')
            ->with('success', 'Keranjang diperbarui.');
    }

    public function remove(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'line_id' => ['required', 'string'],
        ]);

        $this->cart->remove($validated['line_id']);

        return redirect()->route('cart.index');
    }

    public function select(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'line_ids' => ['present', 'array'],
            'line_ids.*' => ['string'],
        ]);

        if ($validated['line_ids'] === []) {
            return back()->withErrors([
                'line_ids' => 'Pilih setidaknya satu item untuk checkout.',
            ]);
        }

        $this->cart->selectLines($validated['line_ids']);

        if ($this->cart->getSelectedLines() === []) {
            return back()->withErrors([
                'line_ids' => 'Item cart yang dipilih sudah tidak tersedia.',
            ]);
        }

        return redirect()->route('checkout.index');
    }

    public function restore(): RedirectResponse
    {
        $restored = $this->cart->restorePendingRemovals();

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

        $this->cart->removeBatch($validated['line_ids']);

        return redirect()->route('cart.index');
    }
}
