<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductAttribute;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductAttributeController extends Controller
{
    public function index(Product $product): RedirectResponse
    {
        // Penggabungan form edit terpusat (single source of truth): kelola spesifikasi
        // dilakukan langsung di form edit produk utama.
        return redirect()->route('admin.products.edit', [
            'product' => $product,
            'tab' => 'spesifikasi',
        ]);
    }

    public function store(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'attribute_name' => ['required', 'string', 'max:255'],
            'attribute_value' => ['required', 'string', 'max:255'],
            'source' => ['sometimes', 'in:shopee,internal'],
        ]);
        $validated['source'] = $validated['source'] ?? 'internal';
        $validated['product_id'] = $product->id;
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        ProductAttribute::create($validated);

        return redirect()->route('admin.products.attributes.index', $product)
            ->with('success', 'Spesifikasi ditambahkan.');
    }

    public function update(Request $request, ProductAttribute $attribute): RedirectResponse
    {
        $validated = $request->validate([
            'attribute_name' => ['required', 'string', 'max:255'],
            'attribute_value' => ['required', 'string', 'max:255'],
            'source' => ['sometimes', 'in:shopee,internal'],
        ]);
        $validated['source'] = $validated['source'] ?? $attribute->source ?? 'internal';
        $validated['updated_by_user_id'] = $request->user()->id;
        $attribute->update($validated);

        return redirect()->back()->with('success', 'Spesifikasi diperbarui.');
    }
}
