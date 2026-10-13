<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Cache statis CmsSettings bertahan antar tes di dalam satu proses,
        // sedangkan RefreshDatabase mengganti isi database. Tanpa reset ini tes
        // berikutnya membaca halaman lama yang sudah tidak ada. Pada request
        // nyata properti statis hilang sendiri setiap kali, jadi ini meniru
        // kondisi sebenarnya.
        \App\Support\CmsSettings::forgetPage();
    }
}
