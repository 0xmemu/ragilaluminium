# Matriks dependency production

Discovery 13 Oktober 2026 dari source repo 209, environment template, config, routes, jobs, scheduler, systemd, Nginx, DNS, TLS, dan layanan 202. Tidak ada secret value dicatat.

Status: REQUIRED = dibutuhkan alur runtime/operasi; OPTIONAL = fitur tambahan; DISABLED = sengaja tidak aktif; UNKNOWN = belum terbukti di production; NOT_APPLICABLE = hanya development/testing.

| Dependency | Ditemukan di | Dev status | Production 202 | Klasifikasi | Konfigurasi production | Verifikasi dan rollback | Owner |
|---|---|---|---|---|---|---|---|
| PHP 8.3, ekstensi, Laravel 11 | composer.json, bootstrap, deploy | Aktif | Aktif | REQUIRED | PHP 8.3, PDO MySQL, Redis, GD, mbstring, intl, curl, zip | php -m, /up; rollback package/release | Infra/release |
| React/Inertia/Vite/Node | package.json, resources, Vite | Aktif | Build asset aktif | REQUIRED saat deploy | Build dari commit/tag, Node tidak diperlukan saat request | manifest dan aset 200; rollback current | Release |
| MySQL | config/database.php, migrations | Aktif dengan data dev | 61 tabel, data bisnis kosong | REQUIRED | ragil_aluminium, ragil_app, password khusus 202 | migrate:status/query; backup restore | Infra |
| Admin auth/session | LoginController, User, session config | Username login | Satu admin production, session DB baru | REQUIRED | APP_KEY dan akun production baru; tanpa hash dev | browser login/session; nonaktifkan akun/revert env | Security/release |
| Redis/cache | config/cache.php, queue.php | Aktif | Loopback aktif | REQUIRED | cache/queue namespace production | redis ping/cache read-write; rollback driver | Infra |
| Queue worker | app/Jobs, systemd | Aktif | ragil-queue.service aktif | REQUIRED | current release, imports/media/default | systemd/queue test; stop unit saat rollback | Infra |
| Scheduler | routes/console.php, cron | Aktif | cron www-data tiap menit | REQUIRED | schedule:run dari current | schedule:list/run; remove cron saat rollback | Infra |
| Reverb/Echo | config/reverb, channels, JS, Nginx /app | Kode ada | Belum aktif/terbukti | OPTIONAL; REQUIRED live admin events | unit, VITE_REVERB_* baru | websocket/channel test; disable unit | Release |
| Local filesystem/storage | filesystems.php, media.php | Fallback | Aktif, kosong | REQUIRED framework; OPTIONAL media | shared storage, www-data write | write/storage link; restore link | Infra |
| R2/object storage | filesystems.php, media config | Aktif 209 | Belum configured | OPTIONAL saat toko kosong; REQUIRED saat media | bucket, credential, endpoint, public URL baru | media disk/upload/public URL; revert env | Infra |
| Media public domain | env/docs/DNS | media.333labs.tech di 209 | Belum ada | REQUIRED saat media dipakai | media.ragilaluminium.com atau domain production lain, DNS/TLS/CORS | curl asset/cert; revert DNS | DNS/infra |
| Domain/TLS/Cloudflare | Nginx, Certbot, DNS | Preview/prod topology | main/www/api aktif, cert valid | REQUIRED | SAN utama, trusted proxy allowlist | HTTPS/cert/redirect; restore vhost/DNS | DNS/infra |
| Nginx/PHP-FPM | vhost/systemd | Aktif | Aktif, current/public | REQUIRED | deny dotfiles/internal paths, no fake J&T ACK | nginx -t/pages; restore standby vhost | Infra |
| Backup/restore | /root/ragil-backup, cron, R2 | Aktif | dump/R2 upload dan 61/61 restore pass | REQUIRED operational | retention dan test DB | gzip/R2/restore logs; restore approved backup | Infra |
| WhatsApp Baileys/Meta | services, WhatsAppService, routes | Baileys 209 | Belum production-ready | DISABLED untuk transaksi; REQUIRED automation | provider/gateway/session/webhook production baru | health/pairing/signed webhook; disable provider | Integrations |
| J&T API/callback | config/jnt, ShippingService, routes | Kode ada | JNT false, invalid POST 401 | DISABLED; REQUIRED shipping | credentials, environment, signed callback production | valid/invalid signed callback; set false | Shipping |
| Local shipping/address | ShippingService, postal tables | Dataset dev | Dataset production kosong | OPTIONAL empty store; REQUIRED checkout | approved reference dataset/tarif | lookup/quote; disable checkout | Shipping |
| Payment/COD/transfer | OrderService/payment config/CMS | Kode ada | Tidak configured | OPTIONAL empty store; REQUIRED orders | provider/account/fees production new | sandbox checkout; disable checkout | Payments |
| Mail | config/mail, mail paths | log/default | log driver, no delivery | OPTIONAL current; REQUIRED email flow | SMTP/provider production new | controlled mail test; revert mailer | Operations |
| Excel import/export | composer, Imports/Exports | Aktif | Installed | OPTIONAL | queue/storage limits | safe export/import test; disable feature | Admin ops |
| Media jobs | app/Jobs media | Aktif | Worker ada, no media | OPTIONAL until media | disk/derivatives/source allowlist | upload derivative test; stop worker | Catalog |
| Analytics/visitor metrics | middleware/performance tables | Aktif dev | Live visits may be recorded | OPTIONAL | do not import 209 events | request/row policy; disable middleware | Product |
| OAuth/Sanctum/JWT | composer/config/routes | No primary flow | No callback/client | NOT_APPLICABLE current | configure only when selected | callback test; no action | Product |
| Cloudflare API/Tunnel/alerts | services/SystemHealth/monitoring | Tooling exists | Proxy active, API alert not fully proven | OPTIONAL/UNKNOWN | production token only if used | dashboard/alert test; disable monitor | Infra |
| Host external scripts | routes/console, /root scripts | Used 209 | backup scripts active; traffic path separate | OPTIONAL/UNKNOWN | verify referenced paths before relying | file/schedule test; disable job | Infra |
| GitHub deploy key/tag | deploy user/repo | Snapshot branches | key exists but GitHub registration not proven | REQUIRED formal release | register read-only key, fetch tag from main | ssh/fetch/hash; archive recovery only | Release |
| Config cache | artisan config/cache | Known Closure failure | config cache fails, runtime works | OPTIONAL runtime; REQUIRED formal policy | remove nonserializable Closure | config:cache; revert config fix | Code |

## Current gate

The empty storefront baseline is live. It is not full commerce readiness. Before adding media, configure a production R2 bucket/domain. Before real orders, configure and test shipping, payment, mail, and WhatsApp as selected. Before a formal main/tag release, register the deploy key, verify browser login, resolve lint warnings, and decide the config-cache Closure issue. No production record, media, token, session, or credential was copied from VPS 209.
