<?php

namespace Tests\Feature;

use App\Support\UrlGuard;
use RuntimeException;
use Tests\TestCase;

class UrlGuardTest extends TestCase
{
    public function test_unresolvable_hostname_is_rejected_fail_closed(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('tidak dapat di-resolve');

        UrlGuard::assertSafePublicUrl(
            'https://ragil-aluminium-security-test.invalid/image.jpg',
            ['ragil-aluminium-security-test.invalid'],
        );
    }
}
