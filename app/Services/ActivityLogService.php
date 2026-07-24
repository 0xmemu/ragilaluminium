<?php

namespace App\Services;

use App\Models\EventLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ActivityLogService
{
    /** @var list<string> */
    public const CATEGORIES = [
        'all',
        'attendance',
        'product',
        'order',
        'whatsapp',
        'backup',
        'settings',
    ];

    /**
     * @return list<array{key:string,label:string}>
     */
    public function categoryTabs(): array
    {
        return [
            ['key' => 'all', 'label' => 'Semua Log'],
            ['key' => 'attendance', 'label' => 'Kehadiran'],
            ['key' => 'product', 'label' => 'Produk & Harga'],
            ['key' => 'order', 'label' => 'Pesanan & Biaya'],
            ['key' => 'whatsapp', 'label' => 'WhatsApp Otomatis'],
            ['key' => 'backup', 'label' => 'Backup Data'],
            ['key' => 'settings', 'label' => 'Pengaturan Web'],
        ];
    }

    public function paginate(Request $request): LengthAwarePaginator
    {
        $category = $this->normalizeCategory((string) $request->input('category', 'all'));
        $q = trim((string) $request->input('q', ''));
        $sort = (string) $request->input('sort', 'newest');

        $query = EventLog::query()->with('createdBy:id,name,email');

        $this->applyCategoryFilter($query, $category);

        if ($q !== '') {
            $query->where(function (Builder $builder) use ($q) {
                $builder->where('event_type', 'like', '%'.$q.'%')
                    ->orWhere('entity_type', 'like', '%'.$q.'%')
                    ->orWhere('payload', 'like', '%'.$q.'%')
                    ->orWhereHas('createdBy', function (Builder $user) use ($q) {
                        $user->where('name', 'like', '%'.$q.'%')
                            ->orWhere('email', 'like', '%'.$q.'%');
                    });
            });
        }

        if ($sort === 'oldest') {
            $query->orderBy('created_at')->orderBy('id');
        } else {
            $query->orderByDesc('created_at')->orderByDesc('id');
        }

        return $query->paginate(30)->withQueryString();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function mapRows(LengthAwarePaginator $paginator): array
    {
        $first = $paginator->firstItem() ?? 1;

        return $paginator->getCollection()->values()->map(function (EventLog $log, int $index) use ($first) {
            $category = $this->categoryFor($log);
            $status = $this->statusFor($log);
            $actor = $this->actorLabel($log);

            return [
                'id' => $log->id,
                'no' => $first + $index,
                'actor' => $actor,
                'created_at' => optional($log->created_at)?->toIso8601String(),
                'category' => [
                    'key' => $category,
                    'label' => $this->categoryLabel($category),
                ],
                'activity' => $this->describe($log),
                'event_type' => $log->event_type,
                'entity_type' => $log->entity_type,
                'entity_id' => $log->entity_id,
                'status' => $status,
                'href' => $this->entityHref($log),
            ];
        })->all();
    }

    /**
     * @return Collection<int, EventLog>
     */
    public function exportRows(Request $request): Collection
    {
        $category = $this->normalizeCategory((string) $request->input('category', 'all'));
        $q = trim((string) $request->input('q', ''));

        $query = EventLog::query()->with('createdBy:id,name,email');
        $this->applyCategoryFilter($query, $category);

        if ($q !== '') {
            $query->where(function (Builder $builder) use ($q) {
                $builder->where('event_type', 'like', '%'.$q.'%')
                    ->orWhere('entity_type', 'like', '%'.$q.'%')
                    ->orWhere('payload', 'like', '%'.$q.'%')
                    ->orWhereHas('createdBy', function (Builder $user) use ($q) {
                        $user->where('name', 'like', '%'.$q.'%')
                            ->orWhere('email', 'like', '%'.$q.'%');
                    });
            });
        }

        return $query->orderByDesc('created_at')->orderByDesc('id')->limit(5000)->get();
    }

    public function categoryFor(EventLog $log): string
    {
        $type = strtolower($log->event_type);
        $entity = strtolower((string) $log->entity_type);

        if (str_starts_with($type, 'auth.')) {
            return 'attendance';
        }
        if (str_starts_with($type, 'import.') || str_starts_with($type, 'product.') || str_starts_with($type, 'media.')
            || in_array($entity, ['import_job', 'product', 'product_media'], true)) {
            return 'product';
        }
        if (str_starts_with($type, 'order') || str_starts_with($type, 'payment.') || str_starts_with($type, 'shipping.')
            || in_array($entity, ['order', 'payment', 'shipping_record'], true)) {
            return 'order';
        }
        if (str_starts_with($type, 'whatsapp.') || $entity === 'whatsapp_template' || $entity === 'whatsapp_message') {
            return 'whatsapp';
        }
        if (str_starts_with($type, 'backup.')) {
            return 'backup';
        }
        if (str_starts_with($type, 'settings.') || str_starts_with($type, 'cms.')
            || in_array($entity, ['cms_page', 'cms_banner', 'cms_testimonial', 'cms_gallery_item', 'cms_model_product', 'cms_faq_item', 'cms_problem_solution', 'settings'], true)) {
            return 'settings';
        }

        return 'settings';
    }

    public function describe(EventLog $log): string
    {
        $payload = is_array($log->payload) ? $log->payload : [];
        $actor = $this->actorLabel($log);

        return match ($log->event_type) {
            'auth.login' => sprintf('%s login ke sistem%s', $actor, isset($payload['ip']) ? ' dari IP '.$payload['ip'] : ''),
            'auth.profile_updated' => sprintf(
                '%s memperbarui profil%s',
                $actor,
                ! empty($payload['password_changed']) ? ' (termasuk password)' : ''
            ),
            'auth.logout' => sprintf('%s logout dari sistem', $actor),
            'auth.user_created' => sprintf(
                'Akun admin dibuat%s',
                isset($payload['email']) ? ' · '.$payload['email'] : ''
            ),
            'auth.user_updated' => sprintf(
                'Akun admin diperbarui%s',
                isset($payload['email']) ? ' · '.$payload['email'] : ''
            ),
            'auth.user_activated' => sprintf(
                'Akun admin diaktifkan%s',
                isset($payload['email']) ? ' · '.$payload['email'] : ''
            ),
            'auth.user_deactivated' => sprintf(
                'Akun admin dinonaktifkan%s',
                isset($payload['email']) ? ' · '.$payload['email'] : ''
            ),
            'order.created' => sprintf(
                'Pesanan %s dibuat%s',
                $payload['order_number'] ?? '#'.$log->entity_id,
                isset($payload['total']) ? ' (total '.number_format((float) $payload['total'], 0, ',', '.').')' : ''
            ),
            'order_status_changed' => sprintf(
                'Status pesanan diubah dari %s menjadi %s%s',
                \App\Support\OrderEventLabels::orderStatus(isset($payload['from']) ? (string) $payload['from'] : null),
                \App\Support\OrderEventLabels::orderStatus(isset($payload['order_status']) ? (string) $payload['order_status'] : (isset($payload['to']) ? (string) $payload['to'] : null)),
                filled($payload['reason'] ?? null) ? ' · alasan: '.$payload['reason'] : ''
            ),
            'payment.confirmed' => sprintf(
                'Pembayaran dikonfirmasi untuk pesanan #%s%s',
                $log->entity_id,
                isset($payload['amount']) ? ' (Rp '.number_format((float) $payload['amount'], 0, ',', '.').')' : ''
            ),
            'shipping.created' => sprintf('Resi pengiriman dibuat%s', isset($payload['waybill']) ? ': '.$payload['waybill'] : ''),
            'shipping.create_failed' => sprintf('Gagal membuat resi%s', isset($payload['message']) ? ': '.$payload['message'] : ''),
            'shipping.status_updated' => sprintf(
                'Status pengiriman diperbarui%s',
                isset($payload['status']) ? ' → '.$payload['status'] : ''
            ),
            'import.started' => sprintf(
                'Import #%s dimulai (%s)',
                $log->entity_id,
                $payload['type'] ?? $payload['file'] ?? 'katalog'
            ),
            'import.retried' => sprintf('Import #%s diulang', $log->entity_id),
            'whatsapp.template_updated' => sprintf(
                'Template WhatsApp diperbarui%s',
                isset($payload['internal_key']) ? ': '.$payload['internal_key'] : ''
            ),
            'whatsapp.template_activated' => sprintf(
                'Otomasi WhatsApp diaktifkan%s',
                isset($payload['internal_key']) ? ': '.$payload['internal_key'] : ''
            ),
            'whatsapp.template_deactivated' => sprintf(
                'Otomasi WhatsApp dinonaktifkan%s',
                isset($payload['internal_key']) ? ': '.$payload['internal_key'] : ''
            ),
            'cms.model_product_created' => sprintf(
                'Model produk ditambahkan%s',
                isset($payload['name']) ? ': '.$payload['name'] : ''
            ),
            'cms.model_product_updated' => sprintf(
                'Model produk diperbarui%s',
                isset($payload['name']) ? ': '.$payload['name'] : ''
            ),
            'cms.model_products_synced' => sprintf(
                'Sinkronisasi model produk dari katalog (%s baru)',
                $payload['created'] ?? 0
            ),
            'cms.model_products_reordered' => 'Urutan model produk diperbarui',
            'cms.cara_pemesanan_updated' => sprintf(
                'Cara pemesanan diperbarui (%s langkah)',
                $payload['step_count'] ?? 0
            ),
            'cms.faq_meta_updated' => 'Meta halaman FAQ diperbarui',
            'cms.faq_item_created' => sprintf(
                'FAQ ditambahkan%s',
                isset($payload['question']) ? ': '.$payload['question'] : ''
            ),
            'cms.faq_item_updated' => sprintf(
                'FAQ diperbarui%s',
                isset($payload['question']) ? ': '.$payload['question'] : ''
            ),
            'cms.faq_item_deleted' => sprintf(
                'FAQ dihapus%s',
                isset($payload['question']) ? ': '.$payload['question'] : ''
            ),
            'cms.faq_items_reordered' => 'Urutan FAQ diperbarui',
            'cms.masalah_solusi_meta_updated' => 'Meta halaman Masalah & Solusi diperbarui',
            'cms.masalah_solusi_created' => 'Masalah & solusi ditambahkan',
            'cms.masalah_solusi_updated' => 'Masalah & solusi diperbarui',
            'cms.masalah_solusi_deleted' => 'Masalah & solusi dihapus',
            'cms.masalah_solusi_reordered' => 'Urutan Masalah & Solusi diperbarui',
            'cms.tentang_kami_updated' => 'Dokumen Informasi Toko diperbarui',
            'cms.storefront_platforms_updated' => 'Tautan marketplace & media sosial diperbarui',
            'cms.ketentuan_layanan_updated' => 'Dokumen Ketentuan Layanan diperbarui',
            'cms.kebijakan_privasi_updated' => 'Dokumen Kebijakan Privasi diperbarui',
            'cms.apa_kata_pelanggan_meta_updated' => 'Meta halaman Apa Kata Pelanggan diperbarui',
            'cms.hasil_pemasangan_meta_updated' => 'Meta halaman Hasil Pemasangan diperbarui',
            default => $log->event_type.($log->entity_type ? ' · '.$log->entity_type.' #'.$log->entity_id : ''),
        };
    }

    /**
     * @return array{key:string,label:string,tone:string}
     */
    public function statusFor(EventLog $log): array
    {
        $type = strtolower($log->event_type);
        $payload = is_array($log->payload) ? $log->payload : [];

        if (str_contains($type, 'fail') || ($payload['status'] ?? null) === 'failed' || isset($payload['error'])) {
            return ['key' => 'failed', 'label' => 'Gagal', 'tone' => 'danger'];
        }

        return ['key' => 'success', 'label' => 'Sukses', 'tone' => 'success'];
    }

    public function actorLabel(EventLog $log): string
    {
        if ($log->createdBy) {
            return $log->createdBy->name ?: $log->createdBy->email;
        }

        return 'Sistem';
    }

    public function entityHref(EventLog $log): ?string
    {
        if ($log->entity_type === 'order' && $log->entity_id) {
            return route('admin.orders.show', $log->entity_id);
        }
        if ($log->entity_type === 'import_job' && $log->entity_id) {
            return route('admin.imports.show', $log->entity_id);
        }
        if ($log->entity_type === 'whatsapp_template' && $log->entity_id) {
            return route('admin.whatsapp.templates.edit', $log->entity_id);
        }
        if ($log->entity_type === 'cms_model_product' && $log->entity_id) {
            return route('admin.model-products.edit', $log->entity_id);
        }
        if ($log->entity_type === 'cms_page' && ($log->event_type === 'cms.cara_pemesanan_updated')) {
            return route('admin.cara-pemesanan.edit');
        }
        if (in_array($log->entity_type, ['cms_faq_item', 'cms_page'], true)
            && str_starts_with((string) $log->event_type, 'cms.faq')) {
            return route('admin.faq.index');
        }
        if (in_array($log->entity_type, ['cms_problem_solution', 'cms_page'], true)
            && str_starts_with((string) $log->event_type, 'cms.masalah_solusi')) {
            return route('admin.masalah-solusi.index');
        }
        if ($log->event_type === 'cms.tentang_kami_updated') {
            return route('admin.tentang-kami.edit');
        }
        if ($log->event_type === 'cms.storefront_platforms_updated') {
            return route('admin.storefront-platforms.edit');
        }
        if ($log->event_type === 'cms.ketentuan_layanan_updated') {
            return route('admin.ketentuan-layanan.edit');
        }
        if ($log->event_type === 'cms.kebijakan_privasi_updated') {
            return route('admin.kebijakan-privasi.edit');
        }
        if ($log->event_type === 'cms.apa_kata_pelanggan_meta_updated') {
            return route('admin.apa-kata-pelanggan.index');
        }
        if ($log->event_type === 'cms.hasil_pemasangan_meta_updated') {
            return route('admin.hasil-pemasangan.index');
        }
        if ($log->event_type === 'auth.profile_updated') {
            return route('admin.profile.edit');
        }
        if (
            in_array($log->event_type, [
                'auth.user_created',
                'auth.user_updated',
                'auth.user_activated',
                'auth.user_deactivated',
            ], true)
            && $log->entity_id
        ) {
            return route('admin.users.edit', $log->entity_id);
        }

        return null;
    }

    public function normalizeCategory(string $category): string
    {
        return in_array($category, self::CATEGORIES, true) ? $category : 'all';
    }

    public function categoryLabel(string $category): string
    {
        foreach ($this->categoryTabs() as $tab) {
            if ($tab['key'] === $category) {
                return $tab['label'];
            }
        }

        return 'Lainnya';
    }

    protected function applyCategoryFilter(Builder $query, string $category): void
    {
        if ($category === 'all') {
            return;
        }

        match ($category) {
            'attendance' => $query->where(function (Builder $q) {
                $q->where('event_type', 'like', 'auth.%');
            }),
            'product' => $query->where(function (Builder $q) {
                $q->where('event_type', 'like', 'import.%')
                    ->orWhere('event_type', 'like', 'product.%')
                    ->orWhere('event_type', 'like', 'media.%')
                    ->orWhereIn('entity_type', ['import_job', 'product', 'product_media']);
            }),
            'order' => $query->where(function (Builder $q) {
                $q->where('event_type', 'like', 'order%')
                    ->orWhere('event_type', 'like', 'payment.%')
                    ->orWhere('event_type', 'like', 'shipping.%')
                    ->orWhereIn('entity_type', ['order', 'payment', 'shipping_record']);
            }),
            'whatsapp' => $query->where(function (Builder $q) {
                $q->where('event_type', 'like', 'whatsapp.%')
                    ->orWhereIn('entity_type', ['whatsapp_template', 'whatsapp_message']);
            }),
            'backup' => $query->where('event_type', 'like', 'backup.%'),
            'settings' => $query->where(function (Builder $q) {
                $q->where('event_type', 'like', 'settings.%')
                    ->orWhere('event_type', 'like', 'cms.%')
                    ->orWhereIn('entity_type', ['cms_page', 'cms_banner', 'cms_testimonial', 'cms_gallery_item', 'cms_model_product', 'cms_faq_item', 'cms_problem_solution', 'settings']);
            }),
            default => null,
        };
    }

    /**
     * Append-only helper used across services/controllers.
     *
     * @param  array<string, mixed>|null  $payload
     */
    public static function record(
        string $eventType,
        string $entityType,
        ?int $entityId = null,
        ?array $payload = null,
        ?int $userId = null,
    ): EventLog {
        return EventLog::create([
            'event_type' => $eventType,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'payload' => $payload,
            'created_by_user_id' => $userId,
            'created_at' => now(),
        ]);
    }
}
