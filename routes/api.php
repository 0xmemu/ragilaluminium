<?php

use App\Http\Controllers\CatalogController;
use App\Http\Controllers\GoogleMapsController;
use App\Http\Controllers\ShippingQuoteController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ReadinessController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\WilayahController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public Store API Routes (rate-limited, Stage 7)
|--------------------------------------------------------------------------
*/

Route::get('/health/ready', ReadinessController::class)
    ->middleware('throttle:60,1')
    ->name('health.ready');

Route::middleware('throttle:60,1')->group(function () {
    Route::get('/catalog/{category}', function ($category, Request $request) {
        $controller = app(CatalogController::class);

        // Slug kanonik Indonesia; alias English (window/windows/door/doors/bouven/boven)
        // diarahkan ke slug Indonesia agar tidak terperangkap redirect 301 kanonik.
        return match (strtoupper($category)) {
            'WINDOWS', 'WINDOW' => $controller->categoryShow('jendela', $request),
            'DOORS', 'DOOR' => $controller->categoryShow('pintu', $request),
            'BOUVEN', 'BOVEN' => $controller->categoryShow('boven', $request),
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
    Route::post('/shipping/quote', [ShippingQuoteController::class, 'store']);
    Route::get('/maps/geocode', [GoogleMapsController::class, 'geocode']);
});
