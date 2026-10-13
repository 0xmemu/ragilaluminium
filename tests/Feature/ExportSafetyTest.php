<?php

namespace Tests\Feature;

use App\Exports\CorrectionFileExport;
use App\Support\ExportSafety;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ExportSafetyTest extends TestCase
{
    public function test_csv_formula_cells_are_prefixed_without_changing_numeric_cells(): void
    {
        $this->assertSame("'=SUM(A1:A2)", ExportSafety::cell('=SUM(A1:A2)'));
        $this->assertSame("'@customer", ExportSafety::cell('@customer'));
        $this->assertSame(1000000, ExportSafety::cell(1000000));
    }

    public function test_export_row_limit_is_enforced(): void
    {
        config(['operations.export_max_rows' => 2]);

        $this->expectException(ValidationException::class);

        ExportSafety::assertCountWithinLimit(3);
    }

    public function test_correction_export_sanitizes_raw_values_and_headings(): void
    {
        $export = new CorrectionFileExport(new Collection([
            (object) [
                'raw_data' => ['=danger' => '=SUM(A1:A2)'],
                'error_reason' => '@reason',
            ],
        ]));

        $this->assertSame(["'=danger", 'error_reason'], $export->headings());
        $this->assertSame(["'=SUM(A1:A2)", "'@reason"], $export->map($export->collection()->first()));
    }
}
