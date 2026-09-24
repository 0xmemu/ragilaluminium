<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isActive()) {
            return redirect()->route('login');
        }

        if (! $user->isAdmin()) {
            abort(403);
        }

        $idleMinutes = (int) config('operations.admin_session_idle_minutes', 30);

        // Hanya sesi yang login tanpa mencentang "Tetap Masuk Di Perangkat Ini"
        // yang punya batas idle. Key absent (sesi lama sebelum fitur ini)
        // diperlakukan sebagai tidak persisten, jadi aman.
        if ($idleMinutes > 0 && ! $request->session()->get('admin_session_persistent', false)) {
            $lastActivity = (int) $request->session()->get('admin_last_activity', 0);

            if ($lastActivity > 0 && (time() - $lastActivity) > ($idleMinutes * 60)) {
                Auth::logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                return redirect()->route('login')->with(
                    'status',
                    'Sesi berakhir karena tidak ada aktivitas. Silakan masuk kembali.'
                );
            }

            $request->session()->put('admin_last_activity', time());
        }

        return $next($request);
    }
}
