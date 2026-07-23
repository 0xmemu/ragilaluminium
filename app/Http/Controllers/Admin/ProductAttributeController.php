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
    public function index(Product $product): Response
    {
        $product->load('attributes');

        return Inertia::render('Admin/Attributes', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'parent_sku' => $product->parent_sku,
            ],
            'attributes' => $product->attributes->map(fn (ProductAttribute $attribute) => [
                'id' => $attribute->id,
                'attribute_name' => $attribute->attribute_name,
                'attribute_value' => $attribute->attribute_value,
                'source' => $attribute->source,
                'updateUrl' => route('admin.attributes.update', $attribute),
            ])->values()->all(),
            'submitUrl' => route('admin.products.attributes.store', $product),
        ]);
    }

    public function store(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'attribute_name' => ['required', 'string', 'max:255'],
            'attribute_value' => ['required', 'string', 'max:255'],
            'source' => ['required', 'in:shopee,internal'],
        ]);
        $validated['product_id'] = $product->id;
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        ProductAttribute::create($validated);

        return redirect()->route('admin.products.attributes.index', $product)
            ->with('success', 'Atribut ditambahkan.');
    }

    public function update(Request $request, ProductAttribute $attribute): RedirectResponse
    {
        $validated = $request->validate([
            'attribute_name' => ['required', 'string', 'max:255'],
            'attribute_value' => ['required', 'string', 'max:255'],
            'source' => ['required', 'in:shopee,internal'],
        ]);
        $validated['updated_by_user_id'] = $request->user()->id;
        $attribute->update($validated);

        return redirect()->back()->with('success', 'Atribut diperbarui.');
    }
}
