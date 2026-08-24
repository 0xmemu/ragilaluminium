<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels (Foundation Track B)
|--------------------------------------------------------------------------
|
| Channel authorization untuk admin live events.
| DIKOmentari: broadcast infra (Reverb/Pusher + config/broadcasting.php)
| belum diaktifkan di production. Aktifkan saat deployment requirement terpenuhi.
|
| Deployment requirement:
| 1. composer require laravel/reverb (atau pusher/pusher-php-server)
| 2. php artisan vendor:publish --provider="Laravel\Reverb\Providers\ReverbServiceProvider"
| 3. Set .env: BROADCAST_CONNECTION=reverb (atau pusher)
| 4. Konfigurasi Reverb/Pusher di .env (REVERB_APP_ID, REVERB_APP_KEY, etc.)
| 5. npm install laravel-echo pusher-js (runtime/production dependencies —
|    dibundle & dijalankan di browser production; BUKAN devDependency)
| 6. php artisan queue:restart (pastikan queue worker berjalan dgn Redis)
| 7. Verifikasi route channels.php ini aktif (Broadcast::routes() di boot)
| 8. Restart queue worker & pastikan Reverb server running (php artisan reverb:start)
|
| Keamanan: channel private-admin.operations hanya utk authenticated admin.
| Non-admin mendapat 403 dari callback ini.
*/
Broadcast::channel('admin.operations', function (User $user) {
    return $user->isAdmin();
});