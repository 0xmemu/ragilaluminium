<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Kontrak skrip pemantauan server (owner 2026-09-28).
 *
 * Latar: 20 sampai 22 Agustus 2026 dibuat 26 skrip pemantauan di server, tetapi
 * semuanya HANYA ada di /root tanpa versi, tanpa test, tanpa tinjauan. Akibatnya
 * empat dari enam alert terakhir ternyata kesalahan alat pemeriksa sendiri:
 * rumus audit lupa menghitung asuransi, harapan smoke test keliru (menuntut 200
 * padahal keranjang kosong memang 302), dan data uji kotor. Skrip juga memakai
 * penanda yang tidak dikosongkan saat sukses sehingga kegagalan sesaat menempel
 * 24 hari.
 *
 * Test ini menjaga tiga hal yang paling menentukan:
 * 1. Semua skrip pantau ada di repo (ber-versi), bukan hanya di server.
 * 2. Sintaksnya sah (bash -n / python compile) supaya tidak pernah diam-diam rusak.
 * 3. Skrip pembuat penanda WAJIB mengosongkan penandanya saat sukses, dan
 *    agregator wajib memisahkan alert kritis (ke Telegram) dari catatan teknis
 *    (ke log saja).
 */
class MonitoringScriptsContractTest extends TestCase
{
    private const DIR = 'scripts/prod/monitoring';

    /** Skrip yang membuat penanda ALERT-*; wajib punya pengosong saat sukses. */
    private const PEMBUAT_PENANDA = [
        'scripts_semantic_audit.sh',
        'scripts_db_live_health.sh',
        'scripts_smoke_test.sh',
        'scripts_backup_mysql_binlog.sh',
        'scripts_weekly_restore_test.sh',
        'scripts_drill_pitr.sh',
        'scripts_drill_archive.sh',
    ];

    /** @return list<string> */
    private function berkasShell(): array
    {
        $daftar = [];
        foreach (scandir(base_path(self::DIR)) as $nama) {
            if (str_ends_with($nama, '.sh') || str_ends_with($nama, '.bash')) {
                $daftar[] = $nama;
            }
        }
        sort($daftar);

        return $daftar;
    }

    /** @return list<string> */
    private function berkasPython(): array
    {
        $daftar = [];
        foreach (scandir(base_path(self::DIR)) as $nama) {
            if (str_ends_with($nama, '.py')) {
                $daftar[] = $nama;
            }
        }
        sort($daftar);

        return $daftar;
    }

    public function test_skrip_pantau_tersimpan_di_repo_bukan_hanya_di_server(): void
    {
        $this->assertDirectoryExists(base_path(self::DIR));

        $shell = $this->berkasShell();
        $python = $this->berkasPython();

        // 26 skrip server dipindahkan 2026-09-28; jangan sampai berkurang
        // tanpa disadari (berkas hilang = kembali tak ber-versi).
        $this->assertGreaterThanOrEqual(20, count($shell) + count($python),
            'Jumlah skrip pantau di repo menyusut dari yang dipindahkan.');

        foreach (self::PEMBUAT_PENANDA as $nama) {
            $this->assertFileExists(base_path(self::DIR).'/'.$nama,
                "Skrip pembuat penanda {$nama} hilang dari repo.");
        }

        $this->assertFileExists(base_path('scripts/prod/alert-aggregator.sh'));
    }

    public function test_sintaks_setiap_skrip_shell_sah(): void
    {
        foreach ($this->berkasShell() as $nama) {
            $path = base_path(self::DIR).'/'.$nama;
            $keluaran = [];
            $kode = 0;
            exec('bash -n '.escapeshellarg($path).' 2>&1', $keluaran, $kode);

            $this->assertSame(0, $kode,
                "Sintaks bash rusak pada {$nama}:\n".implode("\n", $keluaran));
        }
    }

    public function test_sintaks_setiap_skrip_python_sah(): void
    {
        foreach ($this->berkasPython() as $nama) {
            $path = base_path(self::DIR).'/'.$nama;
            $keluaran = [];
            $kode = 0;
            // compile() tidak menulis berkas, hanya memeriksa sintaks.
            exec('python3 -c '.escapeshellarg('import sys; compile(open(sys.argv[1]).read(), sys.argv[1], "exec")')
                .' '.escapeshellarg($path).' 2>&1', $keluaran, $kode);

            $this->assertSame(0, $kode,
                "Sintaks python rusak pada {$nama}:\n".implode("\n", $keluaran));
        }
    }

    public function test_skrip_pembuat_penanda_mengosongkan_penandanya_saat_sukses(): void
    {
        foreach (self::PEMBUAT_PENANDA as $nama) {
            $isi = file_get_contents(base_path(self::DIR).'/'.$nama);

            $this->assertStringContainsString('ALERT=', $isi,
                "{$nama} tidak menyentuh penanda sama sekali.");

            // Inilah akar alert menempel 24 hari: penanda dibuat saat gagal
            // tetapi tidak pernah dihapus saat berhasil.
            $this->assertMatchesRegularExpression('/rm -f\s+"\$ALERT"/', $isi,
                "{$nama} tidak mengosongkan penandanya saat sukses; kegagalan sesaat akan menempel berhari-hari.");
        }
    }

    public function test_agregator_memisahkan_kritis_dari_catatan_teknis(): void
    {
        $isi = file_get_contents(base_path('scripts/prod/alert-aggregator.sh'));

        // Hanya masalah berdampak pelanggan atau uang yang dikirim ke Telegram.
        foreach (['HTTP_MATI', 'WA_PUTUS', 'TUNNEL_MATI', 'QUEUE_TUMPUK', 'DISK_DARURAT', 'RAM_DARURAT', 'LAYANAN:'] as $kode) {
            $this->assertStringContainsString($kode, $isi,
                "Kode kritis {$kode} hilang dari agregator.");
        }

        // Alert teknis cukup ke log: harus ada jalur "catatan teknis" yang
        // TIDAK masuk pesan Telegram.
        $this->assertStringContainsString('catatan teknis', $isi,
            'Agregator tidak punya jalur log-saja untuk alert teknis.');

        // Pesan wajib bisa ditindaklanjuti: arti, dampak, tindakan.
        foreach (['Artinya', 'Dampak', 'Tindakan'] as $bagian) {
            $this->assertStringContainsString($bagian, $isi,
                "Pesan kritis kehilangan bagian {$bagian} sehingga tidak bisa ditindaklanjuti owner.");
        }

        // Penyembuhan mandiri harus ada sebelum penilaian.
        foreach (['systemctl restart', 'docker start', '/connect', 'self-heal'] as $tindakan) {
            $this->assertStringContainsString($tindakan, $isi,
                "Agregator kehilangan langkah penyembuhan mandiri: {$tindakan}.");
        }

        // Dedupe berbasis kode stabil, bukan kalimat yang memuat angka berubah.
        $this->assertStringContainsString("\$KODE", $isi,
            'Dedupe agregator tidak memakai kode jenis; alert akan terkirim berulang.');
    }

    /**
     * Salinan cadangan di R2 mengandung identitas pelanggan (nama, nomor HP,
     * email, alamat), jadi wajib dienkripsi. Berkas lokal tetap polos supaya
     * rantai pemulihan tidak berubah.
     */
    public function test_salinan_cadangan_di_r2_dienkripsi_dan_bisa_dibuka(): void
    {
        $kripto = file_get_contents(base_path(self::DIR).'/scripts_backup_crypto.py');
        $this->assertStringContainsString('openssl', $kripto);
        $this->assertStringContainsString('aes-256-cbc', $kripto);
        $this->assertStringContainsString('/root/backups/.backup-key', $kripto,
            'Modul enkripsi tidak menunjuk berkas kunci yang disepakati.');

        // Alat dekripsi wajib ada; tanpa ini cadangan terenkripsi tidak bisa dibuka.
        $this->assertFileExists(base_path(self::DIR).'/scripts_decrypt_backup.sh');
        $dekripsi = file_get_contents(base_path(self::DIR).'/scripts_decrypt_backup.sh');
        $this->assertStringContainsString('openssl enc -d', $dekripsi);

        // Kedua pengunggah wajib memakai modul enkripsi.
        foreach (['scripts_r2_upload_backup.py', 'scripts_archive_mysql.py'] as $nama) {
            $isi = file_get_contents(base_path(self::DIR).'/'.$nama);
            $this->assertStringContainsString('scripts_backup_crypto', $isi,
                "{$nama} tidak memakai modul enkripsi.");
        }
    }

    /** Trafik dan bandwidth wajib terukur dan terjaga. */
    public function test_trafik_dan_bandwidth_dipantau(): void
    {
        $this->assertFileExists(base_path(self::DIR).'/scripts_traffic_check.sh');
        $trafik = file_get_contents(base_path(self::DIR).'/scripts_traffic_check.sh');
        $this->assertStringContainsString('access.log', $trafik);
        $this->assertStringContainsString('curl', $trafik,
            'Skrip trafik tidak menyaring permintaan internal, angka pengunjung akan menggelembung.');

        $agregator = file_get_contents(base_path('scripts/prod/alert-aggregator.sh'));
        // Ujian keterjangkauan dari luar: satu-satunya ujian yang membuktikan
        // pelanggan bisa membuka situs (internal lulus walau tunnel/DNS rusak).
        $this->assertStringContainsString('SITUS_TAK_TERJANGKAU', $agregator);
        $this->assertStringContainsString('https://ra.333labs.tech', $agregator);
        $this->assertStringContainsString('BANDWIDTH_TINGGI', $agregator);
    }
}
