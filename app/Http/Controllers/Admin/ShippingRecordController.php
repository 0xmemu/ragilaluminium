<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use App\Support\InertiaAdmin;
use App\Support\JntReadiness;
use App\Support\LikeSearch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShippingRecordController extends Controller
{
    public function index(Request $request): Response
    {
        $records = ShippingRecord::with('order')
            ->when($request->filled('q'), fn ($q) => LikeSearch::whereLike($q, 'waybill_number', (string) $request->q))
            ->when($request->filled('carrier_name'), fn ($q) => $q->where('carrier_name', $request->carrier_name))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Pengiriman',
            'createHref' => null,
            'columns' => [
                ['key' => 'waybill_number', 'label' => 'Resi', 'hrefKey' => 'href'],
                ['key' => 'order_number', 'label' => 'Pesanan', 'hrefKey' => 'order_href'],
                ['key' => 'carrier_name', 'label' => 'Kurir'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'last_status_at', 'label' => 'Update'],
            ],
            'rows' => $records->getCollection()->map(fn (ShippingRecord $r) => [
                'waybill_number' => $r->waybill_number ?? '-',
                'order_number' => $r->order?->order_number ?? '-',
                'order_href' => $r->order_id ? route('admin.orders.show', $r->order_id) : '',
                'carrier_name' => $r->carrier_name,
                'status' => $r->status,
                'last_status_at' => optional($r->last_status_at)?->toDateTimeString() ?? '-',
                'href' => route('admin.shipping.show', $r),
                'actions' => [
                    [
                        'label' => 'Detail',
                        'method' => 'get',
                        'href' => route('admin.shipping.show', $r),
                    ],
                    [
                        'label' => 'Segarkan',
                        'method' => 'post',
                        'url' => route('admin.shipping.refresh', $r),
                    ],
                ],
            ])->all(),
            'pagination' => InertiaAdmin::pagination($records),
        ]);
    }

    public function show(ShippingRecord $shipping): Response
    {
        $shipping->load('order');

        // ShippingService menulis event pada entity order (agar timeline order
        // tetap utuh). Ambil event shipping yang relevan dengan resi ini.
        $logs = EventLog::query()
            ->where('entity_type', 'order')
            ->where('entity_id', $shipping->order_id)
            ->where('event_type', 'like', 'shipping.%')
            ->latest('created_at')
            ->limit(50)
            ->get();

        $matchingLogs = $logs->filter(
            fn (EventLog $log): bool => data_get($log->payload, 'waybill') === $shipping->waybill_number
        );
        if ($matchingLogs->isNotEmpty()) {
            $logs = $matchingLogs;
        }

        $timeline = $logs->map(function (EventLog $log): array {
            $payload = is_array($log->payload) ? $log->payload : [];
            $details = match ($log->event_type) {
                'shipping.status_updated' => trim(implode(' - ', array_filter([
                    isset($payload['from'], $payload['to'])
                        ? ($payload['from'].' -> '.$payload['to'])
                        : null,
                    $payload['raw'] ?? null,
                ]))),
                'shipping.created' => filled($payload['source'] ?? null)
                    ? 'Sumber: '.$payload['source']
                    : 'Resi dicatat di sistem',
                'shipping.create_failed' => $payload['message'] ?? 'Pembuatan resi gagal',
                default => trim(implode(' - ', array_filter([
                    $payload['raw'] ?? null,
                    $payload['message'] ?? null,
                ]))),
            };

            return [
                'label' => optional($log->created_at)?->format('d/m/Y H:i').' - '.$this->eventLabel($log->event_type),
                'value' => $details !== '' ? $details : 'Event pengiriman tercatat.',
            ];
        })->values()->all();

        return Inertia::render('Admin/ResourceShow', [
            'title' => 'Pengiriman '.($shipping->waybill_number ?? '#'.$shipping->id),
            'subtitle' => $shipping->carrier_name,
            'fields' => [
                ['label' => 'Resi', 'value' => $shipping->waybill_number],
                ['label' => 'Kurir', 'value' => $shipping->carrier_name],
                ['label' => 'Layanan', 'value' => $shipping->service_name],
                ['label' => 'Status', 'value' => $shipping->status],
                ['label' => 'Keterangan kurir', 'value' => $shipping->status_raw],
                ['label' => 'Pesanan', 'value' => $shipping->order?->order_number],
                ['label' => 'Tracking kurir', 'value' => $shipping->tracking_url],
                ['label' => 'Update Terakhir', 'value' => optional($shipping->last_status_at)?->toDateTimeString()],
            ],
            'sections' => [
                [
                    'title' => 'Timeline pengiriman',
                    'rows' => $timeline,
                ],
            ],
        ]);
    }

    public function refreshStatus(ShippingService $shipping, ShippingRecord $shipping_record): RedirectResponse
    {
        [$flashKey, $message] = $this->refreshFeedback($shipping, $shipping_record);

        return redirect()->back()->with($flashKey, $message);
    }

    /**
     * ShippingService returns void; classify the persisted result rather than
     * claiming success when the provider returned no new event.
     *
     * @return array{0: 'success'|'status'|'error', 1: string}
     */
    private function refreshFeedback(ShippingService $shipping, ShippingRecord $record): array
    {
        if (! JntReadiness::report()['client_ready']) {
            return ['status', 'Tracking J&T belum diperbarui: integrasi belum siap atau sedang nonaktif. Data terakhir tetap ditampilkan.'];
        }

        $before = [
            'status' => $record->status,
            'status_raw' => $record->status_raw,
            'last_status_at' => optional($record->last_status_at)?->toIso8601String(),
            'tracking_url' => $record->tracking_url,
        ];

        try {
            $shipping->refreshStatus($record);
        } catch (\Throwable $exception) {
            return ['error', 'Refresh tracking gagal: '.$exception->getMessage()];
        }

        $after = $record->fresh();
        $changed = $after && (
            $before['status'] !== $after->status
            || $before['status_raw'] !== $after->status_raw
            || $before['last_status_at'] !== optional($after->last_status_at)?->toIso8601String()
            || $before['tracking_url'] !== $after->tracking_url
        );

        return $changed
            ? ['success', 'Status tracking berhasil diperbarui dari J&T.']
            : ['status', 'Status tracking belum berubah (data stale atau belum ada event baru dari J&T).'];
    }

    private function eventLabel(string $eventType): string
    {
        return match ($eventType) {
            'shipping.created' => 'Resi dicatat',
            'shipping.status_updated' => 'Status diperbarui',
            'shipping.create_failed' => 'Pembuatan resi gagal',
            default => str_replace(['shipping.', '_'], ['', ' '], $eventType),
        };
    }
}
