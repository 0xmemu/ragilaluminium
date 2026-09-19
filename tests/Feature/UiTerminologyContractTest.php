<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Kontrak istilah pada teks yang dibaca admin (ADR-018).
 *
 * Beberapa istilah pernah bercabang untuk konsep yang sama, dan sebagian
 * mengklaim hal yang tidak dimiliki sistem:
 *   - "Omzet"/"Omset" dipakai berdampingan dengan "Penjualan Gross".
 *   - "Piutang COD kurir" dan "belum dicairkan J&T" mengaku ada pencatatan
 *     setoran uang dari kurir, padahal sistem tidak punya skema itu
 *     (docs/DOMAIN/checkout-pembayaran-cod.md bagian 2).
 *   - "Cair" pada nilai COD menyiratkan uang sudah diterima, padahal penandanya
 *     hanya kejadian barang sampai.
 *
 * Guard ini memeriksa berkas sumber, bukan data: label KPI runtime sudah
 * dijaga CodLabelContractTest.
 */
class UiTerminologyContractTest extends TestCase
{
    /**
     * Istilah terlarang per berkas.
     *
     * "Omzet" tidak dipindai di berkas PHP layanan karena komentar internal
     * menyebut rule omzet owner 2026-08-22, dan komentar bukan teks tampilan.
     *
     * @var array<string, list<string>>
     */
    private const BERKAS = [
        "app/Services/StorePerformanceService.php" => ["Omset", "Piutang", "piutang", "Cair", "Hangus"],
        "app/Exports/StorePerformanceExport.php" => ["Omset", "Piutang", "piutang", "Cair", "Hangus"],
        "app/Exports/OrderExport.php" => ["Omset", "Piutang", "piutang", "Cair"],
        "resources/js/pages/Admin/Analytics/StorePerformance.tsx" => ["Omset", "Omzet", "Piutang", "piutang", "Cair", "Hangus"],
        "resources/js/pages/Admin/Payments/Index.tsx" => ["Omset", "Omzet", "Piutang", "piutang", "Cair"],
        "resources/js/config/admin-page-guides.ts" => ["Omset", "Omzet", "Piutang", "piutang", "Cair"],
    ];

    public function test_teks_laporan_tidak_memuat_istilah_bercabang(): void
    {
        $pelanggaran = [];

        foreach (self::BERKAS as $berkas => $terlarang) {
            $isi = file_get_contents(base_path($berkas));
            $this->assertNotFalse($isi, $berkas." wajib ada");

            foreach (explode("\n", $isi) as $nomor => $baris) {
                foreach ($terlarang as $istilah) {
                    if (str_contains($baris, $istilah)) {
                        $pelanggaran[] = $berkas.":".($nomor + 1)." memuat \"".$istilah."\"";
                    }
                }
            }
        }

        $this->assertSame(
            [],
            $pelanggaran,
            "ADR-018: pakai nama kanonik, jangan istilah bercabang atau klaim pencatatan uang yang tidak ada.\n"
                .implode("\n", $pelanggaran)
        );
    }
}
