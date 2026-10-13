<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels (Foundation Track B — AKTIF 2026-08-25)
|--------------------------------------------------------------------------
|
| Channel authorization untuk admin live events (P2 Task 7 selesai):
| - Broadcast infra: Laravel Reverb (composer require laravel/reverb) + config
|   reverb.php dipublish; BROADCAST_CONNECTION=reverb di .env production.
| - Frontend: laravel-echo + pusher-js (runtime deps) via
|   resources/js/lib/admin-live-events.ts (Echo init lazy, channel
|   private-admin.operations).
| - Boot: withRouting(channels: routes/channels.php) di bootstrap/app.php.
| - Infra ops: systemd laravel-reverb.service (127.0.0.1:8080) + nginx
|   location /app/ webSocket proxy (tanpa port publik tambahan).
|
| Keamanan: channel private-admin.operations hanya utk authenticated admin.
| Non-admin mendapat 403 dari callback ini.
*/
Broadcast::channel('admin.operations', function (User $user) {
    return $user->isAdmin();
});