<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Support\InertiaAdmin;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AnnouncementController extends Controller
{
    public function index(Request $request): Response
    {
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));

        $announcements = Announcement::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('text', 'like', "%{$q}%")
                        ->orWhere('href', 'like', "%{$q}%");
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('published', true))
            ->when($status === 'inactive', fn ($query) => $query->where('published', false))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Announcements/Index', [
            'title' => 'Bar Promo',
            'description' => 'Kelola teks promo pada bar merah di atas header. Item teratas yang aktif dan masih dalam periode akan tampil.',
            'searchQuery' => $q,
            'activeStatus' => in_array($status, ['active', 'inactive'], true) ? $status : 'all',
            'announcements' => $announcements->getCollection()
                ->map(fn (Announcement $a) => $this->card($a))
                ->values()
                ->all(),
            'pagination' => InertiaAdmin::pagination($announcements),
            'createHref' => route('admin.announcements.create'),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Announcements/Form', [
            'announcement' => null,
            'submitUrl' => route('admin.announcements.store'),
            'method' => 'post',
            'indexHref' => route('admin.announcements.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateItem($request);

        Announcement::create($validated);

        return redirect()->route('admin.announcements.index')->with('success', 'Bar promo dibuat.');
    }

    public function edit(Announcement $announcement): Response
    {
        return Inertia::render('Admin/Announcements/Form', [
            'announcement' => $this->card($announcement),
            'submitUrl' => route('admin.announcements.update', $announcement),
            'method' => 'put',
            'indexHref' => route('admin.announcements.index'),
        ]);
    }

    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $validated = $this->validateItem($request);

        $announcement->update($validated);

        return redirect()->route('admin.announcements.index')->with('success', 'Bar promo diperbarui.');
    }

    public function unpublish(Announcement $announcement): RedirectResponse
    {
        $announcement->update(['published' => false]);

        return redirect()->route('admin.announcements.index')->with('success', 'Bar promo dinonaktifkan.');
    }

    public function publish(Announcement $announcement): RedirectResponse
    {
        $announcement->update(['published' => true]);

        return redirect()->route('admin.announcements.index')->with('success', 'Bar promo diaktifkan.');
    }

    /**
     * @return array{
     *     text: string,
     *     href: string|null,
     *     starts_at: string|null,
     *     ends_at: string|null,
     *     sort_order: int,
     *     published: bool,
     * }
     */
    private function validateItem(Request $request): array
    {
        $data = $request->validate([
            'text' => ['required', 'string', 'max:64'],
            'href' => ['nullable', 'string', 'max:255', 'starts_with:/,http://,https://'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'published' => ['boolean'],
        ]);

        if (filled($data['starts_at']) && filled($data['ends_at'])) {
            $starts = Carbon::parse($data['starts_at']);
            $ends = Carbon::parse($data['ends_at']);
            if ($ends->lt($starts)) {
                throw ValidationException::withMessages([
                    'ends_at' => 'Tanggal berakhir harus sama atau setelah tanggal mulai.',
                ]);
            }
        }

        $href = trim((string) ($data['href'] ?? ''));
        if ($href !== '') {
            // Internal absolute URLs (mis. hasil route()) disederhanakan jadi path relatif
            // agar tetap benar saat domain publik berganti.
            $appUrl = rtrim((string) config('app.url'), '/');
            if (str_starts_with($href, $appUrl)) {
                $href = substr($href, strlen($appUrl));
            }
        }
        $data['href'] = $href === '' ? null : $href;
        $data['starts_at'] = filled($data['starts_at'] ?? null) ? $data['starts_at'] : null;
        $data['ends_at'] = filled($data['ends_at'] ?? null) ? $data['ends_at'] : null;
        $data['sort_order'] = (int) ($data['sort_order'] ?? 0);
        $data['published'] = (bool) ($data['published'] ?? false);

        return $data;
    }

    /**
     * @return array<string, mixed>
     */
    private function card(Announcement $announcement): array
    {
        return [
            'id' => $announcement->id,
            'text' => $announcement->text,
            'href' => $announcement->href,
            'starts_at' => $announcement->starts_at?->toDateString(),
            'ends_at' => $announcement->ends_at?->toDateString(),
            'sort_order' => $announcement->sort_order,
            'published' => $announcement->published,
            'created_at' => $announcement->created_at?->toISOString(),
            'updated_at' => $announcement->updated_at?->toISOString(),
            'edit_href' => route('admin.announcements.edit', $announcement),
            'publish_url' => route('admin.announcements.publish', $announcement),
            'unpublish_url' => route('admin.announcements.unpublish', $announcement),
        ];
    }
}
