<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Product;
use App\Support\CategoryUrl;
use Illuminate\Http\Response;
use Carbon\Carbon;

class SitemapController extends Controller
{
    public function __invoke(): Response
    {
        $now = Carbon::now()->toAtomString();

        /*
         * HIERARKI SITEMAP (SEO priority):
         *
         *   1.0  Homepage
         *   0.9  Catalog index (/products)
         *   0.8  Promo / Flash Sale (high-intent, dynamic)
         *   0.7  Kategori (/products/jendela, etc.)
         *   0.6  Model (/products/jendela/jungkit, etc.)
         *   0.5  Design (/products/jendela/jungkit/polos, etc.)
         *   0.4  Produk individu (/product/SP..., etc.)
         *   0.3  Static info (about, faq, cara-pemesanan)
         *   0.2  Reviews / gallery (low-intent)
         */

        // ── 1. Static pages ──────────────────────────────────────────
        $staticPages = collect([
            ['loc' => route('home'),              'changefreq' => 'weekly',  'priority' => '1.0', 'lastmod' => $now],
            ['loc' => route('catalog.index'),     'changefreq' => 'weekly',  'priority' => '0.9', 'lastmod' => $now],
            ['loc' => route('catalog.promo'),     'changefreq' => 'daily',   'priority' => '0.8', 'lastmod' => $now],
            ['loc' => route('catalog.flash-sale'),'changefreq' => 'daily',   'priority' => '0.8', 'lastmod' => $now],
            ['loc' => route('cara-pemesanan'),    'changefreq' => 'monthly', 'priority' => '0.3', 'lastmod' => $now],
            ['loc' => route('about'),             'changefreq' => 'monthly', 'priority' => '0.3', 'lastmod' => $now],
            ['loc' => route('faq'),               'changefreq' => 'monthly', 'priority' => '0.3', 'lastmod' => $now],
            ['loc' => route('installation.index'),'changefreq' => 'weekly',  'priority' => '0.4', 'lastmod' => $now],
            ['loc' => route('reviews.website'),   'changefreq' => 'weekly',  'priority' => '0.2', 'lastmod' => $now],
            ['loc' => route('reviews.screenshots'),'changefreq' => 'weekly', 'priority' => '0.2', 'lastmod' => $now],
        ]);

        // ── 2. Kategori ──────────────────────────────────────────────
        // URL kanonik: /products/jendela, /products/pintu, /products/boven
        $categoryUrls = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (Category $category) => [
                'loc'       => route('catalog.category', [
                    'category' => CategoryUrl::categoryToSlug($category->code),
                ]),
                'lastmod'   => optional($category->updated_at)?->toAtomString() ?? $now,
                'changefreq' => 'weekly',
                'priority'  => '0.7',
            ]);

        // ── 3. Model (unique category+model) ─────────────────────────
        $products = Product::visible()
            ->select(['id', 'parent_sku', 'product_category', 'product_model', 'design_variant', 'updated_at'])
            ->orderBy('id')
            ->get();

        $models = $products
            ->filter(fn (Product $p) => filled($p->product_category) && filled($p->product_model))
            ->unique(fn (Product $p) => strtoupper($p->product_category.'|'.$p->product_model))
            ->map(fn (Product $p) => [
                'loc'       => route('catalog.model', [
                    'category' => CategoryUrl::categoryToSlug((string) $p->product_category),
                    'model'    => strtolower(str_replace('_', '-', (string) $p->product_model)),
                ]),
                'lastmod'   => optional($p->updated_at)?->toAtomString(),
                'changefreq' => 'weekly',
                'priority'  => '0.6',
            ]);

        // ── 4. Design (unique category+model+design) ─────────────────
        $designs = $products
            ->filter(fn (Product $p) => filled($p->product_category) && filled($p->product_model) && filled($p->design_variant))
            ->unique(fn (Product $p) => strtoupper($p->product_category.'|'.$p->product_model.'|'.$p->design_variant))
            ->map(fn (Product $p) => [
                'loc'       => route('catalog.design', [
                    'category' => CategoryUrl::categoryToSlug((string) $p->product_category),
                    'model'    => strtolower(str_replace('_', '-', (string) $p->product_model)),
                    'design'   => strtolower(str_replace('_', '-', (string) $p->design_variant)),
                ]),
                'lastmod'   => optional($p->updated_at)?->toAtomString(),
                'changefreq' => 'weekly',
                'priority'  => '0.5',
            ]);

        // ── 5. Produk individu ───────────────────────────────────────
        $productUrls = $products->map(fn (Product $p) => [
            'loc'       => route('product.show', $p->parent_sku),
            'lastmod'   => optional($p->updated_at)?->toAtomString(),
            'changefreq' => 'weekly',
            'priority'  => '0.4',
        ]);

        // ── Gabungkan dalam urutan hierarki ──────────────────────────
        $allUrls = $staticPages
            ->concat($categoryUrls)
            ->concat($models)
            ->concat($designs)
            ->concat($productUrls);

        $xml = view('sitemap', ['urls' => $allUrls])->render();

        return response($xml, 200)->header('Content-Type', 'application/xml; charset=UTF-8');
    }
}
