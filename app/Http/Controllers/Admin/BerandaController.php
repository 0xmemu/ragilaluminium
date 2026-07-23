<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsPage;
use App\Services\ActivityLogService;
use App\Support\HomepageLayoutSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BerandaController extends Controller
{
    public function index(): Response
    {
        $data = HomepageLayoutSettings::get();

        return Inertia::render('Admin/Beranda/Index', [
            'title' => 'Pengaturan Tata Letak Beranda',
            'description' => 'Kelola urutan section dan konten yang tampil di halaman utama toko.',
            'sections' => HomepageLayoutSettings::presentSections($data['sections']),
            'submitUrl' => route('admin.beranda.update'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'sections' => ['required', 'array', 'min:1'],
            'sections.*.key' => ['required', 'string', Rule::in(HomepageLayoutSettings::SECTION_KEYS)],
            'sections.*.enabled' => ['boolean'],
            'sections.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        HomepageLayoutSettings::updateSections(
            $validated['sections'],
            $request->user()?->id,
        );

        ActivityLogService::record(
            'cms.beranda_layout_updated',
            'cms_page',
            $this->berandaPageId(),
            ['sections' => collect($validated['sections'])->pluck('key')->all()],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.beranda.index')
            ->with('success', 'Tata letak beranda disimpan.');
    }

    public function editServiceHighlights(): Response
    {
        $data = HomepageLayoutSettings::get();

        return Inertia::render('Admin/Beranda/ServiceHighlightsForm', [
            'highlights' => $data['service_highlights'],
            'iconOptions' => ['cod', 'shield', 'truck', 'check', 'package', 'star', 'whatsapp'],
            'submitUrl' => route('admin.beranda.service-highlights.update'),
            'indexUrl' => route('admin.beranda.index'),
        ]);
    }

    public function updateServiceHighlights(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:240'],
            'items' => ['required', 'array', 'min:1', 'max:8'],
            'items.*.icon' => ['required', 'string', 'max:32'],
            'items.*.title' => ['required', 'string', 'max:80'],
            'items.*.description' => ['nullable', 'string', 'max:160'],
        ]);

        HomepageLayoutSettings::updateServiceHighlights($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.beranda_service_highlights_updated',
            'cms_page',
            $this->berandaPageId(),
            ['item_count' => count($validated['items'])],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.beranda.index')
            ->with('success', 'Sorotan layanan disimpan.');
    }

    public function editHowToOrder(): Response
    {
        $data = HomepageLayoutSettings::get();

        return Inertia::render('Admin/Beranda/HowToOrderForm', [
            'howToOrder' => $data['how_to_order'],
            'submitUrl' => route('admin.beranda.how-to-order.update'),
            'indexUrl' => route('admin.beranda.index'),
        ]);
    }

    public function updateHowToOrder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:240'],
            'steps' => ['required', 'array', 'min:1', 'max:8'],
            'steps.*.title' => ['required', 'string', 'max:80'],
            'steps.*.description' => ['nullable', 'string', 'max:400'],
        ]);

        HomepageLayoutSettings::updateHowToOrder($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.beranda_how_to_order_updated',
            'cms_page',
            $this->berandaPageId(),
            ['step_count' => count($validated['steps'])],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.beranda.index')
            ->with('success', 'Cara pesan beranda disimpan.');
    }

    protected function berandaPageId(): int
    {
        $id = CmsPage::query()->where('slug', HomepageLayoutSettings::PAGE_SLUG)->value('id');

        return (int) $id;
    }
}
