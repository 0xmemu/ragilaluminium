<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    protected const MAX_ATTEMPTS = 5;

    protected const DECAY_SECONDS = 60;

    public function showLoginForm(): Response
    {
        return Inertia::render('Auth/Login', [
            'email' => old('email', ''),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = Str::lower($credentials['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            throw ValidationException::withMessages([
                'email' => "Terlalu banyak percobaan. Coba lagi dalam {$seconds} detik.",
            ]);
        }

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            $user = Auth::user();
            if (! $user->isActive()) {
                Auth::logout();

                return redirect()->route('login')->withErrors(['email' => 'Akun Anda nonaktif.']);
            }

            RateLimiter::clear($throttleKey);
            $request->session()->regenerate();

            ActivityLogService::record(
                'auth.login',
                'user',
                (int) $user->id,
                ['ip' => $request->ip(), 'email' => $user->email],
                (int) $user->id,
            );

            return redirect()->intended(route('admin.dashboard'));
        }

        RateLimiter::hit($throttleKey, self::DECAY_SECONDS);

        return back()->withErrors([
            'email' => 'Kredensial tidak cocok dengan data kami.',
        ])->onlyInput('email');
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
