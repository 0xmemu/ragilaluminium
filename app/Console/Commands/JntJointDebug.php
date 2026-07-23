<?php

namespace App\Console\Commands;

use App\Services\Shipping\JntCargoClient;
use Illuminate\Console\Command;

/**
 * Joint-debugging J&T Cargo (sandbox).
 *
 * Persyaratan J&T sebelum ajukan environment formal:
 * "You need to perform joint debugging of all the interfaces that need to be
 *  online in the sandbox environment, and you need to succeed three or more
 *  times before submitting the application for the formal environment."
 *
 * Command ini menembak tiap interface N kali ke sandbox, mencatat semua
 * request/response ke channel log `jnt`, lalu mencetak ringkasan sukses.
 *
 * Contoh:
 *   php artisan jnt:joint-debug --times=3
 *   php artisan jnt:joint-debug --interface=track --times=3
 */
class JntJointDebug extends Command
{
    protected $signature = 'jnt:joint-debug
        {--interface=all : all|tariff|address|create|track|cancel}
        {--times=3 : Jumlah pengulangan per interface (>=3 utk syarat J&T)}
        {--force : Izinkan berjalan walau environment=production}';

    protected $description = 'Joint-debugging interface J&T Cargo di sandbox (bukti sukses >=3x).';

    public function handle(JntCargoClient $jnt): int
    {
        if (! $jnt->isEnabled()) {
            $this->error('J&T belum aktif. Set JNT_ENABLED=true + kredensial di .env.');

            return self::FAILURE;
        }

        if ($jnt->environment() !== 'sandbox' && ! $this->option('force')) {
            $this->error('Environment bukan sandbox. Gunakan --force jika memang disengaja.');

            return self::FAILURE;
        }

        $times = max(1, (int) $this->option('times'));
        $interface = $this->option('interface');
        $interfaces = $interface === 'all'
            ? ['tariff', 'address', 'create', 'track', 'cancel']
            : [$interface];

        $this->info("Joint-debugging J&T (env={$jnt->environment()}, base={$jnt->baseUrl()})");
        $this->newLine();

        $summary = [];
        foreach ($interfaces as $name) {
            $success = 0;
            for ($i = 1; $i <= $times; $i++) {
                $resp = $this->fire($jnt, $name);
                $ok = $resp->ok;
                $success += $ok ? 1 : 0;
                $this->line(sprintf(
                    '  [%s] #%d %s (http=%d, %dms) req=%s msg=%s',
                    $name,
                    $i,
                    $ok ? '<info>OK</info>' : '<error>FAIL</error>',
                    $resp->httpStatus,
                    $resp->elapsedMs,
                    $resp->requestId,
                    $resp->message() ?? '-',
                ));
            }
            $summary[$name] = "{$success}/{$times}";
        }

        $this->newLine();
        $this->info('Ringkasan sukses (butuh >=3 utk pengajuan formal):');
        foreach ($summary as $name => $ratio) {
            $this->line("  - {$name}: {$ratio}");
        }
        $this->comment('Detail lengkap tersimpan di storage/logs/jnt-*.log');

        return self::SUCCESS;
    }

    protected function fire(JntCargoClient $jnt, string $name)
    {
        return match ($name) {
            'tariff' => $jnt->tariff($this->sampleTariff()),
            'address' => $jnt->address([
                'provinceName' => env('JNT_TEST_DEST_PROV', 'DKI JAKARTA'),
                'cityName' => env('JNT_TEST_DEST_CITY', 'JAKARTA'),
                'areaName' => env('JNT_TEST_DEST_AREA', 'JAKARTA PUSAT'),
            ]),
            'create' => $jnt->createOrder($this->sampleOrder()),
            'track' => $jnt->track(['billCodes' => env('JNT_TEST_BILLCODE', 'JT0000000001')]),
            'cancel' => $jnt->cancelOrder([
                'billCode' => env('JNT_TEST_BILLCODE', 'JT0000000001'),
                'orderType' => config('jnt.defaults.order_type'),
                'txlogisticId' => env('JNT_TEST_ORDER_ID', 'RA-TEST0001'),
                'reason' => 'joint-debug cancel',
            ]),
            default => $jnt->tariff($this->sampleTariff()),
        };
    }

    protected function sampleTariff(): array
    {
        return [
            'paymentType' => config('jnt.defaults.payment_type'),
            'expressType' => config('jnt.defaults.express_type'),
            'deliveryType' => config('jnt.defaults.delivery_type'),
            'goodsType' => config('jnt.defaults.goods_type'),
            'weight' => '1',
            'totalQuantity' => 1,
            'sendProv' => config('jnt.sender.prov'),
            'sendCity' => config('jnt.sender.city'),
            'sendArea' => config('jnt.sender.area'),
            'receiveProv' => env('JNT_TEST_DEST_PROV', 'DKI JAKARTA'),
            'receiveCity' => env('JNT_TEST_DEST_CITY', 'JAKARTA'),
            'receiveArea' => env('JNT_TEST_DEST_AREA', 'JAKARTA PUSAT'),
        ];
    }

    protected function sampleOrder(): array
    {
        return [
            'txlogisticId' => 'RA-JD'.now()->format('YmdHis'),
            'operateType' => 1,
            'expressType' => config('jnt.defaults.express_type'),
            'orderType' => config('jnt.defaults.order_type'),
            'serviceType' => config('jnt.defaults.service_type'),
            'deliveryType' => config('jnt.defaults.delivery_type'),
            'payType' => config('jnt.defaults.pay_type'),
            'goodsType' => config('jnt.defaults.goods_type'),
            'weight' => '1',
            'totalQuantity' => 1,
            'sender' => [
                'name' => config('jnt.sender.name'),
                'mobile' => config('jnt.sender.mobile'),
                'phone' => config('jnt.sender.phone') ?: config('jnt.sender.mobile'),
                'countryCode' => config('jnt.sender.country_code'),
                'prov' => config('jnt.sender.prov'),
                'city' => config('jnt.sender.city'),
                'area' => config('jnt.sender.area'),
                'address' => config('jnt.sender.address'),
                'postCode' => config('jnt.sender.postcode'),
            ],
            'receiver' => [
                'name' => 'Test Penerima',
                'mobile' => env('JNT_TEST_RECEIVER_MOBILE', '08123456789'),
                'phone' => env('JNT_TEST_RECEIVER_MOBILE', '08123456789'),
                'countryCode' => 'IDN',
                'prov' => env('JNT_TEST_DEST_PROV', 'DKI JAKARTA'),
                'city' => env('JNT_TEST_DEST_CITY', 'JAKARTA'),
                'area' => env('JNT_TEST_DEST_AREA', 'JAKARTA PUSAT'),
                'address' => 'Jl. Test No. 1',
                'postCode' => env('JNT_TEST_DEST_POSTCODE', '10110'),
            ],
            'items' => [
                ['itemName' => 'Test Item', 'number' => 1, 'itemValue' => '100000', 'priceCurrency' => config('jnt.defaults.price_currency')],
            ],
        ];
    }
}
