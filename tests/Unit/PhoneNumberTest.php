<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Support\OrderTrackingViewModel;
use App\Support\PhoneNumber;
use Tests\TestCase;

/**
 * Kontrak format nomor telepon (owner 2026-09-27):
 * - Semua nomor yang terpampang diperlihatkan ke pelanggan atau input pelanggan
 *   berformat 08xxx (bukan 62xxx atau +62xxx).
 * - Backend tetap menormalisasi ke format E.164 (62xxx) untuk database,
 *   WhatsApp API, dan J&T API.
 */
class PhoneNumberTest extends TestCase
{
    public function test_to_local_mengubah_awalan_62_ke_08(): void
    {
        $this->assertSame('085725116817', PhoneNumber::toLocal('6285725116817'));
        $this->assertSame('085725116817', PhoneNumber::toLocal('+62 857-2511-6817'));
        $this->assertSame('085725116817', PhoneNumber::toLocal('085725116817'));
        $this->assertSame('0881080733754', PhoneNumber::toLocal('62881080733754'));
        $this->assertNull(PhoneNumber::toLocal(null));
        $this->assertNull(PhoneNumber::toLocal(''));
    }

    public function test_normalize_tetap_menghasilkan_62_untuk_kebutuhan_backend(): void
    {
        $this->assertSame('6285725116817', PhoneNumber::normalize('085725116817'));
        $this->assertSame('6285725116817', PhoneNumber::normalize('+62 857-2511-6817'));
        $this->assertSame('6285725116817', PhoneNumber::normalize('6285725116817'));
    }

    public function test_format_display_pelanggan_selalu_berawalan_08_bukan_62(): void
    {
        $this->assertSame('0857-2511-6817', PhoneNumber::formatDisplay('6285725116817'));
        $this->assertSame('0857-2511-6817', PhoneNumber::formatDisplay('+62 857-2511-6817'));
        $this->assertSame('0857-2511-6817', PhoneNumber::formatDisplay('085725116817'));
        $this->assertSame('0881-0807-33754', PhoneNumber::formatDisplay('62881080733754'));
        $this->assertSame('0812-3456-7890', PhoneNumber::formatDisplay('081234567890'));
        $this->assertStringStartsNotWith('62', (string) PhoneNumber::formatDisplay('6285725116817'));
        $this->assertStringStartsNotWith('+62', (string) PhoneNumber::formatDisplay('6285725116817'));
    }

    public function test_phone_masked_lacak_pesanan_memakai_format_08xxx(): void
    {
        $order = new Order([
            'order_number' => 'RA-TEST-01',
            'customer_name' => 'Budi Santoso',
            'customer_phone' => '6285725116817',
            'shipping_city' => 'Kudus',
            'shipping_province' => 'Jawa Tengah',
        ]);

        $vm = new OrderTrackingViewModel($order);
        $recipient = $vm->recipient();

        // Wajib 0857••••17, DILARANG 628••••17
        $this->assertSame('0857••••17', $recipient['phoneMasked']);
        $this->assertStringStartsWith('08', $recipient['phoneMasked']);
        $this->assertStringStartsNotWith('62', $recipient['phoneMasked']);
    }
}
