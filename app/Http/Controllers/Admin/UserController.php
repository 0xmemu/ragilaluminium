<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AdminAccountCredentials;
use App\Services\ActivityLogService;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /** Canonical Store Admin role (Stage 2 equal-admin). */
    public const STORE_ADMIN_ROLE = 'admin';

    public const STORE_ADMIN_LABEL = 'Admin';

    public function index(Request $request): Response
    {
        $q = trim((string) $request->query('q', ''));
        $status = (string) $request->query('status', '');
        $sort = (string) $request->query('sort', 'newest');

        $query = User::query();

        if ($q !== '') {
            $query->where(function ($builder) use ($q) {
                $builder->where('name', 'like', '%'.$q.'%')
                    ->orWhere('username', 'like', '%'.$q.'%')
                    ->orWhere('email', 'like', '%'.$q.'%');
            });
        }

        if (in_array($status, ['active', 'inactive'], true)) {
            $query->where('status', $status);
        }

        match ($sort) {
            'oldest' => $query->orderBy('id'),
            'name' => $query->orderBy('name')->orderByDesc('id'),
            default => $query->orderByDesc('id'),
        };

        $rows = $query->paginate(20)->withQueryString();
        $actorId = $request->user()?->id;

        return Inertia::render('Admin/Users/Index', [
            'title' => 'Manajemen Admin',
            'description' => 'Kelola akun yang dapat masuk ke panel. Semua admin setara (Stage 2); bedakan akses lewat status aktif/nonaktif.',
            'filters' => [
                'q' => $q,
                'status' => in_array($status, ['active', 'inactive'], true) ? $status : '',
                'sort' => in_array($sort, ['newest', 'oldest', 'name'], true) ? $sort : 'newest',
            ],
            'statusOptions' => [
                ['value' => '', 'label' => 'Semua status'],
                ['value' => 'active', 'label' => 'Aktif'],
                ['value' => 'inactive', 'label' => 'Nonaktif'],
            ],
            'sortOptions' => [
                ['value' => 'newest', 'label' => 'Terbaru'],
                ['value' => 'oldest', 'label' => 'Terlama'],
                ['value' => 'name', 'label' => 'Nama A–Z'],
            ],
            'createHref' => route('admin.users.create'),
            'rows' => $rows->getCollection()->values()->map(function (User $user, int $index) use ($rows, $actorId) {
                $no = (($rows->currentPage() - 1) * $rows->perPage()) + $index + 1;
                $isSelf = $actorId !== null && (int) $user->id === (int) $actorId;

                return [
                    'id' => $user->id,
                    'no' => $no,
                    'name' => $user->name,
                    'username' => $user->username,
                    'email' => $user->email,
                    'status' => $user->status,
                    'is_self' => $isSelf,
                    'created_at' => optional($user->created_at)?->toIso8601String(),
                    'edit_href' => route('admin.users.edit', $user),
                    'activate_url' => route('admin.users.activate', $user),
                    'deactivate_url' => route('admin.users.deactivate', $user),
                ];
            })->all(),
            'pagination' => InertiaAdmin::pagination($rows),
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Users/Form', [
            'user' => null,
            'submitUrl' => route('admin.users.store'),
            'isSelf' => false,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-zA-Z0-9._-]+$/', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);

        $validated['role'] = self::STORE_ADMIN_ROLE;
        $validated['username'] = strtolower(trim((string) $validated['username']));
        $initialPassword = (string) $validated['password'];

        $user = User::create($validated);
        $credentialsDelivered = false;
        if (config('mail.default') !== 'log') {
            try {
                $user->notify(new AdminAccountCredentials($user->username, $initialPassword));
                $credentialsDelivered = true;
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        ActivityLogService::record(
            'auth.user_created',
            'user',
            $user->id,
            [
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'credentials_delivered' => $credentialsDelivered,
            ],
            $request->user()?->id,
        );

        $message = $credentialsDelivered
            ? 'Akun admin dibuat dan kredensial awal dikirim ke email penerima.'
            : 'Akun admin dibuat. Email kredensial belum dikirim karena layanan email belum dikonfigurasi.';

        return redirect()->route('admin.users.index')->with('success', $message);
    }

    public function edit(Request $request, User $user): Response
    {
        return Inertia::render('Admin/Users/Form', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'status' => $user->status,
            ],
            'submitUrl' => route('admin.users.update', $user),
            'isSelf' => (int) $request->user()?->id === (int) $user->id,
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $isSelf = (int) $request->user()?->id === (int) $user->id;

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-zA-Z0-9._-]+$/', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);

        if ($isSelf && ($validated['status'] ?? null) === 'inactive') {
            return back()->withErrors([
                'status' => 'Tidak dapat menonaktifkan akun yang sedang Anda pakai.',
            ]);
        }

        if (
            $user->status === 'active'
            && ($validated['status'] ?? null) === 'inactive'
            && $this->activeAdminCount() <= 1
        ) {
            return back()->withErrors([
                'status' => 'Minimal satu akun admin aktif harus tetap ada.',
            ]);
        }

        if (empty($validated['password'])) {
            unset($validated['password']);
        }

        // Equal-admin: never persist hierarchical roles from the form.
        $validated['role'] = self::STORE_ADMIN_ROLE;
        $validated['username'] = strtolower(trim((string) $validated['username']));

        $user->update($validated);

        ActivityLogService::record(
            'auth.user_updated',
            'user',
            $user->id,
            [
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'status' => $user->status,
                'password_changed' => array_key_exists('password', $validated),
            ],
            $request->user()?->id,
        );

        return redirect()->route('admin.users.index')->with('success', 'Akun admin diperbarui.');
    }

    public function activate(Request $request, User $user): RedirectResponse
    {
        $user->update([
            'status' => 'active',
            'role' => self::STORE_ADMIN_ROLE,
        ]);

        ActivityLogService::record(
            'auth.user_activated',
            'user',
            $user->id,
            ['email' => $user->email],
            $request->user()?->id,
        );

        return redirect()->back()->with('success', 'Akun diaktifkan.');
    }

    public function deactivate(Request $request, User $user): RedirectResponse
    {
        if ((int) $request->user()?->id === (int) $user->id) {
            return redirect()->back()->withErrors([
                'status' => 'Tidak dapat menonaktifkan akun yang sedang Anda pakai.',
            ]);
        }

        if ($user->status === 'active' && $this->activeAdminCount() <= 1) {
            return redirect()->back()->withErrors([
                'status' => 'Minimal satu akun admin aktif harus tetap ada.',
            ]);
        }

        $user->update(['status' => 'inactive']);

        ActivityLogService::record(
            'auth.user_deactivated',
            'user',
            $user->id,
            ['email' => $user->email],
            $request->user()?->id,
        );

        return redirect()->back()->with('success', 'Akun dinonaktifkan.');
    }

    protected function activeAdminCount(): int
    {
        return User::query()->where('status', 'active')->count();
    }
}
