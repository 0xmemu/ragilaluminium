<?php

namespace Tests\Feature;

use App\Support\FaviconWriter;
use Tests\TestCase;

/**
 * Favicon harus benar-benar ada isinya.
 *
 * File public/images/site-favicon.ico pernah ADA tetapi 0 byte. Karena blade
 * memakai file_exists(), kondisinya lolos dan browser memuat favicon kosong,
 * sehingga favicon tidak pernah muncul di tab.
 *
 * Test ini menjaga dua hal: penjaga di <head> memakai isi file, dan turunan
 * favicon diselaraskan dari satu sumber.
 */
class FaviconContractTest extends TestCase
{
    /** Direktori sementara agar test tidak menyentuh public/ sungguhan. */
    private string $sandbox = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->sandbox = sys_get_temp_dir().'/ragil-favicon-'.uniqid();
        @mkdir($this->sandbox.'/images', 0775, true);
    }

    protected function tearDown(): void
    {
        if ($this->sandbox !== '' && is_dir($this->sandbox)) {
            foreach (glob($this->sandbox.'/*/*') ?: [] as $file) {
                @unlink($file);
            }
            foreach (glob($this->sandbox.'/*') ?: [] as $dir) {
                is_dir($dir) && @rmdir($dir);
            }
            @rmdir($this->sandbox);
        }
        parent::tearDown();
    }

    private function writePng(string $relative, int $size = 128): string
    {
        $path = $this->sandbox.'/'.$relative;
        $image = imagecreatetruecolor($size, $size);
        imagefill($image, 0, 0, imagecolorallocate($image, 160, 0, 0));
        imagepng($image, $path);
        imagedestroy($image);

        return $path;
    }

    public function test_turunan_favicon_dibuat_dari_sumber(): void
    {
        $source = $this->writePng('images/source.png');

        $result = app(FaviconWriter::class)->sync($source, $this->sandbox);

        $this->assertTrue($result);
        foreach ([FaviconWriter::PNG_32, FaviconWriter::PNG_16, FaviconWriter::APPLE_TOUCH] as $relative) {
            $path = $this->sandbox.'/'.$relative;
            $this->assertFileExists($path, "Turunan {$relative} harus dibuat.");
            $this->assertGreaterThan(0, filesize($path), "Turunan {$relative} tidak boleh kosong.");
        }
    }

    public function test_turunan_berukuran_sesuai_kontrak(): void
    {
        $source = $this->writePng('images/source.png');
        app(FaviconWriter::class)->sync($source, $this->sandbox);

        $expected = [
            FaviconWriter::PNG_32 => [32, 32],
            FaviconWriter::PNG_16 => [16, 16],
            FaviconWriter::APPLE_TOUCH => [180, 180],
        ];

        foreach ($expected as $relative => [$width, $height]) {
            $info = getimagesize($this->sandbox.'/'.$relative);
            $this->assertIsArray($info);
            $this->assertSame($width, $info[0], "{$relative} lebar salah.");
            $this->assertSame($height, $info[1], "{$relative} tinggi salah.");
        }
    }

    public function test_apple_touch_tidak_transparan(): void
    {
        $path = $this->sandbox.'/images/source.png';
        // Sumber transparan penuh: apple-touch harus tetap berlatar.
        $image = imagecreatetruecolor(64, 64);
        imagesavealpha($image, true);
        imagefill($image, 0, 0, imagecolorallocatealpha($image, 0, 0, 0, 127));
        imagepng($image, $path);
        imagedestroy($image);

        app(FaviconWriter::class)->sync($path, $this->sandbox);

        $apple = imagecreatefrompng($this->sandbox.'/'.FaviconWriter::APPLE_TOUCH);
        $rgba = imagecolorat($apple, 5, 5);
        $alpha = ($rgba >> 24) & 0x7F;
        imagedestroy($apple);

        $this->assertSame(0, $alpha, 'apple-touch-icon harus berlatar penuh (tidak transparan).');
    }

    public function test_sumber_tidak_terbaca_menghapus_turunan_lama(): void
    {
        // Turunan lama ada.
        $this->writePng(FaviconWriter::PNG_32);
        $this->assertFileExists($this->sandbox.'/'.FaviconWriter::PNG_32);

        // Sumber rusak (bukan gambar).
        $broken = $this->sandbox.'/images/broken.ico';
        file_put_contents($broken, 'bukan gambar sama sekali');

        $result = app(FaviconWriter::class)->sync($broken, $this->sandbox);

        $this->assertFalse($result, 'Sumber tidak terbaca harus melaporkan kegagalan.');
        $this->assertFileDoesNotExist(
            $this->sandbox.'/'.FaviconWriter::PNG_32,
            'Turunan basi harus dihapus agar berkas ICO yang dipakai.',
        );
    }

    public function test_berkas_favicon_produksi_terisi(): void
    {
        // Regresi langsung: kedua .ico pernah 0 byte.
        foreach (['images/site-favicon.ico', 'favicon.ico'] as $relative) {
            $path = public_path($relative);
            $this->assertFileExists($path, "{$relative} harus ada.");
            $this->assertGreaterThan(0, filesize($path), "{$relative} tidak boleh 0 byte.");
        }

        foreach (['images/favicon-32.png', 'images/favicon-16.png', 'apple-touch-icon.png'] as $relative) {
            $path = public_path($relative);
            $this->assertFileExists($path, "{$relative} harus ada.");
            $this->assertGreaterThan(0, filesize($path), "{$relative} tidak boleh kosong.");
        }
    }
}
