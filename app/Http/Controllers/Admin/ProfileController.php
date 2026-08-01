<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Admin/Profile/Edit', [
            'profile' => [
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
                'role_label' => 'Admin',
                'status' => $user->status,
            ],
            'submitUrl' => route('admin.profile.update'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'min:3', 'max:64', 'regex:/^[a-zA-Z0-9._-]+$/', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255'],
            'current_password' => ['nullable', 'required_with:password', 'current_password'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $user->name = $validated['name'];
        $user->username = strtolower(trim((string) $validated['username']));
        $user->email = $validated['email'];

        $passwordChanged = filled($validated['password'] ?? null);
        if ($passwordChanged) {
            $user->password = $validated['password'];
        }

        $user->save();

        ActivityLogService::record(
            'auth.profile_updated',
            'user',
            $user->id,
            [
                'email' => $user->email,
                'username' => $user->username,
                'password_changed' => $passwordChanged,
            ],
            $user->id,
        );

        return redirect()
            ->route('admin.profile.edit')
            ->with('success', 'Profil disimpan.');
    }
}
