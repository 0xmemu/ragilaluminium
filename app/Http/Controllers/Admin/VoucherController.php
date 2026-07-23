<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\StoreVoucher;
use App\Services\VoucherService;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class VoucherController extends Controller
{
    public function __construct(protected VoucherService $vouchers)
    {
    }

    public function index(Request $request): Response
    {
        $view = $request->input('view') === 'grid' ? 'grid' : 'list';
        $status = (string) $request->input('status', 'all');
        $q = trim((string) $request->input('q', ''));

        $vouchers = StoreVoucher::query()
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($inner) use ($q) {
                    $inner->where('name', 'like', "%{$q}%")
                        ->orWhere('code', 'like', "%{$q}%");
                });
            })
            ->when($status === 'active', fn ($query) => $query->where('published', true))
            ->when($status === 'inactive', fn ($query) => $query->where('published', false))
            ->orderByDesc('published')
            ->orderByDesc('updated_at')
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/Vouchers/Index', [
            'title' => 'Voucher Toko',
            'description' => 'Kelola kode voucher checkout. Hanya satu voucher yang boleh aktif (published) dalam satu waktu.',
            'viewMode' => $view,
            'searchQuery' => $q,
            'activeStatus' => in_array($status, ['active', 'inactive', 'all'], true) ? $status : 'all',
            'vouchers' => $vouchers->getCollection()->map(fn (StoreVoucher $v) => $this->card($v))->values()->all(),
            'pagination' => InertiaAdmin::pagination($vouchers),
            'createHref' => route('admin.vouchers.create'),
            'summary' => [
                'active_count' => StoreVoucher::query()->where('published', true)->count(),
                'total_count' => StoreVoucher::query()->count(),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Vouchers/Form', [
            'voucher' => null,
            'submitUrl' => route('admin.vouchers.store'),
            'method' => 'post',
            'indexHref' => route('admin.vouchers.index'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validateVoucher($request);
        $userId = (int) $request->user()->id;

        $voucher = StoreVoucher::create([
            ...$validated,
            'code' => Str::upper($validated['code']),
            'created_by_user_id' => $userId,
            'updated_by_user_id' => $userId,
            'published' => false,
        ]);

        if ($request->boolean('publish_now')) {
            $this->vouchers->publishExclusive($voucher);
        }

        return redirect()->route('admin.vouchers.index')
            ->with('success', 'Voucher toko dibuat.');
    }

    public function edit(StoreVoucher $voucher): Response
    {
        return Inertia::render('Admin/Vouchers/Form', [
            'voucher' => $this->card($voucher),
            'submitUrl' => route('admin.vouchers.update', $voucher),
            'method' => 'put',
            'indexHref' => route('admin.vouchers.index'),
        ]);
    }

    public function update(Request $request, StoreVoucher $voucher): RedirectResponse
    {
        $validated = $this->validateVoucher($request, $voucher);

        $voucher->update([
            ...$validated,
            'code' => Str::upper($validated['code']),
            'updated_by_user_id' => (int) $request->user()->id,
        ]);

        if ($request->boolean('publish_now')) {
            $this->vouchers->publishExclusive($voucher->fresh());
        }

        return redirect()->route('admin.vouchers.index')
            ->with('success', 'Voucher toko diperbarui.');
    }

    public function publish(StoreVoucher $voucher): RedirectResponse
    {
        $this->vouchers->publishExclusive($voucher);

        return redirect()->back()->with('success', 'Voucher diaktifkan. Voucher lain dinonaktifkan.');
    }

    public function unpublish(StoreVoucher $voucher): RedirectResponse
    {
        $this->vouchers->unpublish($voucher);

        return redirect()->back()->with('success', 'Voucher dinonaktifkan.');
    }

    /** @return array<string, mixed> */
    private function validateVoucher(Request $request, ?StoreVoucher $existing = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => [
                'required',
                'string',
                'max:40',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('store_vouchers', 'code')->ignore($existing?->id),
            ],
            'discount_type' => ['required', 'in:percent,fixed'],
            'discount_value' => [
                'required',
                'numeric',
                'min:0.01',
                Rule::when($request->input('discount_type') === 'percent', ['max:100']),
            ],
            'min_purchase' => ['nullable', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'publish_now' => ['sometimes', 'boolean'],
        ]);

        unset($validated['publish_now']);
        $validated['min_purchase'] = (float) ($validated['min_purchase'] ?? 0);

        return $validated;
    }

    /** @return array<string, mixed> */
    private function card(StoreVoucher $voucher): array
    {
        return [
            'id' => $voucher->id,
            'name' => $voucher->name,
            'code' => $voucher->code,
            'discount_type' => $voucher->discount_type,
            'discount_value' => (float) $voucher->discount_value,
            'min_purchase' => (float) $voucher->min_purchase,
            'starts_at' => optional($voucher->starts_at)?->toIso8601String(),
            'ends_at' => optional($voucher->ends_at)?->toIso8601String(),
            'published' => (bool) $voucher->published,
            'runnable' => $voucher->isCurrentlyRunnable(),
            'updated_at' => optional($voucher->updated_at)?->toIso8601String(),
            'edit_href' => route('admin.vouchers.edit', $voucher),
            'publish_url' => route('admin.vouchers.publish', $voucher),
            'unpublish_url' => route('admin.vouchers.unpublish', $voucher),
        ];
    }
}
