<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Services\ModelProductService;
use App\Support\InertiaCatalog;
use App\Support\StorefrontCategoryPages;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Halaman kategori storefront (landing ala homepage).
 *
 * Satu template `Public/CategoryPage` untuk semua kategori — struktur halaman
 * ditentukan oleh konfigurasi `StorefrontCategoryPages` (title, deskripsi,
 * hero, benefits) + data katalog (model cards, produk populer, menu kategori).
 * Tidak ada layout/halaman terpisah per kategori.
 */
class CategoryController extends Controller
{
    public function show(string $slug, Request $request): Response
    {
        $config = StorefrontCategoryPages::definition($slug);
        if ($config === null) {
            abort(404);
        }
        $code = $config['code'];

        $modelCards = [];
        $productCards = [];
        $categoryMenu = [];

        try {
            $modelCards = app(ModelProductService::class)->storefrontCards(category: $code);
        } catch (\Throwable) {
            $modelCards = [];
        }

        try {
            $products = Product::visible()
                ->where('product_category', $code)
                ->with(['mainImage', 'activeVariants', 'attributes'])
                ->withSum('validOrderItems as sold_count', 'quantity')
                ->orderByDesc('sold_count')
                ->orderByDesc('id')
                ->limit(12)
                ->get();

            $productCards = InertiaCatalog::productCards($products);
        } catch (\Throwable) {
            $productCards = [];
        }

        try {
            $categoryMenu = app(ModelProductService::class)->storefrontCategoryMenu();
        } catch (\Throwable) {
            $categoryMenu = [];
        }

        // Hero image: config (bila diisi nanti) > gambar model pertama > placeholder.
        $heroImage = $config['hero_image'] ?? null;
        if (! $heroImage && $modelCards !== []) {
            $heroImage = $modelCards[0]['image'] ?? null;
        }

        $config['hero_image'] = $heroImage;
        $config['all_href'] = route(
            'catalog.category',
            ['category' => StorefrontCategoryPages::codeToSlug($code)],
            absolute: false,
        );

        return Inertia::render('Public/CategoryPage', [
            'config' => $config,
            'models' => $modelCards,
            'products' => $productCards,
            'categoryMenu' => $categoryMenu,
        ]);
    }
}
