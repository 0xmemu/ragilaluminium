<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\Webhook\WahaWebhookController;
use App\Http\Controllers\WilayahController;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/waha', WahaWebhookController::class)
    ->middleware('throttle:120,1')
    ->name('api.webhooks.waha');

/*
|--------------------------------------------------------------------------
| Public Store API Routes (rate-limited, Stage 7)
|--------------------------------------------------------------------------
*/

Route::middleware('throttle:60,1')->group(function () {
    Route::get('/catalog/{category}', function ($category, \Illuminate\Http\Request $request) {
        $controller = app(CatalogController::class);

        return match (strtoupper($category)) {
            'WINDOWS', 'WINDOW' => $controller->windows($request),
            'DOORS', 'DOOR' => $controller->doors($request),
            'BOUVEN' => $controller->bouven($request),
            default => abort(404),
        };
    });

    Route::get('/search', [SearchController::class, 'index']);
    Route::get('/products/{parent_sku}', [ProductController::class, 'show']);
    Route::get('/orders/{order_number}/status', [OrderController::class, 'statusApi']);

    Route::get('/wilayah/provinces', [WilayahController::class, 'provinces']);
    Route::get('/wilayah/regencies/{provinceId}', [WilayahController::class, 'regencies']);
    Route::get('/wilayah/districts/{regencyId}', [WilayahController::class, 'districts']);
    Route::get('/wilayah/villages/{districtId}', [WilayahController::class, 'villages']);
});
