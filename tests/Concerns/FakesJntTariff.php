<?php

namespace Tests\Concerns;

use App\Services\Shipping\JntCargoClient;
use App\Services\Shipping\JntResponse;

/**
 * Fake klien J&T Cargo untuk test.
 *
 * Fake ini MENGIKUTI perilaku J&T Cargo yang nyata (terbukti 2026-09-12):
 *
 * - `estimateInsuranceCost` hanya keluar bila `offerFee` (nilai barang yang
 *   diasuransikan) dikirim pada `bizContent`.
 * - Besar biaya asuransi sekitar 0,2% dari nilai barang, dengan minimum
 *   Rp 5.000.
 * - Saat `offerFee` dikirim, `estimateSumFreight` SUDAH memuat asuransi,
 *   sedangkan `estimateCustomerCost` tetap ongkos standar tanpa asuransi.
 *
 * Tujuan utama fake ini adalah mencegah test memanggil API J&T yang live,
 * supaya test tidak terkena limit dan tidak mengganggu akun produksi. Karena
 * itu test yang memakai trait ini tidak butuh kredensial J&T dan tetap hijau
 * walau `JNT_ENABLED=false` di server.
 *
 * Dua bentuk balasan yang bisa ditiru:
 *
 * - Bentuk lengkap (default): `estimateCustomerCost` + `estimateSumFreight`
 *   + `estimateInsuranceCost`.
 * - Bentuk hanya total: kirim `customerCost: null`, sehingga hanya
 *   `estimateSumFreight` + `estimateInsuranceCost` yang keluar. Ongkir lalu
 *   diturunkan dari total dikurangi asuransi.
 */
trait FakesJntTariff
{
    /**
     * Pasang fake J&T ke container lalu kembalikan instance-nya.
     *
     * @param  float|int|null  $customerCost  Ongkos standar J&T
     *         (`estimateCustomerCost`). Isi `null` untuk meniru balasan J&T
     *         yang TIDAK mengirim ongkos standar, sehingga ongkir harus
     *         diturunkan dari `estimateSumFreight` dikurangi asuransi.
     * @param  float|int|null  $sumFreight  Total kirim (`estimateSumFreight`).
     *         `null` berarti dihitung sendiri: customerCost + asuransi.
     * @param  float|int|null  $insurance  Biaya asuransi
     *         (`estimateInsuranceCost`). `null` berarti mengikuti rumus nyata:
     *         0,2% nilai barang dengan minimum Rp 5.000, dan 0 bila `offerFee`
     *         tidak dikirim.
     * @param  float  $insuranceRate  Laju asuransi sebagai fraksi nilai barang.
     * @param  float  $insuranceMinimum  Batas bawah biaya asuransi.
     * @param  bool  $enabled  Nilai balik `isEnabled()`.
     * @return object  Fake yang sudah terpasang di container.
     */
    protected function fakeJntTariff(
        float|int|null $customerCost = 120000,
        float|int|null $sumFreight = null,
        float|int|null $insurance = null,
        float $insuranceRate = 0.002,
        float $insuranceMinimum = 5000.0,
        bool $enabled = true,
    ): object {
        $fake = new class($customerCost, $sumFreight, $insurance, $insuranceRate, $insuranceMinimum, $enabled) extends JntCargoClient
        {
            /** Berapa kali `tariff()` dipanggil, bukti fake yang dipakai. */
            public int $tariffCalls = 0;

            public function __construct(
                private float|int|null $customerCost,
                private float|int|null $sumFreight,
                private float|int|null $insurance,
                private float $insuranceRate,
                private float $insuranceMinimum,
                private bool $enabled,
            ) {
            }

            public function isEnabled(): bool
            {
                return $this->enabled;
            }

            public function tariff(array $bizContent): JntResponse
            {
                $this->tariffCalls++;

                $offer = (int) ($bizContent['offerFee'] ?? 0);

                $insurance = $this->insurance !== null
                    ? (float) $this->insurance
                    : ($offer > 0 ? max($this->insuranceMinimum, round($offer * $this->insuranceRate)) : 0.0);

                $sumFreight = $this->sumFreight !== null
                    ? (float) $this->sumFreight
                    : ($this->customerCost !== null ? (float) $this->customerCost + $insurance : $insurance);

                $data = [
                    'estimateTime' => '1-3',
                    'estimateSumFreight' => (string) $sumFreight,
                    'estimateInsuranceCost' => (string) $insurance,
                ];

                if ($this->customerCost !== null) {
                    $data['estimateCustomerCost'] = (string) $this->customerCost;
                }

                return new JntResponse(
                    ok: true,
                    httpStatus: 200,
                    data: ['data' => $data],
                    requestId: 'test-jnt-tariff',
                    elapsedMs: 1,
                );
            }
        };

        $this->app->instance(JntCargoClient::class, $fake);

        return $fake;
    }
}
