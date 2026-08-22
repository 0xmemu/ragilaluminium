<?php

namespace App\Support;

use App\Models\CmsPage;

/**
 * CmsSettings — seam generik untuk pengaturan toko yang disimpan di cms_pages.
 *
 * Banyak kelas \*Settings (AnnouncementSlide, CaraPemesanan, FlashSale, dst.) mengulang
 * boilerplate yang sama: membaca CmsPage by slug, membuat page bila belum ada, dan
 * menulis content dengan merge. Kandidat-A refactor (docs/plans/cms-settings-refactor-plan.md)
 * mengekstrak operasi CMS generik itu ke sini supaya tiap Settings hanya tinggal
 * mendefinisikan slug + defaults + logika bisnis uniknya.
 *
 * Pola subkelas wajib:
 *   - const PAGE_SLUG        : slug cms_pages tempat settings disimpan.
 *   - const DEFAULTS         : nilai default bila content kosong.
 *   - protected static key() : kunci array di dalam content yang dipakai modul
 *                              (mis. 'slide', 'faq', 'flash_sale'). DEFAULT: null -> seluruh content.
 *
 * Catatan penting (dari grilling, jangan disamakan buta):
 *   - Beberapa Settings punya varian page($create), reorder(), mergePreserving() — biarkan
 *     modul besar tersebut OVVERRIDE perilaku ini; base hanya untuk kasus seragam.
 *   - Deletion test: boilerplate CMS dipindah ke satu seam (menjadi lebih dalam), bukan
 *     aturan bisnis unik. Aturan unik tetap di subkelas.
 *
 * @see docs/plans/cms-settings-refactor-plan.md
 */
abstract class CmsSettings
{
    public const PAGE_SLUG = '';

    public const DEFAULTS = [];

    /** Kunci array dalam content; null berarti seluruh content adalah payload modul. */
    public const CONTENT_KEY = null;

    /**
     * Ambil CmsPage untuk slug ini (tanpa membuat).
     */
    protected static function page(): ?CmsPage
    {
        if (static::PAGE_SLUG === '') {
            return null;
        }

        return CmsPage::query()->where('slug', static::PAGE_SLUG)->first();
    }

    /**
     * Pastikan CmsPage ada; buat jika belum (path create-first-time).
     */
    protected static function ensurePage(): CmsPage
    {
        $page = static::page();
        if ($page !== null) {
            return $page;
        }

        return CmsPage::create([
            'slug' => static::PAGE_SLUG,
            'title' => ucwords(str_replace('-', ' ', static::PAGE_SLUG)),
            'content' => [],
            'published' => true,
        ]);
    }

    /**
     * Baca payload mentah dari content page (sebelum normalisasi default).
     *
     * @return array<string, mixed>
     */
    protected static function readPayload(?CmsPage $page = null): array
    {
        $page = $page ?? static::page();
        $content = is_array($page?->content) ? $page->content : [];
        if (static::CONTENT_KEY !== null) {
            $content = is_array($content[static::CONTENT_KEY] ?? null)
                ? $content[static::CONTENT_KEY]
                : [];
        }

        return $content;
    }

    /**
     * Gabungkan payload ke content page (preserve key lain), lalu simpan.
     * Buat page baru jika belum ada.
     */
    protected static function writePayload(array $payload, ?string $fallbackTitle = null): CmsPage
    {
        $page = static::page();
        $content = [];

        if ($page !== null) {
            $content = is_array($page->content) ? $page->content : [];
        }

        if (static::CONTENT_KEY !== null) {
            $existing = is_array($content[static::CONTENT_KEY] ?? null)
                ? $content[static::CONTENT_KEY]
                : [];
            $merged = array_merge($existing, $payload);
            $content[static::CONTENT_KEY] = $merged;
        } else {
            $content = array_merge($content, $payload);
        }

        if ($page === null) {
            $page = CmsPage::create([
                'slug' => static::PAGE_SLUG,
                'title' => $fallbackTitle ?? ucwords(str_replace('-', ' ', static::PAGE_SLUG)),
                'content' => $content,
                'published' => true,
            ]);
        } else {
            $page->update(['content' => $content]);
        }

        return $page;
    }

    /**
     * Nilai default fusioned (patokan DEFAULTS + payload tersimpan).
     *
     * @return array<string, mixed>
     */
    protected static function resolved(): array
    {
        return array_merge(static::DEFAULTS, static::readPayload());
    }
}