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
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['nullable', 'required_with:password', 'current_password'],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $user->name = $validated['name'];
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
                'password_changed' => $passwordChanged,
            ],
            $user->id,
        );

        return redirect()
            ->route('admin.profile.edit')
            ->with('success', 'Profil disimpan.');
    }
}
