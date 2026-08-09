<?php
require '/root/ragilaluminium/vendor/autoload.php';
$app = require_once '/root/ragilaluminium/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Product;
use App\Models\ProductVariant;

$ref = new ReflectionMethod(App\Http\Controllers\Admin\ProductController::class, 'parseSizeQuery');
$ref->setAccessible(true);
$instance = new App\Http\Controllers\Admin\ProductController();

$tests = [
    ['100x50', [100.0, 50.0, null]],
    ['T100xP50', [100.0, 50.0, null]],
    ['Tinggi 100 Panjang 50', [100.0, 50.0, null]],
    ['lemari 120x60x45', [120.0, 60.0, 45.0]],
    ['sliding', null],
    ['jendela 200', null],
];
foreach ($tests as [$input, $expect]) {
    $got = $ref->invoke($instance, $input);
    $ok = ($got === $expect) || (is_array($got) && is_array($expect) && $got[0] === $expect[0] && $got[1] === $expect[1] && ($expect[2] ?? null) === ($got[2] ?? null));
    echo ($ok ? 'OK  ' : 'FAIL') . " parse '{$input}' => " . json_encode($got) . "\n";
}

$sample = ProductVariant::where('status', 'active')->whereNotNull('width_cm')->whereNotNull('height_cm')->where('width_cm', '>', 0)->where('height_cm', '>', 0)->first();
if ($sample) {
    $w = (float) $sample->width_cm;
    $h = (float) $sample->height_cm;
    $q = $w . 'x' . $h;
    $size = $ref->invoke($instance, $q);
    [$a, $b] = $size;
    $count = Product::whereHas('activeVariants', function ($v) use ($a, $b) {
        $v->where(function ($p) use ($a, $b) { $p->where('width_cm', $a)->where('height_cm', $b); })
          ->orWhere(function ($p) use ($a, $b) { $p->where('width_cm', $b)->where('height_cm', $a); });
    })->count();
    echo "OK   cari ukuran '{$q}' (contoh varian {$sample->variant_sku}) => {$count} produk\n";
}

$admin = App\Models\User::first();
$product = Product::where('status', 'active')->first();
echo "sumber: {$product->parent_sku} {$product->name} varian=" . $product->variants->count() . "\n";
$before = Product::count();

$req = Illuminate\Http\Request::create('/admin/products/' . $product->id . '/duplicate', 'POST');
$req->setUserResolver(fn () => $admin);
$response = Illuminate\Support\Facades\App::call(
    [new App\Http\Controllers\Admin\ProductController(), 'duplicate'],
    ['request' => $req, 'product' => $product]
);
$new = Product::latest('id')->first();
echo "duplikat: {$new->parent_sku} {$new->name} status={$new->status} varian=" . $new->variants->count() . "\n";
assert(Product::count() === $before + 1);
assert($new->name === $product->name . ' (Salinan)');
assert($new->variants->count() === $product->variants->count());
assert($new->status === 'active');

App\Models\ProductAttribute::where('product_id', $new->id)->delete();
App\Models\ProductVariant::where('product_id', $new->id)->delete();
App\Models\ProductMedia::where('product_id', $new->id)->delete();
$new->delete();
echo "bersih: produk=" . Product::count() . " (expect {$before})\n";
echo "DONE\n";
