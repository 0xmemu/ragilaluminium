<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    protected const MAX_ATTEMPTS = 5;

    protected const DECAY_SECONDS = 60;

    public function showLoginForm(): Response
    {
        return Inertia::render('Auth/Login', [
            'login' => old('login', old('email', '')),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        // Field email tetap diterima untuk kompatibilitas form dan klien lama.
        $request->merge([
            'login' => trim((string) $request->input('login', $request->input('email', ''))),
        ]);

        $validated = $request->validate([
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ]);

        $identifier = trim((string) $validated['login']);
        $throttleKey = Str::lower($identifier).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return back()->withErrors([
                'login' => "Terlalu banyak percobaan. Coba lagi dalam {$seconds} detik.",
            ])->onlyInput('login');
        }

        $credentialField = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        if ($credentialField === 'email' && User::query()->where('email', $identifier)->count() > 1) {
            return back()->withErrors([
                'login' => 'Email ini dipakai beberapa akun. Masuk menggunakan username.',
            ])->onlyInput('login');
        }

        $credentials = [
            $credentialField => $credentialField === 'username' ? Str::lower($identifier) : $identifier,
            'password' => $validated['password'],
        ];

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            /** @var User $user */
            $user = Auth::user();
            if (! $user->isActive()) {
                Auth::logout();

                return redirect()->route('login')->withErrors(['login' => 'Akun Anda nonaktif.']);
            }

            RateLimiter::clear($throttleKey);
            $request->session()->regenerate();

            ActivityLogService::record(
                'auth.login',
                'user',
                (int) $user->id,
                ['ip' => $request->ip(), 'email' => $user->email, 'username' => $user->username],
                (int) $user->id,
            );

            return redirect()->intended(route('admin.dashboard'));
        }

        RateLimiter::hit($throttleKey, self::DECAY_SECONDS);

        return back()->withErrors([
            'login' => 'Username/Password Salah',
        ])->onlyInput('login');
    }

    public function logout(Request $request): RedirectResponse
    {
        $userId = Auth::id();

        if ($userId) {
            ActivityLogService::record(
                'auth.logout',
                'user',
                (int) $userId,
                ['ip' => $request->ip()],
                (int) $userId,
            );
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}