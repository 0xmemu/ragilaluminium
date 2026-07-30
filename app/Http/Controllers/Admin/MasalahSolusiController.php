<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CmsProblemSolution;
use App\Services\ActivityLogService;
use App\Support\ProblemsSolutionsSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MasalahSolusiController extends Controller
{
    public function index(Request $request): Response
    {
        $q = trim((string) $request->input('q', ''));

        return Inertia::render('Admin/MasalahSolusi/Index', [
            'title' => 'Masalah & Solusi',
            'description' => 'Kelola pasangan kendala pelanggan dan rekomendasi solusi untuk halaman publik.',
            'filters' => ['q' => $q],
            'rows' => ProblemsSolutionsSettings::adminRows($q !== '' ? $q : null),
            'pageMeta' => ProblemsSolutionsSettings::pageMeta(),
            'createHref' => route('admin.masalah-solusi.create'),
            'reorderUrl' => route('admin.masalah-solusi.reorder'),
            'metaUrl' => route('admin.masalah-solusi.meta.update'),
            'previewUrl' => route('masalah-dan-solusi'),
        ]);
    }

    public function updateMeta(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'heading' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:320'],
            'published' => ['boolean'],
        ]);
        $validated['published'] = $validated['published'] ?? false;

        ProblemsSolutionsSettings::updatePageMeta($validated, $request->user()?->id);

        ActivityLogService::record(
            'cms.masalah_solusi_meta_updated',
            'cms_page',
            ProblemsSolutionsSettings::pageId(),
            ['heading' => $validated['heading']],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.masalah-solusi.index')
            ->with('success', 'Meta halaman Masalah & Solusi disimpan.');
    }

    public function create(): Response
    {
        return Inertia::render('Admin/MasalahSolusi/Form', [
            'item' => null,
            'submitUrl' => route('admin.masalah-solusi.store'),
            'indexUrl' => route('admin.masalah-solusi.index'),
            'method' => 'post',
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request, null);
        $validated['cms_page_id'] = ProblemsSolutionsSettings::pageId();
        $validated['sort_order'] = $validated['sort_order']
            ?? ((int) CmsProblemSolution::query()->where('cms_page_id', $validated['cms_page_id'])->max('sort_order') + 1);

        $item = CmsProblemSolution::create($validated);

        ActivityLogService::record(
            'cms.masalah_solusi_created',
            'cms_problem_solution',
            (int) $item->id,
            ['problem' => mb_substr($item->problem, 0, 80)],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.masalah-solusi.index')
            ->with('success', 'Masalah & solusi ditambahkan.');
    }

    public function edit(CmsProblemSolution $masalahSolusi): Response
    {
        return Inertia::render('Admin/MasalahSolusi/Form', [
            'item' => array_merge(
                [
                    'id' => $masalahSolusi->id,
                    'problem' => $masalahSolusi->problem,
                    'sort_order' => $masalahSolusi->sort_order,
                ],
                ProblemsSolutionsSettings::parseForAdmin($masalahSolusi->solution),
            ),
            'submitUrl' => route('admin.masalah-solusi.update', $masalahSolusi),
            'indexUrl' => route('admin.masalah-solusi.index'),
            'method' => 'put',
        ]);
    }

    public function update(Request $request, CmsProblemSolution $masalahSolusi): RedirectResponse
    {
        $masalahSolusi->update($this->validated($request, $masalahSolusi->solution));

        ActivityLogService::record(
            'cms.masalah_solusi_updated',
            'cms_problem_solution',
            (int) $masalahSolusi->id,
            ['problem' => mb_substr($masalahSolusi->problem, 0, 80)],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.masalah-solusi.index')
            ->with('success', 'Masalah & solusi diperbarui.');
    }

    public function destroy(Request $request, CmsProblemSolution $masalahSolusi): RedirectResponse
    {
        $id = (int) $masalahSolusi->id;
        $preview = mb_substr($masalahSolusi->problem, 0, 80);
        $masalahSolusi->delete();

        ActivityLogService::record(
            'cms.masalah_solusi_deleted',
            'cms_problem_solution',
            $id,
            ['problem' => $preview],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.masalah-solusi.index')
            ->with('success', 'Masalah & solusi dihapus.');
    }

    public function reorder(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1'],
            'rows.*.id' => ['required', 'integer', 'exists:cms_problems_solutions,id'],
            'rows.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        ProblemsSolutionsSettings::reorder($validated['rows']);

        ActivityLogService::record(
            'cms.masalah_solusi_reordered',
            'cms_page',
            ProblemsSolutionsSettings::pageId(),
            ['count' => count($validated['rows'])],
            $request->user()?->id,
        );

        return redirect()
            ->route('admin.masalah-solusi.index')
            ->with('success', 'Urutan Masalah & Solusi disimpan.');
    }

    /** @return array<string, mixed> */
    protected function validated(Request $request, ?string $existingSolution = null): array
    {
        $request->validate([
            'problem' => ['required', 'string', 'max:2000'],
            'solution_body' => ['nullable', 'string', 'max:10000'],
            'examples_label' => ['nullable', 'string', 'max:120'],
            'examples_hint' => ['nullable', 'string', 'max:500'],
            'existing_photos' => ['nullable', 'string'],
            'photo_files' => ['nullable', 'array'],
            'photo_files.*' => ['image', 'max:5120'],
            'photo_alts' => ['nullable', 'array'],
            'photo_alts.*' => ['nullable', 'string', 'max:200'],
            'video_url' => ['nullable', 'string', 'max:2048'],
            'video_duration' => ['nullable', 'string', 'max:20'],
            'video_poster' => ['nullable', 'image', 'max:5120'],
            'remove_video_poster' => ['boolean'],
            'solutions_label' => ['nullable', 'string', 'max:120'],
            'solution_lead' => ['nullable', 'string', 'max:500'],
            'use_options' => ['boolean'],
            'solution_options' => ['nullable', 'string'],
            'whatsapp_note' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        return [
            'problem' => trim((string) $request->input('problem')),
            'solution' => ProblemsSolutionsSettings::buildSolutionFromRequest($request, $existingSolution),
            'sort_order' => $request->filled('sort_order') ? (int) $request->input('sort_order') : null,
        ];
    }
}
