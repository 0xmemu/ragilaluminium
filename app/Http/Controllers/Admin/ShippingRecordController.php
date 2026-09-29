<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use App\Support\JntReadiness;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShippingRecordController extends Controller
{
    public function index(Request $request): Response
    {
        $status = trim((string) $request->input('status', 'all'));
        $q = trim((string) $request->input('q', ''));

        // Filter metode pembayaran pesanan (COD atau transfer bank). Ada di
        // halaman ini karena cara bayar menentukan cara paket ditangani saat
        // serah terima. Nilai di luar daftar dianggap tanpa filter.
        $method = trim((string) $request->input('payment_method', 'all'));
        if (! in_array($method, ['all', 'cod', 'transfer'], true)) {
            $method = 'all';
        }

        // Filter periode. Default '' (= Semua waktu) supaya perilaku halaman
        // tidak berubah sebelum admin memilih periode.
        $datePreset = trim((string) $request->input('date_preset', ''));
        $dateFrom = trim((string) $request->input('date_from', ''));
        $dateTo = trim((string) $request->input('date_to', ''));
        if (! in_array($datePreset, ['today', '3d', '7d', '30d', 'range'], true)) {
            $datePreset = '';
        }

        // Rentang berbasis created_at (tanggal resi dicatat sistem). Kolom
        // last_status_at (waktu update terakhir dari J&T) ikut berubah setiap
        // refresh pelacakan, jadi tidak layak jadi dasar filter periode.
        $applyPeriod = function ($query) use ($datePreset, $dateFrom, $dateTo) {
            return $query
                ->when($datePreset === 'today', fn ($sub) => $sub->whereDate('created_at', now()->toDateString()))
                ->when($datePreset === '3d', fn ($sub) => $sub->where('created_at', '>=', now()->subDays(3)->startOfDay()))
                ->when($datePreset === '7d', fn ($sub) => $sub->where('created_at', '>=', now()->subDays(7)->startOfDay()))
                ->when($datePreset === '30d', fn ($sub) => $sub->where('created_at', '>=', now()->subDays(30)->startOfDay()))
                ->when($datePreset === 'range' && $dateFrom !== '', fn ($sub) => $sub->whereDate('created_at', '>=', $dateFrom))
                ->when($datePreset === 'range' && $dateTo !== '', fn ($sub) => $sub->whereDate('created_at', '<=', $dateTo));
        };

        // Agregasi Ringkasan Eksekutif Pengiriman. Mengikuti periode terpilih
        // supaya angka KPI, hitungan tab, dan tabel berbicara tentang himpunan
        // data yang sama. Filter metode pembayaran sengaja TIDAK ikut menyempitkan
        // ringkasan, sama seperti halaman Pembayaran: metode adalah dimensi
        // sejajar status, bukan pembatas periode.
        $allRecords = $applyPeriod(ShippingRecord::query())->get(['status']);

        $totalDelivered = $allRecords->where('status', 'delivered')->count();
        $totalInTransit = $allRecords->whereIn('status', ['in_transit', 'out_for_delivery', 'picked_up'])->count();
        $totalPendingPickup = $allRecords->whereIn('status', ['pending_pickup', 'tracking_pending', 'in_process'])->count();
        $totalIssue = $allRecords->whereIn('status', ['exception', 'returned'])->count();
        $totalCount = $allRecords->count();

        $summary = [
            'total_delivered' => $totalDelivered,
            'total_in_transit' => $totalInTransit,
            'total_pending_pickup' => $totalPendingPickup,
            'total_issue' => $totalIssue,
            'total_records' => $totalCount,
        ];

        // Tabs status pengiriman
        $tabs = [
            ['key' => 'all', 'label' => 'Semua', 'count' => $totalCount],
            ['key' => 'in_transit', 'label' => 'Dalam Perjalanan', 'count' => $totalInTransit],
            ['key' => 'pending_pickup', 'label' => 'Menunggu Jemput', 'count' => $totalPendingPickup],
            ['key' => 'delivered', 'label' => 'Sampai', 'count' => $totalDelivered],
            ['key' => 'issue', 'label' => 'Kendala', 'count' => $totalIssue],
        ];

        // Query tabel pengiriman
        $query = $applyPeriod(ShippingRecord::query())
            ->with(['order' => fn ($subQuery) => $subQuery->select([
                'id', 'order_number', 'order_status',
                'customer_name', 'customer_phone',
                'shipping_address_line1', 'shipping_address_line2',
                'shipping_village', 'shipping_district', 'shipping_city',
                'shipping_province', 'shipping_postal_code',
            ])])
            ->when($status !== '' && $status !== 'all', function ($sub) use ($status) {
                if ($status === 'in_transit') {
                    $sub->whereIn('status', ['in_transit', 'out_for_delivery', 'picked_up']);
                } elseif ($status === 'pending_pickup') {
                    $sub->whereIn('status', ['pending_pickup', 'tracking_pending', 'in_process']);
                } elseif ($status === 'issue') {
                    $sub->whereIn('status', ['exception', 'returned']);
                } else {
                    $sub->where('status', $status);
                }
            })
            ->when($method !== 'all', fn ($sub) => $sub->whereHas(
                'order',
                fn ($orderSub) => $orderSub->where('payment_method', $method)
            ))
            ->when($q !== '', function ($sub) use ($q) {
                $sub->where(function ($nested) use ($q) {
                    $nested->where('waybill_number', 'like', "%{$q}%")
                        ->orWhereHas('order', function ($orderSub) use ($q) {
                            $orderSub->where('order_number', 'like', "%{$q}%")
                                ->orWhere('customer_name', 'like', "%{$q}%")
                                ->orWhere('shipping_city', 'like', "%{$q}%");
                        });
                });
            })
            ->latest('id');

        $paginated = $query->paginate(15)->withQueryString();

        // Waktu pengiriman selesai untuk baris di halaman ini, dibaca dari log
        // kejadian pesanan. Kejadian terminal paling awal dipakai supaya durasi
        // berhenti tepat saat paket sampai, bukan saat terakhir disegarkan.
        $terminalShipping = ['delivered', 'returned', 'cancelled'];
        $pageOrderIds = $paginated->getCollection()->pluck('order_id')->filter()->unique();
        $completedAt = $pageOrderIds->isEmpty()
            ? collect()
            : EventLog::query()
                ->where('entity_type', 'order')
                ->whereIn('entity_id', $pageOrderIds->all())
                ->where('event_type', 'shipping.status_updated')
                ->orderBy('created_at')
                ->get(['entity_id', 'payload', 'created_at'])
                ->filter(fn (EventLog $log): bool => in_array(data_get($log->payload, 'to'), $terminalShipping, true))
                ->groupBy('entity_id')
                ->map(fn ($logs) => $logs->first()->created_at);

        $mappedData = $paginated->getCollection()->map(function (ShippingRecord $r) use ($completedAt): array {
            $order = $r->order;
            $age = $this->shipAge($r, $completedAt->get($r->order_id));

            return [
                'id' => $r->id,
                'waybill_number' => $r->waybill_number ?? '-',
                'carrier_name' => $r->carrier_name ?: 'J&T Cargo',
                'service_name' => $r->service_name,
                'status' => $r->status,
                'last_status_at' => optional($r->last_status_at)?->toIso8601String(),
                'order_id' => $r->order_id,
                'order_number' => $order?->order_number ?? '-',
                'order_status' => $order?->order_status ?? null,
                'customer_name' => $order?->customer_name ?? '-',
                'customer_phone' => $order?->customer_phone ?? '',
                // Alamat penerima utuh (bukan hanya kota), disusun dengan urutan
                // yang sama seperti orderShippingAddress pada area cetak supaya
                // satu pesanan tampil konsisten di semua permukaan.
                'customer_address' => $this->recipientAddress($order),
                'age_label' => $age['label'],
                'age_tone' => $age['tone'],
                'age_hours' => $age['hours'],
                'age_title' => $age['title'],
                'track_href' => $r->order_id
                    ? route('admin.orders.show', ['order' => $r->order_id, 'lacak' => 1])
                    : route('admin.shipping.index'),
                'order_href' => $r->order_id ? route('admin.orders.show', $r->order_id) : '#',
            ];
        });

        return Inertia::render('Admin/Shipping/Index', [
            'title' => 'Pengiriman',
            'description' => 'Monitoring paket ekspedisi J&T Cargo, pelacakan resi, dan serah terima pengiriman pelanggan.',
            'summary' => $summary,
            'tabs' => $tabs,
            'activeStatus' => $status,
            'activePaymentMethod' => $method,
            'activeDatePreset' => $datePreset,
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'periodLabel' => $this->periodLabel($datePreset, $dateFrom, $dateTo),
            'searchQuery' => $q,
            'records' => [
                'data' => $mappedData->all(),
                'links' => $paginated->linkCollection()->toArray(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
                'total' => $paginated->total(),
                'per_page' => $paginated->perPage(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
            ],
        ]);
    }

    /**
     * Halaman detail resi DIHAPUS (owner 2026-09-28). Isinya hanya duplikat
     * drawer "Lacak pesanan" di detail pesanan terkait, jadi URL lama tetap
     * hidup sebagai pengalih ke sana dengan penanda `lacak` supaya drawer-nya
     * langsung terbuka. Cara ini dipakai agar tautan dan bookmark lama tidak
     * mati setelah halamannya dibuang.
     */
    public function redirectToOrder(ShippingRecord $shipping): RedirectResponse
    {
        if (! $shipping->order_id) {
            return redirect()
                ->route('admin.shipping.index')
                ->with('status', 'Resi ini belum tertaut pesanan, jadi tidak ada detail pesanan yang bisa dibuka.');
        }

        return redirect()->route('admin.orders.show', [
            'order' => $shipping->order_id,
            'lacak' => 1,
        ]);
    }

    public function refreshStatus(ShippingService $shipping, ShippingRecord $shipping_record): RedirectResponse
    {
        [$flashKey, $message] = $this->refreshFeedback($shipping, $shipping_record);

        return redirect()->back()->with($flashKey, $message);
    }

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

    /**
     * Umur pengiriman: berapa lama resi sudah berjalan sejak dicatat.
     *
     * Resi aktif dihitung sampai saat ini sehingga angkanya bertambah dan paket
     * yang macet langsung terbaca. Resi yang sudah selesai dihitung sampai waktu
     * status akhirnya tercatat, karena kolom last_status_at ikut berubah setiap
     * pelacakan J&T disegarkan sehingga tidak layak jadi jangkar waktu.
     *
     * Ambang peringatan mengikuti filter umur di daftar pesanan (24 jam, 7 hari).
     *
     * @return array{label: string, tone: string, hours: int|null, title: string}
     */
    private function shipAge(ShippingRecord $record, ?\Carbon\CarbonInterface $completedAt): array
    {
        $start = $record->created_at;

        if (! $start) {
            return [
                'label' => '-',
                'tone' => 'muted',
                'hours' => null,
                'title' => 'Waktu resi dicatat belum tersedia.',
            ];
        }

        $hours = (int) floor($start->diffInHours($completedAt ?? now()));
        $label = match (true) {
            $hours < 1 => 'Baru saja',
            $hours < 24 => $hours.' jam',
            default => intdiv($hours, 24).' hari',
        };

        $tone = 'muted';
        if (! $completedAt) {
            $tone = match (true) {
                $hours >= 24 * 7 => 'danger',
                $hours >= 24 => 'warning',
                default => 'muted',
            };
        }

        return [
            'label' => $label,
            'tone' => $tone,
            'hours' => $hours,
            'title' => $completedAt
                ? 'Total '.$label.' sejak resi dicatat sampai pengiriman selesai.'
                : 'Resi dicatat '.$start->translatedFormat('j M Y, H.i').', sudah berjalan '.$label.'.',
        ];
    }

    /**
     * Alamat penerima satu baris untuk kolom Penerima di daftar pengiriman.
     * Urutan bagiannya sama dengan orderShippingAddress di area cetak supaya
     * satu pesanan tampil konsisten di semua permukaan.
     */
    private function recipientAddress(?Order $order): string
    {
        if (! $order) {
            return '';
        }

        return trim(implode(', ', array_filter([
            $order->shipping_address_line1,
            $order->shipping_address_line2,
            $order->shipping_village,
            $order->shipping_district,
            $order->shipping_city,
            $order->shipping_province,
            $order->shipping_postal_code,
        ], fn ($part) => filled($part))));
    }

    /** Label periode aktif untuk ditampilkan di baris filter aktif. */
    private function periodLabel(string $preset, string $from, string $to): string
    {
        return match ($preset) {
            'today' => 'Hari ini',
            '3d' => '3 hari terakhir',
            '7d' => '7 hari terakhir',
            '30d' => '30 hari terakhir',
            'range' => trim(
                ($from !== '' ? \Carbon\Carbon::parse($from)->translatedFormat('j M Y') : 'awal')
                .' - '.
                ($to !== '' ? \Carbon\Carbon::parse($to)->translatedFormat('j M Y') : 'sekarang')
            ),
            default => 'Semua waktu',
        };
    }
}
