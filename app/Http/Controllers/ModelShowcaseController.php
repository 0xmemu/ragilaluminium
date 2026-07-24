<?php

namespace App\Http\Controllers;

use App\Models\CmsModelProduct;
use App\Models\Product;
use App\Services\ModelProductService;
use App\Support\CatalogLabels;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ModelShowcaseController extends Controller
{
    public function __construct(protected ModelProductService $models)
    {
    }

    public function show(Request $request, string $category, string $model): Response
    {
        $categoryCode = CatalogLabels::categoryFromPath($category);
        $modelCode = CatalogLabels::modelFromPath($model);

        abort_unless($categoryCode !== null && $modelCode !== null, 404);

        $known = in_array($modelCode, CatalogLabels::MODEL_ORDER, true);
        $hasCms = CmsModelProduct::query()
            ->active()
            ->where('product_category', $categoryCode)
            ->where('product_model', $modelCode)
            ->exists();
        $hasProducts = Product::visible()
            ->where('product_category', $categoryCode)
            ->where('product_model', $modelCode)
            ->exists();

        abort_unless($known || $hasCms || $hasProducts, 404);

        $page = max(1, (int) $request->integer('page', 1));
        $payload = $this->models->showcase($categoryCode, $modelCode, $page);

        return Inertia::render('Public/ModelShow', $payload);
    }
}
