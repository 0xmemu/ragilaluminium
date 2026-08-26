<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Models\Order;
use App\Models\OrderReturnCase;
use App\Models\AdminNotification;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\ShippingService;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\OrderExport;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use App\Support\OrderEventLabels;
use App\Support\OrderStatusView;
use App\Support\OrderTrackingPresenter;
use App\Support\PhoneNumber;
use DomainException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OrderController extends Controller
{
    /** @var array<string, int> filter umur status (dashboard "Perlu perhatian") */
    private const OLDER_THAN_HOURS = ['24h' => 24, '2d' => 48, '7d' => 168];

    /** @var list<array{key: string, label: string}> */
    private const STATUS_TABS = [
        ['key' => 'all', 'label' => 'Semua'],
        ['key' => 'awaiting_confirmation', 'label' => 'Perlu Konfirmasi'],
        ['key' => 'processing', 'label' => 'Diproses'],
        ['key' => 'shipped', 'label' => 'Dikirim'],
        ['key' => 'delivered', 'label' => 'Sampai'],
        ['key' => 'completed', 'label' => 'Selesai'],
        ['key' => 'cancelled', 'label' => 'Dibatalkan'],
        ['key' => 'return_in_process', 'label' => 'Retur Diproses'],
        ['key' => 'return_completed', 'label' => 'Retur Selesai'],
        ['key' => 'issue', 'label' => 'Perlu Perhatian'],
    ];

    public function __construct(
        private readonly PaymentService $payments,
        private readonly ShippingService $shipping,
        private readonly OrderService $orders,
        private readonly \App\Services\WhatsAppService $whatsapp,
    ) {}

    public function index(Request $request): Response
    {
        $status = (string) $request->input('order_status', 'all');
        $sort = (string) $request->input('sort', 'newest');
        $paymentStatus = trim((string) $request->input('payment_status', ''));
        $shippingStatus = trim((string) $request->input('shipping_status', ''));
        $datePreset = trim((string) $request->input('date_preset', ''));
        $dateFrom = trim((string) $request->input('date_from', ''));
        $dateTo = trim((string) $request->input('date_to', ''));
        $olderThan = trim((string) $request->input('older_than', ''));
        if (! array_key_exists($olderThan, self::OLDER_THAN_HOURS)) {
            $olderThan = '';
        }

        if (! in_array($paymentStatus, ['pending', 'paid', 'refunded'], true)) {
            $paymentStatus = '';
        }
        if (! in_array($shippingStatus, ['pending_pickup', 'in_process', 'in_transit', 'delivered', 'cancelled'], true)) {
            $shippingStatus = '';
        }
        if (! in_array($datePreset, ['today', '7d', 'range'], true)) {
            $datePreset = '';
        }

        $base = Order::query();

        $tabCounts = Order::query()
            ->select('order_status', DB::raw('count(*) as total'))
            ->groupBy('order_status')
            ->pluck('total', 'order_status');

        $ordersQuery = Order::query()
            ->with([
                'items.product.mainImage',
                'items.productVariant',
                'shippingRecords' => fn ($q) => $q->latest('id'),
            ])
            ->withCount('items')
            ->withSum('items as units_count', 'quantity')
            ->when(
                $request->filled('q'),
                function ($q) use ($request) {
                    $term = trim((string) $request->input('q'));
                    $q->where(function ($inner) use ($term) {
                        LikeSearch::whereLike($inner, 'order_number', $term);
                        LikeSearch::orWhereLike($inner, 'customer_phone', $term);
                        LikeSearch::orWhereLike($inner, 'customer_name', $term);
                        LikeSearch::orWhereLike($inner, 'shipping_city', $term);
                        LikeSearch::orWhereLike($inner, 'shipping_province', $term);
                    });
                }
            )
            ->when(
                $status !== '' && $status !== 'all',
                fn ($q) => $q->where('order_status', $status)
            )
            ->when($paymentStatus !== '', fn ($q) => $q->where('payment_status', $paymentStatus))
            ->when($shippingStatus !== '', fn ($q) => $q->where('shipping_status', $shippingStatus))
            ->when(
                $olderThan !== '',
                fn ($q) => $q->where('updated_at', '<', now()->subHours(self::OLDER_THAN_HOURS[$olderThan]))
            )
            ->when($datePreset === 'today', fn ($q) => $q->whereDate('created_at', now()->toDateString()))
            ->when($datePreset === '7d', fn ($q) => $q->where('created_at', '>=', now()->subDays(7)->startOfDay()))
            ->when(
                $datePreset === 'range' && $dateFrom !== '',
                fn ($q) => $q->whereDate('created_at', '>=', $dateFrom)
            )
            ->when(
                $datePreset === 'range' && $dateTo !== '',
                fn ($q) => $q->whereDate('created_at', '<=', $dateTo)
            );

        $summary = [
            'count' => (int) (clone $ordersQuery)->count(),
            'total_value' => (float) (clone $ordersQuery)->sum('total_amount'),
        ];

        $orders = (clone $ordersQuery)
            ->when($sort === 'oldest', fn ($q) => $q->oldest())
            ->when($sort !== 'oldest', fn ($q) => $q->latest())
            ->paginate(10)
            ->withQueryString();

        $tabs = collect(self::STATUS_TABS)->map(function (array $tab) use ($tabCounts, $base) {
            $count = $tab['key'] === 'all'
                ? (clone $base)->count()
                : (int) ($tabCounts[$tab['key']] ?? 0);

            return [
                'key' => $tab['key'],
                'label' => $tab['label'],
                'count' => $count,
            ];
        })->values()->all();

        $filterQuery = array_filter([
            'order_status' => $status !== 'all' ? $status : null,
            'q' => trim((string) $request->input('q', '')) ?: null,
            'sort' => $sort === 'oldest' ? 'oldest' : null,
            'payment_status' => $paymentStatus ?: null,
            'shipping_status' => $shippingStatus ?: null,
            'older_than' => $olderThan ?: null,
            'date_preset' => $datePreset ?: null,
            'date_from' => $datePreset === 'range' && $dateFrom !== '' ? $dateFrom : null,
            'date_to' => $datePreset === 'range' && $dateTo !== '' ? $dateTo : null,
        ], fn ($v) => $v !== null && $v !== '');

        return Inertia::render('Admin/Orders/Index', [
            'title' => 'Daftar Pesanan',
            'description' => 'Kelola semua pesanan dari awal dibuat hingga selesai, dibatalkan, atau retur.',
            'tabs' => $tabs,
            'activeStatus' => $status === '' ? 'all' : $status,
            'activeSort' => $sort === 'oldest' ? 'oldest' : 'newest',
            'activePaymentStatus' => $paymentStatus,
            'activeShippingStatus' => $shippingStatus,
            'activeOlderThan' => $olderThan,
            'activeDatePreset' => $datePreset,
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'searchQuery' => trim((string) $request->input('q', '')),
            'summary' => $summary,
            'orders' => $orders->getCollection()->map(fn (Order $order) => $this->orderCard($order))->values()->all(),
            'pagination' => InertiaAdmin::pagination($orders),
            'exportUrl' => route('admin.orders.export', $filterQuery),
        ]);
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $status = (string) $request->input('order_status', 'all');
        $paymentStatus = trim((string) $request->input('payment_status', ''));
        $shippingStatus = trim((string) $request->input('shipping_status', ''));
        $datePreset = trim((string) $request->input('date_preset', ''));
        $dateFrom = trim((string) $request->input('date_from', ''));
        $dateTo = trim((string) $request->input('date_to', ''));
        $olderThan = trim((string) $request->input('older_than', ''));
        if (! array_key_exists($olderThan, self::OLDER_THAN_HOURS)) {
            $olderThan = '';
        }

        if (! in_array($paymentStatus, ['pending', 'paid', 'refunded'], true)) {
            $paymentStatus = '';
        }
        if (! in_array($shippingStatus, ['pending_pickup', 'in_process', 'in_transit', 'delivered', 'cancelled'], true)) {
            $shippingStatus = '';
        }
        if (! in_array($datePreset, ['today', '7d', 'range'], true)) {
            $datePreset = '';
        }

        $query = Order::query()
            ->withCount('items')
            ->withSum('items as units_count', 'quantity')
            ->when(
                $request->filled('q'),
                function ($q) use ($request) {
                    $term = trim((string) $request->input('q'));
                    $q->where(function ($inner) use ($term) {
                        LikeSearch::whereLike($inner, 'order_number', $term);
                        LikeSearch::orWhereLike($inner, 'customer_phone', $term);
                        LikeSearch::orWhereLike($inner, 'customer_name', $term);
                        LikeSearch::orWhereLike($inner, 'shipping_city', $term);
                        LikeSearch::orWhereLike($inner, 'shipping_province', $term);
                    });
                }
            )
            ->when(
                $status !== '' && $status !== 'all',
                fn ($q) => $q->where('order_status', $status)
            )
            ->when($paymentStatus !== '', fn ($q) => $q->where('payment_status', $paymentStatus))
            ->when($shippingStatus !== '', fn ($q) => $q->where('shipping_status', $shippingStatus))
            ->when(
                $olderThan !== '',
                fn ($q) => $q->where('updated_at', '<', now()->subHours(self::OLDER_THAN_HOURS[$olderThan]))
            )
            ->when($datePreset === 'today', fn ($q) => $q->whereDate('created_at', now()->toDateString()))
            ->when($datePreset === '7d', fn ($q) => $q->where('created_at', '>=', now()->subDays(7)->startOfDay()))
            ->when(
                $datePreset === 'range' && $dateFrom !== '',
                fn ($q) => $q->whereDate('created_at', '>=', $dateFrom)
            )
            ->when(
                $datePreset === 'range' && $dateTo !== '',
                fn ($q) => $q->whereDate('created_at', '<=', $dateTo)
            )
            ->latest();


        ExportSafety::assertQueryWithinLimit($query);

        return Excel::download(new OrderExport($query), 'pesanan-'.now()->format('Ymd-His').'.xlsx');

    }

    public function show(Order $order): Response
    {
        $order->load([
            'items.product.mainImage',
            'payments',
            'shippingRecords' => fn ($q) => $q->latest('id'),
            'whatsappMessages' => fn ($q) => $q->latest()->limit(10),
            'returnCases.items.orderItem',
        ]);

        $events = EventLog::query()
            ->where('entity_type', 'order')
            ->where('entity_id', $order->id)
            ->latest('created_at')
            ->limit(12)
            ->get()
            ->map(fn (EventLog $log) => [
                'event_type' => $log->event_type,
                'label' => OrderEventLabels::eventType(
                    (string) $log->event_type,
                    is_array($log->payload) ? $log->payload : [],
                ),
                'payload' => $log->payload,
                'created_at' => optional($log->created_at)?->toIso8601String(),
                'user_id' => $log->created_by_user_id,
            ])
            ->values()
            ->all();

        $phone = PhoneNumber::normalize($order->customer_phone) ?? $order->customer_phone;
        $isCod = $this->isCod($order);
        $primaryAction = $this->primaryActionFor($order);
        $activeShipping = $order->shippingRecords->first(
            fn ($s) => $s->status !== 'cancelled'
        ) ?? $order->shippingRecords->first();

        // Poll J&T saat buka detail (throttle ~2 menit), sama seperti status publik.
        if ($activeShipping?->waybill_number
            && (! $activeShipping->last_status_at || $activeShipping->last_status_at->lt(now()->subMinutes(2)))
        ) {
            $this->shipping->refreshStatus($activeShipping);
            $activeShipping->refresh();
            $order->refresh();
            $order->load(['shippingRecords' => fn ($q) => $q->latest('id')]);
        }

        return Inertia::render('Admin/Orders/Show', [
            'order' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_status' => $order->order_status,
                'payment_status' => $order->payment_status,
                'payment_bucket' => OrderStatusView::paymentBucket($order),
                'payment_label' => OrderStatusView::paymentLabel($order),
                'shipping_status' => $order->shipping_status,
                'payment_method' => $order->payment_method,
                'payment_method_label' => $isCod ? 'COD' : 'Transfer Bank',
                'cod_flag' => $isCod,
                'flow' => $isCod ? 'cod' : 'transfer',
                'flow_hint' => $this->flowHint($order),
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_email' => $order->customer_email,
                'shipping_address_line1' => $order->shipping_address_line1,
                'shipping_address_line2' => $order->shipping_address_line2,
                'shipping_village' => $order->shipping_village,
                'shipping_district' => $order->shipping_district,
                'shipping_city' => $order->shipping_city,
                'shipping_province' => $order->shipping_province,
                'shipping_postal_code' => $order->shipping_postal_code,
                'notes' => $order->notes,
                'admin_notes' => $order->admin_notes,
                'subtotal_amount' => (float) $order->subtotal_amount,
                'shipping_amount' => (float) $order->shipping_amount,
                'shipping_subsidy_amount' => (float) $order->shipping_subsidy_amount,
                'shipping_insurance_amount' => (float) $order->shipping_insurance_amount,
                'discount_amount' => (float) $order->discount_amount,
                'voucher_code' => $order->voucher_code,
                'voucher_discount_amount' => (float) $order->voucher_discount_amount,
                'cod_fee_amount' => (float) $order->cod_fee_amount,
                'total_amount' => (float) $order->total_amount,
                'product_count' => $order->items->count(),
                'unit_count' => (int) $order->items->sum('quantity'),
                'created_at' => optional($order->created_at)?->toIso8601String(),
                'updated_at' => optional($order->updated_at)?->toIso8601String(),
                'whatsapp_url' => $phone ? 'https://wa.me/'.$phone : null,
                'items' => $order->items->map(fn ($item) => $this->orderItemRow($item))->values()->all(),
                'payments' => $order->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'payment_method' => $p->payment_method,
                    'status' => $p->status,
                    'amount' => (float) $p->amount,
                    'transaction_reference' => $p->transaction_reference,
                    'evidence_url' => $p->evidence_url || null,
                    'paid_at' => optional($p->paid_at)?->toIso8601String(),
                ])->values()->all(),
                'shipping_records' => $order->shippingRecords->map(fn ($s) => [
                    'id' => $s->id,
                    'carrier_name' => $s->carrier_name,
                    'waybill_number' => $s->waybill_number,
                    'status' => $s->status,
                    'status_raw' => $s->status_raw,
                    'tracking_url' => $s->tracking_url,
                    'last_status_at' => optional($s->last_status_at)?->toIso8601String(),
                ])->values()->all(),
                'whatsapp_messages' => $order->whatsappMessages->map(fn ($m) => [
                    'id' => $m->id,
                    'direction' => $m->direction,
                    'status' => $m->status,
                    'internal_template_key' => $m->internal_template_key,
                    'label' => OrderEventLabels::whatsappTemplate($m->internal_template_key ?: $m->direction),
                    'phone_number' => $m->phone_number,
                    'sent_at' => optional($m->sent_at)?->toIso8601String(),
                    'received_at' => optional($m->received_at)?->toIso8601String(),
                ])->values()->all(),
                'return_cases' => $order->returnCases->map(fn ($case) => [
                    'id' => $case->id,
                    'status' => $case->status,
                    'reason' => $case->reason,
                    'reason_detail' => $case->reason_detail,
                    'fault_party' => $case->fault_party,
                    'shipping_cost_borne_by_store' => (bool) $case->shipping_cost_borne_by_store,
                    'resolution_type' => $case->resolution_type,
                    'customer_notes' => $case->customer_notes,
                    'admin_notes' => $case->admin_notes,
                    'refund_amount' => (float) $case->refund_amount,
                    'replacement_amount' => (float) $case->replacement_amount,
                    'additional_shipping_amount' => (float) $case->additional_shipping_amount,
                    'completed_at' => optional($case->completed_at)?->toIso8601String(),
                    'items' => $case->items->map(fn ($item) => [
                        'id' => $item->id,
                        'order_item_id' => $item->order_item_id,
                        'name' => $item->orderItem?->name,
                        'unit_price' => (float) optional($item->orderItem)->unit_price,
                        'requested_quantity' => (int) $item->requested_quantity,
                        'returned_quantity' => (int) $item->returned_quantity,
                        'replacement_product_id' => $item->replacement_product_id,
                        'replacement_variant_id' => $item->replacement_variant_id,
                        'replacement_quantity' => $item->replacement_quantity,
                    ])->values()->all(),
                ])->values()->all(),
            ],
            'events' => $events,
            'tracking' => OrderTrackingPresenter::forOrder($order, $activeShipping),
            'primaryAction' => $primaryAction,
            'secondaryAction' => $this->secondaryActionFor($order),
            'updateStatusUrl' => route('admin.orders.status', $order),
            'adminNotesUrl' => route('admin.orders.admin-notes.update', $order),
            'editPolicy' => $this->orders->editPolicy($order),
            'editUrl' => route('admin.orders.items.update', $order),
            'returnUrl' => route('admin.orders.returns.store', $order),
            'returnEligibility' => $this->returnEligibility($order),
            'shippingActions' => [
                'createUrl' => route('admin.orders.shipping.store', $order),
                'refreshUrl' => route('admin.orders.shipping.refresh', $order),
                // Readiness hanya mengontrol refresh tracking; pembuatan resi
                // tetap dilakukan manual di luar website.
                'jntEnabled' => \App\Support\JntReadiness::report()['client_ready'],
            ],
            'workflowLinks' => [
                ['label' => 'Kelola pembayaran', 'href' => route('admin.orders.payments', $order)],
                ['label' => 'Riwayat WhatsApp', 'href' => route('admin.orders.whatsapp', $order)],
                ['label' => 'Daftar pengiriman', 'href' => route('admin.shipping.index')],
            ],
        ]);
    }

    public function storeShipping(Request $request, Order $order): RedirectResponse
    {
        $validated = $request->validate([
            // Resi dibuat di J&T di luar aplikasi; admin hanya menempelkan
            // nomor resi yang sudah diterbitkan kurir.
            'mode' => ['nullable', 'in:manual'],
            'waybill_number' => ['required', 'string', 'max:100'],
            'mark_shipped' => ['nullable', 'boolean'],
        ]);

        if ($request->boolean('mark_shipped')
            && ! $this->orders->canTransition($order, 'shipped', 'shipping_store')) {
            return back()->withErrors([
                'mark_shipped' => 'Pesanan harus berstatus diproses sebelum ditandai dikirim.',
            ])->withInput();
        }

        try {
            $record = $this->shipping->attachManualWaybill($order, (string) $validated['waybill_number']);
        } catch (\Throwable $e) {
            return back()->with('error', $e->getMessage());
        }

        if ($request->boolean('mark_shipped')) {
            try {
                $this->orders->transition(
                    $order,
                    'shipped',
                    $request->user()->id,
                    'shipping_store',
                    ['waybill' => $record->waybill_number],
                );
            } catch (DomainException $exception) {
                return back()->withErrors(['mark_shipped' => $exception->getMessage()]);
            }
        }

        return redirect()->route('admin.orders.show', $order)
            ->with('success', 'Resi tersimpan: '.$record->waybill_number);
    }

    public function refreshShipping(Order $order): RedirectResponse
    {
        $record = $order->shippingRecords()
            ->whereNotIn('status', ['cancelled'])
            ->latest('id')
            ->first();

        if (! $record || ! $record->waybill_number) {
            return back()->with('error', 'Belum ada resi untuk dilacak.');
        }

        [$flashKey, $message] = $this->refreshShippingRecord($record);

        return redirect()->route('admin.orders.show', $order)->with($flashKey, $message);
    }

    /**
     * Refresh feedback must describe what actually happened. ShippingService
     * deliberately keeps a void API, so compare the persisted snapshot before
     * and after the call; an unchanged record is stale, not success.
     *
     * @return array{0: 'success'|'status'|'error', 1: string}
     */
    private function refreshShippingRecord(\App\Models\ShippingRecord $record): array
    {
        if (! \App\Support\JntReadiness::report()['client_ready']) {
            return ['status', 'Tracking J&T belum diperbarui: integrasi belum siap atau sedang nonaktif. Data terakhir tetap ditampilkan.'];
        }

        $before = [
            'status' => $record->status,
            'status_raw' => $record->status_raw,
            'last_status_at' => optional($record->last_status_at)?->toIso8601String(),
            'tracking_url' => $record->tracking_url,
        ];

        try {
            $this->shipping->refreshStatus($record);
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
     * Edit isi pesanan hanya saat Menunggu Konfirmasi. Hitung ulang harga/ongkir/total, kirim ulang WA
     * konfirmasi, catat log order.edited.
     */
    public function updateItems(Request $request, Order $order): RedirectResponse
    {
        $policy = $this->orders->editPolicy($order);
        if (! $policy['allowed']) {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['edit' => $policy['reason']]);
        }

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:150'],
            'customer_phone' => ['required', 'string', 'max:30'],
            'customer_email' => ['nullable', 'email', 'max:150'],
            'address_line1' => ['required', 'string', 'max:255'],
            'address_line2' => ['nullable', 'string', 'max:255'],
            'village' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'postal_code' => ['required', 'string', 'max:10'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'edit_note' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.item_id' => ['nullable', 'integer'],
            'items.*.parent_sku' => ['nullable', 'string', 'max:100'],
            'items.*.variant_sku' => ['nullable', 'string', 'max:100'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
        ], [], [
            'items' => 'daftar produk',
            'edit_note' => 'catatan perubahan',
            'customer_name' => 'nama penerima',
            'customer_phone' => 'nomor HP',
            'address_line1' => 'alamat',
            'city' => 'kota',
            'province' => 'provinsi',
            'postal_code' => 'kode pos',
        ]);

        $note = trim((string) ($validated['edit_note'] ?? ''));
        if ($policy['require_note'] && $note === '') {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['edit_note' => 'Pesanan Diproses memerlukan catatan perubahan.']);
        }

        try {
            $this->orders->editOrder($order, $validated, $request->user()->id, $note);
        } catch (\DomainException $e) {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['edit' => $e->getMessage()]);
        }

        $this->whatsapp->notifyOrderEdited($order->fresh());

        return redirect()->route('admin.orders.show', $order->fresh())
            ->with('success', 'Pesanan diperbarui. Harga dihitung ulang dan konfirmasi dikirim ulang ke pelanggan.');
    }

    public function createReturn(Request $request, Order $order): RedirectResponse
    {
        // Retur hanya dari delivered, payment paid, sebelum 48 jam, tanpa duplicate aktif.
        $eligibility = $this->returnEligibility($order);
        if (! $eligibility['eligible']) {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['return' => $eligibility['reason']]);
        }

        $validated = $request->validate([
            'reason' => ['required', 'in:rusak,pecah,salah_ukuran,salah_produk,kurang,lainnya'],
            'reason_detail' => ['nullable', 'string', 'max:500'],
            'customer_notes' => ['required', 'string', 'max:5000'],
            'admin_notes' => ['nullable', 'string', 'max:5000'],
            'fault_party' => ['nullable', 'in:store,customer,other'],
            'shipping_cost_borne_by_store' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.requested_quantity' => ['required', 'integer', 'min:1'],
        ]);

        if ($validated['reason'] === 'lainnya' && trim((string) ($validated['reason_detail'] ?? '')) === '') {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['reason_detail' => 'Keterangan wajib diisi untuk alasan Lainnya.'])
                ->withInput();
        }

        $faultParty = ($validated['fault_party'] ?? null)
            ?: $this->defaultFaultParty($validated['reason']);

        $order->load('items');
        $itemsById = $order->items->keyBy('id');
        foreach ($validated['items'] as $row) {
            $item = $itemsById->get((int) $row['order_item_id']);
            if (! $item || (int) $row['requested_quantity'] > (int) $item->quantity) {
                return redirect()->route('admin.orders.show', $order)
                    ->withErrors(['items' => 'Jumlah retur tidak boleh melebihi jumlah pada pesanan.'])
                    ->withInput();
            }
        }

        // Anti-duplikasi: tidak boleh ada kasus retur aktif (open) utk order ini.
        $hasActive = OrderReturnCase::query()
            ->where('order_id', $order->id)
            ->where('status', 'open')
            ->exists();
        if ($hasActive) {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['return' => 'Sudah ada kasus retur aktif untuk pesanan ini. Selesaikan atau tangani dulu.']);
        }

        $shippingCostBorne = array_key_exists('shipping_cost_borne_by_store', $validated)
            ? $request->boolean('shipping_cost_borne_by_store')
            : ($faultParty === 'store');

        $case = DB::transaction(function () use ($order, $validated, $request, $itemsById, $faultParty, $shippingCostBorne): OrderReturnCase {
            $case = OrderReturnCase::create([
                'order_id' => $order->id,
                'status' => 'open',
                'reason' => trim($validated['reason']),
                'reason_detail' => filled($validated['reason_detail'] ?? null) ? trim($validated['reason_detail']) : null,
                'fault_party' => $faultParty,
                'shipping_cost_borne_by_store' => $shippingCostBorne,
                'customer_notes' => trim($validated['customer_notes']),
                'admin_notes' => filled($validated['admin_notes'] ?? null) ? trim($validated['admin_notes']) : null,
                'created_by_user_id' => $request->user()->id,
                'updated_by_user_id' => $request->user()->id,
            ]);

            foreach ($validated['items'] as $row) {
                $item = $itemsById->get((int) $row['order_item_id']);
                $case->items()->create([
                    'order_item_id' => $item->id,
                    'requested_quantity' => (int) $row['requested_quantity'],
                    'returned_quantity' => 0,
                ]);
            }

            $this->orders->transition(
                $order,
                'return_in_process',
                $request->user()->id,
                'admin_return',
                ['return_case_id' => $case->id, 'reason' => $case->reason],
            );

            return $case;
        });

        // Sprint 2.1: notifikasi admin dipancarkan via event (idempoten per return_case_id).
        \App\Events\OrderReturnCreated::dispatch($order, $case);

        $this->whatsapp->sendTemplateMessage(
            $order->customer_phone,
            'order_issue_followup',
            [$order->customer_name ?: 'Kak', $order->order_number],
            $order->id,
        );

        return redirect()->route('admin.orders.show', $order)
            ->with('success', 'Kasus retur dicatat dan status pesanan menjadi Retur Diproses.');
    }

    public function completeReturn(Request $request, Order $order, OrderReturnCase $returnCase, \App\Services\ReturnService $returns): RedirectResponse
    {
        if ((int) $returnCase->order_id !== (int) $order->id || $order->order_status !== 'return_in_process') {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['return' => 'Kasus retur tidak cocok dengan status pesanan.']);
        }
        // Idempotency: case yang sudah completed tidak boleh di-submit ulang.
        if ($returnCase->status !== 'open') {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['return' => 'Kasus retur sudah diselesaikan.']);
        }

        $validated = $request->validate([
            'resolution_type' => ['required', 'in:refund,replacement,reship,compensation,no_compensation'],
            'admin_notes' => ['required', 'string', 'max:5000'],
            'refund_amount' => ['nullable', 'numeric', 'min:0'],
            'replacement_amount' => ['nullable', 'numeric', 'min:0'],
            'additional_shipping_amount' => ['nullable', 'numeric', 'min:0'],
            'return_shipping_cost' => ['nullable', 'numeric', 'min:0'],
            'returned_items' => ['nullable', 'array'],
            'returned_items.*.id' => ['required', 'integer'],
            'returned_items.*.returned_quantity' => ['required', 'integer', 'min:0'],
            'replacement_items' => ['nullable', 'array'],
            'replacement_items.*.order_item_id' => ['required', 'integer'],
            'replacement_items.*.product_id' => ['required', 'integer'],
            'replacement_items.*.variant_id' => ['nullable', 'integer'],
            'replacement_items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $shippingCost = (float) ($validated['return_shipping_cost'] ?? 0);
        $costCheck = $returns->validateReturnShippingCost((string) $returnCase->fault_party, $shippingCost);
        if (! $costCheck['valid']) {
            return redirect()->route('admin.orders.show', $order)
                ->withErrors(['return_shipping_cost' => $costCheck['error']])
                ->withInput();
        }

        if ($validated['resolution_type'] === 'refund') {
            $refund = (float) ($validated['refund_amount'] ?? 0);
            $maxRefund = (float) $order->total_amount;
            if ($refund < 0 || $refund > $maxRefund) {
                return redirect()->route('admin.orders.show', $order)
                    ->withErrors(['refund_amount' => 'Refund tidak boleh melebihi total pembayaran pesanan.'])
                    ->withInput();
            }
        }

        if ($validated['resolution_type'] !== 'replacement') {
            $validated['replacement_items'] = null;
        }

        // Validasi & stok replacement di dalam transaksi dgn locking.
        DB::transaction(function () use ($request, $order, $returnCase, $validated, $shippingCost): void {
            $replacement = $validated['replacement_items'] ?? null;

            if ($replacement) {
                foreach ($replacement as $row) {
                    $product = \App\Models\Product::query()->lockForUpdate()->find((int) $row['product_id']);
                    if (! $product) {
                        throw new \Illuminate\Validation\ValidationException(
                            request(), ['replacement_items' => 'Produk pengganti tidak ditemukan.']
                        );
                    }
                    if ($row['variant_id']) {
                        $variant = \App\Models\ProductVariant::query()->lockForUpdate()->find((int) $row['variant_id']);
                        if (! $variant || (int) $variant->product_id !== (int) $product->id) {
                            throw new \Illuminate\Validation\ValidationException(
                                request(), ['replacement_items' => 'Varian pengganti tidak cocok dengan produk.']
                            );
                        }
                        $stock = (int) $variant->stock;
                        if ($stock < (int) $row['quantity']) {
                            throw new \Illuminate\Validation\ValidationException(
                                request(), ['replacement_items' => 'Stok pengganti tidak mencukupi (tersedia '.$stock.').']
                            );
                        }
                    } else {
                        $stock = (int) $product->stock;
                        if ($stock < (int) $row['quantity']) {
                            throw new \Illuminate\Validation\ValidationException(
                                request(), ['replacement_items' => 'Stok pengganti tidak mencukupi (tersedia '.$stock.').']
                            );
                        }
                    }
                }

                foreach ($replacement as $row) {
                    $returnItem = $returnCase->items()
                        ->where('order_item_id', (int) $row['order_item_id'])
                        ->first();
                    if (! $returnItem) {
                        $returnItem = $returnCase->items()->create([
                            'order_item_id' => (int) $row['order_item_id'],
                            'requested_quantity' => (int) $row['quantity'],
                            'returned_quantity' => 0,
                        ]);
                    }
                    $returnItem->update([
                        'replacement_product_id' => (int) $row['product_id'],
                        'replacement_variant_id' => $row['variant_id'] ? (int) $row['variant_id'] : null,
                        'replacement_quantity' => (int) $row['quantity'],
                    ]);

                    // Kurangi stok tepat satu kali. Idempotensi dijamin blok atas
                    // (case status !== 'open' -> reject) sehingga tidak dobel dekremen.
                    $product = \App\Models\Product::find((int) $row['product_id']);
                    if ($row['variant_id']) {
                        \App\Models\ProductVariant::find((int) $row['variant_id'])->decrement('stock', (int) $row['quantity']);
                    } else {
                        $product->decrement('stock', (int) $row['quantity']);
                    }
                }
            }

            $returnCase->update([
                'status' => 'completed',
                'resolution_type' => $validated['resolution_type'],
                'admin_notes' => trim($validated['admin_notes']),
                'refund_amount' => (float) ($validated['refund_amount'] ?? 0),
                'replacement_amount' => (float) ($validated['replacement_amount'] ?? 0),
                'additional_shipping_amount' => (float) ($validated['additional_shipping_amount'] ?? 0),
                'return_shipping_cost' => $shippingCost,
                'completed_at' => now(),
                'updated_by_user_id' => $request->user()->id,
            ]);

            foreach ($validated['returned_items'] ?? [] as $row) {
                $returnCase->items()->whereKey((int) $row['id'])->update([
                    'returned_quantity' => (int) $row['returned_quantity'],
                ]);
            }

            $this->orders->transition(
                $order,
                'return_completed',
                $request->user()->id,
                'admin_return',
                [
                    'return_case_id' => $returnCase->id,
                    'resolution_type' => $validated['resolution_type'],
                    'refund_amount' => (float) ($validated['refund_amount'] ?? 0),
                ],
            );
        });

        $this->whatsapp->sendTemplateMessage(
            $order->customer_phone,
            'order_returned',
            [$order->customer_name ?: 'Kak', $order->order_number, '-'],
            $order->id,
        );

        return redirect()->route('admin.orders.show', $order)
            ->with('success', 'Kasus retur selesai dan tercatat dalam riwayat order.');
    }

    /**
     * Kelayakan membuat retur (blueprint Sprint 2): hanya delivered + paid + dalam 48 jam.
     *
     * @return array{eligible: bool, reason: string|null, deadline: string|null}
     */
    protected function returnEligibility(Order $order): array
    {
        if ($order->order_status !== 'delivered') {
            return [
                'eligible' => false,
                'reason' => $order->order_status === 'completed'
                    ? 'Retur hanya dapat dicatat untuk pesanan berstatus Sampai. Pesanan selesai tidak dapat diretur di sistem; tindak lanjuti melalui WhatsApp.'
                    : 'Retur hanya dapat dicatat untuk pesanan yang sudah sampai (delivered).',
                'deadline' => null,
            ];
        }

        if ($order->payment_status !== 'paid') {
            return ['eligible' => false, 'reason' => 'Pesanan belum tercatat lunas.', 'deadline' => null];
        }

        $deliveredAt = $order->shippingRecords
            ->sortByDesc('last_status_at')
            ->first(fn ($s) => $s->status === 'delivered' && $s->last_status_at !== null)?->last_status_at;

        if (! $deliveredAt) {
            return ['eligible' => false, 'reason' => 'Waktu paket sampai belum tersedia.', 'deadline' => null];
        }

        $deadline = $deliveredAt->copy()->addHours(48);

        if (now()->gt($deadline)) {
            return [
                'eligible' => false,
                'reason' => 'Batas retur 48 jam telah lewat. Untuk komplain lebih lanjut, hubungi pelanggan melalui WhatsApp.',
                'deadline' => $deadline->toIso8601String(),
            ];
        }

        return ['eligible' => true, 'reason' => null, 'deadline' => $deadline->toIso8601String()];
    }

    protected function defaultFaultParty(string $reason): string
    {
        return in_array($reason, ['rusak', 'pecah', 'salah_ukuran', 'salah_produk', 'kurang'], true)
            ? 'store'
            : 'other';
    }

    public function statusEntry(Order $order): RedirectResponse
    {
        return redirect()
            ->route("admin.orders.show", $order)
            ->with("info", "Status pesanan diubah melalui tombol tindakan pada detail pesanan.");
    }

    public function updateStatus(Request $request, Order $order): RedirectResponse
    {
        $validated = $request->validate([
            'order_status' => ['required', 'in:pending,processing,shipped,delivered,completed,issue,return_in_process,return_completed,cancelled'],
            'cancel_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $from = $order->order_status;
        $to = $validated['order_status'];
        if (in_array($to, ['return_in_process', 'return_completed'], true)) {
            return $this->statusRedirect($request, $order)->withErrors(['order_status' => 'Retur wajib diselesaikan melalui form retur admin agar item, jumlah, dan catatan terdokumentasi.']);
        }
        if ($to === 'delivered') {
            return $this->statusRedirect($request, $order)->withErrors(['order_status' => 'Sampai hanya diperbarui dari tracking pengiriman J&T, tidak dari tangan admin (spec: tidak ada tombol Tandai Sampai).']);
        }
        $userId = $request->user()->id;
        $isCod = $this->isCod($order);
        $cancelReason = filled($validated['cancel_reason'] ?? null)
            ? trim((string) $validated['cancel_reason'])
            : null;

        if (! $this->orders->canTransition($order, $to, 'admin_status')) {
            return $this->statusRedirect($request, $order)
                ->withErrors(['order_status' => "Perubahan status {$from} → {$to} tidak diizinkan."]);
        }

        if ($to === 'cancelled') {
            try {
                $changed = $this->orders->cancel($order, $userId, $cancelReason);
            } catch (DomainException $exception) {
                return $this->statusRedirect($request, $order)
                    ->withErrors(['order_status' => $exception->getMessage()]);
            }

            return $this->statusRedirect($request, $order->fresh())
                ->with('success', $changed ? 'Pesanan dibatalkan dan stok dikembalikan.' : 'Pesanan sudah dibatalkan.');
        }

        // Transfer: proses dari "perlu konfirmasi" = konfirmasi transfer dulu.
        if ($from === 'awaiting_confirmation' && $to === 'processing' && ! $isCod && $order->payment_status !== 'paid') {
            $this->payments->completePendingForOrder($order, $userId, 'transfer');
            $order->refresh();

            if ($order->order_status === 'processing') {
                return $this->statusRedirect($request, $order)
                    ->with('success', 'Transfer dikonfirmasi. Pesanan diproses.');
            }
        }

        // COD: tombol Proses → processing + WA "pesanan diproses" (tanpa menandai lunas).
        if ($from === 'awaiting_confirmation' && $to === 'processing' && $isCod) {
            $this->orders->beginProcessing($order, $userId, 'admin');

            return $this->statusRedirect($request, $order)
                ->with('success', 'Pesanan COD diproses. Pelanggan mendapat notifikasi WhatsApp.');
        }


        if ($order->order_status !== $to) {
            try {
                $this->orders->transition(
                    $order,
                    $to,
                    $userId,
                    'admin_status',
                    ['flow' => $isCod ? 'cod' : 'transfer'],
                );
            } catch (DomainException $exception) {
                return $this->statusRedirect($request, $order->fresh())
                    ->withErrors(['order_status' => $exception->getMessage()]);
            }
        }

        // COD dibayar otomatis tepat setelah status order menjadi completed.
        // Audit memakai event sistem agar tidak bergantung pada admin.
        if ($isCod && $to === 'completed' && $order->payment_status !== 'paid') {
            $this->payments->completeCodAtCompletion($order);
            $order->refresh();
        }

        // Spec ??H: pesan WA otomatis saat retur masuk (issue) dan retur selesai (return_completed).
        if ($order->order_status === $to && in_array($to, ['issue', 'return_in_process'], true)) {
            $this->whatsapp->sendTemplateMessage(
                $order->customer_phone,
                'order_issue_followup',
                [$order->customer_name ?: 'Kak', $order->order_number],
                $order->id,
            );
        } elseif ($order->order_status === $to && $to === 'return_completed') {
            $waybill = (string) ($order->shippingRecords()->latest()->value('waybill_number') ?: '-');
            $this->whatsapp->sendTemplateMessage(
                $order->customer_phone,
                'order_returned',
                [$order->customer_name ?: 'Kak', $order->order_number, $waybill],
                $order->id,
            );
        }

        $message = match (true) {
            $isCod && in_array($to, ['delivered', 'completed'], true) => 'Pesanan diperbarui. Pembayaran COD dikonfirmasi.',
            default => 'Status pesanan diperbarui.',
        };

        return $this->statusRedirect($request, $order)->with('success', $message);
    }

    private function statusRedirect(Request $request, Order $order): RedirectResponse
    {
        if ($request->input('redirect_to') === 'index') {
            return redirect()->route('admin.orders.index', array_filter([
                'order_status' => $request->input('filter_status'),
                'q' => $request->input('filter_q'),
                'sort' => $request->input('filter_sort'),
                'payment_status' => $request->input('filter_payment_status'),
                'shipping_status' => $request->input('filter_shipping_status'),
                'older_than' => $request->input('filter_older_than'),
                'date_preset' => $request->input('filter_date_preset'),
                'date_from' => $request->input('filter_date_from'),
                'date_to' => $request->input('filter_date_to'),
            ], fn ($value) => filled($value) && $value !== 'all'));
        }

        return redirect()->route('admin.orders.show', $order);
    }

    /** @return array<string, mixed> */
    private function orderCard(Order $order): array
    {
        $phone = PhoneNumber::normalize($order->customer_phone) ?? $order->customer_phone;
        $items = $order->items ?? collect();
        $isCod = $this->isCod($order);
        $shipping = null;
        if ($order->relationLoaded('shippingRecords')) {
            $shipping = $order->shippingRecords->first(
                fn ($record) => $record->status !== 'cancelled'
            ) ?? $order->shippingRecords->first();
        }

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'order_status' => $order->order_status,
            'payment_status' => $order->payment_status,
            'payment_bucket' => OrderStatusView::paymentBucket($order),
            'payment_label' => OrderStatusView::paymentLabel($order),
            'shipping_status' => $order->shipping_status,
            'payment_method' => $order->payment_method,
            'payment_method_label' => $isCod ? 'COD' : 'Transfer Bank',
            'cod_flag' => $isCod,
            'flow' => $isCod ? 'cod' : 'transfer',
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'customer_email' => $order->customer_email,
            'shipping_address_line1' => $order->shipping_address_line1,
            'shipping_address_line2' => $order->shipping_address_line2,
            'shipping_village' => $order->shipping_village,
            'shipping_district' => $order->shipping_district,
            'shipping_city' => $order->shipping_city,
            'shipping_province' => $order->shipping_province,
            'shipping_postal_code' => $order->shipping_postal_code,
            'notes' => $order->notes,
            'admin_notes' => $order->admin_notes,
            'subtotal_amount' => (float) $order->subtotal_amount,
            'shipping_amount' => (float) $order->shipping_amount,
            'shipping_subsidy_amount' => (float) $order->shipping_subsidy_amount,
            'shipping_insurance_amount' => (float) $order->shipping_insurance_amount,
            'discount_amount' => (float) $order->discount_amount,
            'voucher_code' => $order->voucher_code,
            'voucher_discount_amount' => (float) $order->voucher_discount_amount,
            'cod_fee_amount' => (float) $order->cod_fee_amount,
            'total_amount' => (float) $order->total_amount,
            'product_count' => (int) $order->items_count,
            'unit_count' => (int) ($order->units_count ?? 0),
            'created_at' => optional($order->created_at)?->toIso8601String(),
            'updated_at' => optional($order->updated_at)?->toIso8601String(),
            'href' => route('admin.orders.show', $order),
            'whatsapp_url' => $phone ? 'https://wa.me/'.$phone : null,
            'primary_action' => $this->primaryActionFor($order),
            'secondary_action' => $this->secondaryActionFor($order),
            'shipping_track' => OrderTrackingPresenter::forOrder($order, $shipping, withTimeline: false),
            'items' => $items->map(fn ($item) => $this->orderItemRow($item))->values()->all(),
            'items_total' => (int) $order->items_count,
        ];
    }

    /** @return array<string, mixed> */
    private function orderItemRow($item): array
    {
        $image = null;
        if ($item->relationLoaded('product') && $item->product?->relationLoaded('mainImage')) {
            $image = $item->product->mainImage?->urlFor('card');
        }

        return [
            'id' => $item->id,
            'name' => $item->name,
            'product_id' => (int) $item->product_id,
            'variant_id' => $item->product_variant_id !== null ? (int) $item->product_variant_id : null,
            'variant_sku' => $item->variant_sku,
            'variation_1_name' => $item->variation_1_name,
            'variation_1_option' => $item->variation_1_option,
            'variation_2_name' => $item->variation_2_name,
            'variation_2_option' => $item->variation_2_option,
            'quantity' => (int) $item->quantity,
            'unit_price' => (float) $item->unit_price,
            'line_total' => (float) $item->line_total,
            'note' => $item->note ?? null,
            'weight_kg' => $item->productVariant?->weight_kg !== null
                ? (float) $item->productVariant->weight_kg
                : null,
            'volume_m3' => $this->itemVolumeM3($item),
            'image' => $image,
        ];
    }

    /** Volume kotor item (m3) dari dimensi varian; null bila tidak lengkap. */
    private function itemVolumeM3($item): ?float
    {
        $v = $item->productVariant;
        if (! $v || $v->width_cm === null || $v->height_cm === null || $v->depth_cm === null) {
            return null;
        }
        return round(((float) $v->width_cm * (float) $v->height_cm * (float) $v->depth_cm) / 1_000_000, 3);
    }

    private function isCod(Order $order): bool
    {
        return (bool) $order->cod_flag || $order->payment_method === 'cod';
    }

    private function flowHint(Order $order): string
    {
        $isCod = $this->isCod($order);

        if ($isCod) {
            return match ($order->order_status) {
                'awaiting_confirmation' => 'COD: proses pesanan tanpa menunggu transfer. Tagihan ditagih saat paket diterima.',
                'processing', 'shipped' => 'COD: pembayaran masih menunggu. Konfirmasi lunas saat paket sampai.',
                'delivered' => 'COD: konfirmasi pembayaran diterima bersama penyelesaian pesanan.',
                'completed' => 'COD: pesanan selesai dan pembayaran sudah dikonfirmasi.',
                default => 'Alur COD: bayar saat diterima.',
            };
        }

        return match ($order->order_status) {
            'awaiting_confirmation' => 'Transfer: pastikan bukti transfer valid, lalu proses untuk menandai lunas dan mulai fulfillment.',
            'processing', 'shipped' => 'Transfer: pembayaran sudah dikonfirmasi. Lanjutkan pengiriman.',
            'delivered' => 'Transfer: paket sudah sampai. Selesaikan pesanan bila tidak ada komplain.',
            default => 'Alur Transfer Bank: bayar dulu, baru diproses.',
        };
    }

    /**
     * @return array{label: string, next_status: string|null, kind: string, hint: string|null}|null
     */
    private function primaryActionFor(Order $order): ?array
    {
        $isCod = $this->isCod($order);

        return match ($order->order_status) {
            'issue' => [
                'label' => 'Lanjutkan Proses',
                'next_status' => 'processing',
                'kind' => 'advance_status',
                'hint' => 'Pesanan kembali ke antrean proses untuk dilanjutkan.',
            ],
            'awaiting_confirmation' => [
                'label' => 'Proses Pesanan',
                'next_status' => 'processing',
                'kind' => $isCod ? 'advance_cod' : 'confirm_transfer',
                'hint' => $isCod
                    ? 'Memproses pesanan COD tanpa menunggu pembayaran.'
                    : 'Mengonfirmasi transfer dan memproses pesanan.',
            ],
            'processing' => [
                'label' => 'Input Resi',
                'next_status' => 'shipped',
                'kind' => 'input_resi',
                'hint' => 'Buat resi J&T atau isi nomor resi di blok Lacak pesanan.',
            ],

            'delivered' => [
                'label' => 'Selesaikan Pesanan',
                'next_status' => 'completed',
                'kind' => $isCod && $order->payment_status !== 'paid' ? 'settle_cod' : 'advance_status',
                'hint' => $isCod && $order->payment_status !== 'paid'
                    ? 'Menyelesaikan pesanan dan mengonfirmasi pembayaran COD.'
                    : null,
            ],
            'return_in_process' => [
                'label' => 'Selesaikan Retur',
                'next_status' => null,
                'kind' => 'complete_return',
                'hint' => 'Lengkapi form retur (jumlah item dikembalikan & nilai refund) untuk menutup retur dan mengirim notifikasi WhatsApp.',
                'href' => route('admin.orders.show', $order).'#return-case',
            ],
            default => null,
        };
    }

    /**
     * Tindakan sekunder yang mengikuti status (spec §Tindakan Pesanan).
     *
     * @return array{label: string, next_status: string|null, kind: string, hint: string|null}|null
     */
    private function secondaryActionFor(Order $order): ?array
    {
        return match ($order->order_status) {
            // Perlu Perhatian → Lanjutkan Proses (primary) + Proses Retur (sekunder).
            'issue' => [
                'label' => 'Catat Retur',
                'next_status' => null,
                'kind' => 'start_return',
                'hint' => 'Buka form retur admin dan lengkapi alasan serta item yang dikembalikan.',
                'href' => route('admin.orders.show', $order).'#return-case',
            ],
            // Sampai → Selesaikan Pesanan (primary) + Proses Retur (sekunder).
            'completed' => [
                'label' => 'Catat Retur',
                'next_status' => null,
                'kind' => 'start_return',
                'hint' => 'Buka form retur admin dan lengkapi alasan serta item yang dikembalikan.',
                'href' => route('admin.orders.show', $order).'#return-case',
            ],
            'delivered' => [
                'label' => 'Catat Retur',
                'next_status' => null,
                'kind' => 'start_return',
                'hint' => 'Buka form retur admin dan lengkapi alasan serta item yang dikembalikan.',
                'href' => route('admin.orders.show', $order).'#return-case',
            ],
            default => null,
        };
    }

    /**
     * Simpan catatan internal admin (spec §Catatan Internal Admin):
     * satu kolom, bisa tambah/ubah/hapus, tidak masuk invoice/WhatsApp.
     */
    public function updateAdminNotes(Request $request, Order $order): RedirectResponse
    {
        $validated = $request->validate([
            'admin_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $note = filled($validated['admin_notes'] ?? null)
            ? trim((string) $validated['admin_notes'])
            : null;

        $order->update(['admin_notes' => $note]);

        return back()->with('success', $note === null
            ? 'Catatan internal dihapus.'
            : 'Catatan internal disimpan.');
    }
}
