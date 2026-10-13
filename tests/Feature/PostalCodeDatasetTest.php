<?php

namespace Tests\Feature;

use App\Models\PostalCodeMapping;
use App\Models\PostalDataset;
use App\Services\PostalDatasetImporter;
use App\Support\PostalCodeRepository;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class PostalCodeDatasetTest extends TestCase
{
    use RefreshDatabase;

    public function test_postal_repository_is_unavailable_until_a_version_is_activated(): void
    {
        $result = app(PostalCodeRepository::class)->validate('40132', '3273010001', 'LEBAK GEDE');

        $this->assertSame('unavailable', $result['status']);
        $this->assertNull($result['valid']);
    }

    public function test_import_activates_version_and_validates_village_postal_pair(): void
    {
        $path = storage_path('framework/testing/postal-'.uniqid().'.csv');
        File::ensureDirectoryExists(dirname($path));
        file_put_contents($path, implode("\n", [
            'kode_provinsi,nama_provinsi,kode_kabupaten_kota,nama_kabupaten_kota,kode_kecamatan,nama_kecamatan,kode_desa_kelurahan,nama_desa_kelurahan,kode_pos',
            '32,JAWA BARAT,3273,KOTA BANDUNG,3273010,COBLONG,3273010001,LEBAK GEDE,40132',
            '32,JAWA BARAT,3273,KOTA BANDUNG,3273010,COBLONG,3273010002,SEKELOA,40134',
        ])."\n");

        try {
            $dataset = app(PostalDatasetImporter::class)->import($path, [
                'source' => 'data.go.id',
                'version' => '2026-08',
                'source_url' => config('postal.baseline.source_url'),
                'reference_source' => 'Pos Indonesia',
                'reference_url' => config('postal.baseline.reference_url'),
                'activate' => true,
            ]);

            $this->assertSame('active', $dataset->status);
            $this->assertSame(2, $dataset->row_count);
            $this->assertSame(2, PostalCodeMapping::where('postal_dataset_id', $dataset->id)->count());

            $valid = app(PostalCodeRepository::class)->validate(
                '40132',
                '3273010001',
                'LEBAK GEDE',
                '3273010',
                'COBLONG',
            );
            $this->assertSame('valid', $valid['status']);
            $this->assertTrue($valid['valid']);
            $this->assertSame('2026-08', $valid['dataset_version']);

            // Strategi validasi KECAMATAN: 40134 milik kecamatan COBLONG (walaupun
            // di data itu untuk desa SEKELOA), jadi valid walau kombinasi
            // desa berbeda — beda ejaan/nama desa antar sumber tidak menolak.
            $kecamatan = app(PostalCodeRepository::class)->validate(
                '40134',
                '3273010001',
                'LEBAK GEDE',
                '3273010',
                'COBLONG',
            );
            $this->assertSame('valid', $kecamatan['status']);
            $this->assertTrue($kecamatan['valid']);

            // Kode pos di LUAR kecamatan COBLONG tetap invalid.
            $invalid = app(PostalCodeRepository::class)->validate(
                '40199',
                '3273010001',
                'LEBAK GEDE',
                '3273010',
                'COBLONG',
            );
            $this->assertSame('invalid', $invalid['status']);
            $this->assertFalse($invalid['valid']);
        } finally {
            File::delete($path);
        }
    }

    public function test_checkout_rejects_postal_code_not_matching_active_village(): void
    {
        $dataset = PostalDataset::create([
            'source' => 'data.go.id',
            'version' => 'test-2026',
            'status' => 'active',
            'row_count' => 1,
            'retrieved_at' => now(),
        ]);
        $dataset->mappings()->create([
            'province_id' => '32',
            'province_name' => 'JAWA BARAT',
            'regency_id' => '3273',
            'regency_name' => 'KOTA BANDUNG',
            'district_id' => '3273010',
            'district_name' => 'COBLONG',
            'village_id' => '3273010001',
            'village_name' => 'LEBAK GEDE',
            'postal_code' => '40132',
        ]);

        $this->from('/checkout')->post('/checkout/validate', [
            'name' => 'Budi',
            'phone' => '0812',
            'province' => 'JAWA BARAT',
            'city' => 'KOTA BANDUNG',
            'district' => 'COBLONG',
            'village' => 'LEBAK GEDE',
            'district_id' => '3273010',
            'village_id' => '3273010001',
            'address_line1' => 'Jl A',
            'postal_code' => '40134',
        ])->assertRedirect('/checkout')->assertSessionHasErrors('postal_code');
    }
    public function test_validate_falls_back_to_district_name_when_dataset_has_no_kemendagri_ids(): void
    {
        // Simulasi dataset prod (data.go.id/pentagonal): hanya nama + kode pos,
        // tanpa kode Kemendagri untuk kecamatan/desa (kolom ID NULL).
        $dataset = PostalDataset::create([
            'source' => 'data.go.id/pentagonal',
            'version' => 'test-noid-2026',
            'status' => 'active',
            'row_count' => 2,
            'retrieved_at' => now(),
        ]);
        $dataset->mappings()->create([
            'province_id' => '11', 'province_name' => 'ACEH',
            'regency_id' => null, 'regency_name' => 'ACEH SELATAN',
            'district_id' => null, 'district_name' => 'TRUMON TENGAH',
            'village_id' => null, 'village_name' => 'COT BAYU',
            'postal_code' => '23774',
        ]);
        $dataset->mappings()->create([
            'province_id' => '11', 'province_name' => 'ACEH',
            'regency_id' => null, 'regency_name' => 'ACEH SELATAN',
            'district_id' => null, 'district_name' => 'TRUMON TENGAH',
            'village_id' => null, 'village_name' => 'NACA',
            'postal_code' => '23774',
        ]);

        // Dropdown checkout mengirim ID Kemendagri yang TIDAK ada di dataset:
        // validasi harus jatuh ke nama kecamatan, bukan menolak palsu.
        $valid = app(PostalCodeRepository::class)->validate(
            '23774', '1103082005', 'Cot Bayu', '110308', 'Trumon Tengah',
        );
        $this->assertSame('valid', $valid['status']);
        $this->assertTrue($valid['valid']);

        // Kode pos di luar kecamatan tetap ditolak.
        $invalid = app(PostalCodeRepository::class)->validate(
            '23776', '1103082005', 'Cot Bayu', '110308', 'Trumon Tengah',
        );
        $this->assertSame('invalid', $invalid['status']);
        $this->assertFalse($invalid['valid']);
    }

    public function test_checkout_accepts_postal_when_dataset_has_no_ids(): void
    {
        $dataset = PostalDataset::create([
            'source' => 'data.go.id/pentagonal',
            'version' => 'test-checkout-noid-2026',
            'status' => 'active',
            'row_count' => 1,
            'retrieved_at' => now(),
        ]);
        $dataset->mappings()->create([
            'province_id' => '11', 'province_name' => 'ACEH',
            'regency_id' => null, 'regency_name' => 'ACEH SELATAN',
            'district_id' => null, 'district_name' => 'TRUMON TENGAH',
            'village_id' => null, 'village_name' => 'COT BAYU',
            'postal_code' => '23774',
        ]);

        // Kotak pos 23774 + kecamatan Trumon Tengah (via dropdown dengan ID
        // Kemendagri) harus diterima — kode pos benar milik kecamatan tersebut.
        $this->from('/checkout')->post('/checkout/validate', [
            'name' => 'Budi',
            'phone' => '0812',
            'province' => 'ACEH',
            'city' => 'ACEH SELATAN',
            'district' => 'TRUMON TENGAH',
            'village' => 'COT BAYU',
            'district_id' => '110308',
            'village_id' => '1103082005',
            'address_line1' => 'Jl A',
            'postal_code' => '23774',
        ])->assertRedirect('/checkout')->assertSessionHasNoErrors();
    }

    public function test_village_mapping_feeds_postal_autofill_for_district(): void
    {
        $dataset = PostalDataset::create([
            'source' => 'data.go.id',
            'version' => 'test-autofill-2026',
            'status' => 'active',
            'row_count' => 2,
            'retrieved_at' => now(),
        ]);
        $dataset->mappings()->create([
            'province_id' => '32', 'province_name' => 'JAWA BARAT',
            'regency_id' => '3273', 'regency_name' => 'KOTA BANDUNG',
            'district_id' => '3273010', 'district_name' => 'COBLONG',
            'village_id' => '3273010001', 'village_name' => 'LEBAK GEDE',
            'postal_code' => '40132',
        ]);
        $dataset->mappings()->create([
            'province_id' => '32', 'province_name' => 'JAWA BARAT',
            'regency_id' => '3273', 'regency_name' => 'KOTA BANDUNG',
            'district_id' => '3273010', 'district_name' => 'COBLONG',
            'village_id' => '3273010002', 'village_name' => 'SEKELOA',
            'postal_code' => '40134',
        ]);

        $autofill = app(PostalCodeRepository::class)->postalCodesForDistrict('3273010');

        $this->assertSame(
            ['3273010001' => '40132', '3273010002' => '40134'],
            $autofill,
            'desa harus menjadi sumber autofill kode pos (village_id -> postal_code)',
        );
    }
}
