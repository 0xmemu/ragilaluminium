<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Response;

class SitemapController extends Controller
{
    public function __invoke(): Response
    {
        $urls = collect([
            ['loc' => route('home'), 'changefreq' => 'weekly', 'priority' => '1.0'],
            ['loc' => route('catalog.index'), 'changefreq' => 'weekly', 'priority' => '0.9'],
            ['loc' => route('catalog.all'), 'changefreq' => 'weekly', 'priority' => '0.9'],
            ['loc' => route('catalog.category', ['category' => 'windows']), 'changefreq' => 'weekly', 'priority' => '0.8'],
            ['loc' => route('catalog.category', ['category' => 'doors']), 'changefreq' => 'weekly', 'priority' => '0.8'],
            ['loc' => route('catalog.category', ['category' => 'bouven']), 'changefreq' => 'weekly', 'priority' => '0.8'],
            ['loc' => route('catalog.promo'), 'changefreq' => 'daily', 'priority' => '0.8'],
            ['loc' => route('catalog.flash-sale'), 'changefreq' => 'daily', 'priority' => '0.8'],
            ['loc' => route('about'), 'changefreq' => 'monthly', 'priority' => '0.5'],
            ['loc' => route('faq'), 'changefreq' => 'monthly', 'priority' => '0.5'],
            ['loc' => route('cara-pemesanan'), 'changefreq' => 'monthly', 'priority' => '0.6'],
            ['loc' => route('installation.index'), 'changefreq' => 'weekly', 'priority' => '0.6'],
            ['loc' => route('reviews'), 'changefreq' => 'weekly', 'priority' => '0.5'],
        ]);

        $products = Product::visible()
            ->select(['id', 'parent_sku', 'product_category', 'product_model', 'design_variant', 'updated_at'])
            ->orderBy('id')
            ->get();

        $models = $products
            ->filter(fn (Product $product) => filled($product->product_category) && filled($product->product_model))
            ->unique(fn (Product $product) => strtoupper($product->product_category.'|'.$product->product_model))
            ->map(function (Product $product) {
                $category = match (strtoupper((string) $product->product_category)) {
                    'DOOR' => 'doors',
                    'BOUVEN' => 'bouven',
                    default => 'windows',
                };

                return [
                    'loc' => route('catalog.model', [
                        'category' => $category,
                        'model' => strtolower(str_replace('_', '-', (string) $product->product_model)),
                    ]),
                    'lastmod' => optional($product->updated_at)?->toAtomString(),
                    'changefreq' => 'weekly',
                    'priority' => '0.7',
                ];
            });

        $designs = $products
            ->filter(fn (Product $product) => filled($product->product_category) && filled($product->product_model) && filled($product->design_variant))
            ->unique(fn (Product $product) => strtoupper($product->product_category.'|'.$product->product_model.'|'.$product->design_variant))
            ->map(function (Product $product) {
                $category = match (strtoupper((string) $product->product_category)) {
                    'DOOR' => 'doors',
                    'BOUVEN' => 'bouven',
                    default => 'windows',
                };

                return [
                    'loc' => route('catalog.design', [
                        'category' => $category,
                        'model' => strtolower(str_replace('_', '-', (string) $product->product_model)),
                        'design' => strtolower(str_replace('_', '-', (string) $product->design_variant)),
                    ]),
                    'lastmod' => optional($product->updated_at)?->toAtomString(),
                    'changefreq' => 'weekly',
                    'priority' => '0.7',
                ];
            });

        $productUrls = $products->map(fn (Product $product) => [
            'loc' => route('product.show', $product->parent_sku),
            'lastmod' => optional($product->updated_at)?->toAtomString(),
            'changefreq' => 'weekly',
            'priority' => '0.7',
        ]);

        $xml = view('sitemap', ['urls' => $urls->concat($models)->concat($designs)->concat($productUrls)])->render();

        return response($xml, 200)->header('Content-Type', 'application/xml; charset=UTF-8');
    }
}
