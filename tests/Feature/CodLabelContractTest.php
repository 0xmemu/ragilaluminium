<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\StorePerformanceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Kontrak label COD: menyatakan keadaan BARANG, bukan keadaan uang.
 *
 * Sistem tidak punya skema pembayaran sistematis dan tidak melacak setoran uang
 * dari kurir J&T. Satu-satunya penanda COD lunas adalah kejadian barang sampai
 * (status delivered dari J&T). Karena itu metrik cod_paid wajib bernama
 * "COD Selesai"; nama "COD Dibayar"/"COD Cair" mengaku ada pencatatan
 * pembayaran yang tidak dimiliki sistem.
 *
 * Rujukan: docs/DOMAIN/checkout-pembayaran-cod.md bagian 2, ADR-018 aturan 6.
 * Insiden: rename "COD Selesai" -> "COD Dibayar" saat penyatuan istilah
 * 2026-09-18, dibatalkan setelah ditinjau.
 */
class CodLabelContractTest extends TestCase
{
    use RefreshDatabase;

    private function buatAdmin(): User
    {
        return User::factory()->create(["role" => "admin", "status" => "active"]);
    }

    public function test_kpi_cod_pakai_nama_keadaan_barang(): void
    {
        $report = app(StorePerformanceService::class)->build("today");

        $paymentKpis = collect($report["sections"])
            ->firstWhere("key", "payments")["kpis"] ?? [];
        $cod = collect($paymentKpis)->firstWhere("key", "cod_paid");

        $this->assertNotNull($cod, "KPI cod_paid wajib ada di section Pembayaran");
        $this->assertSame("COD Selesai", $cod["label"]);
    }

    public function test_label_cod_tidak_memakai_istilah_uang(): void
    {
        $report = app(StorePerformanceService::class)->build("today");

        $labels = [];
        foreach ($report["sections"] as $section) {
            foreach ($section["kpis"] as $kpi) {
                $labels[$kpi["key"]] = (string) $kpi["label"];
            }
        }

        // Satu konsep, satu nama: tidak boleh bercabang ke istilah uang.
        foreach (["COD Dibayar", "COD Cair", "COD Sudah Cair", "COD belum cair"] as $terlarang) {
            $this->assertNotContains(
                $terlarang,
                $labels,
                "Label COD wajib menyatakan keadaan barang, bukan uang."
            );
        }

        $this->assertSame("COD Selesai", $labels["cod_paid"] ?? null);
    }

    public function test_halaman_performa_toko_memakai_label_cod_selesai(): void
    {
        $admin = $this->buatAdmin();

        $this->actingAs($admin)
            ->get(route("admin.analytics.store-performance", ["period" => "today"]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component("Admin/Analytics/StorePerformance")
                ->where("report.sections", function ($sections) {
                    $payments = collect($sections)->firstWhere("key", "payments");

                    return collect($payments["kpis"])->firstWhere("key", "cod_paid")["label"] === "COD Selesai";
                }));
    }
}
