<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ShippingRecord;
use App\Services\ShippingService;
use App\Support\InertiaAdmin;
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

        return Inertia::render('Admin/ResourceShow', [
            'title' => 'Pengiriman '.($shipping->waybill_number ?? '#'.$shipping->id),
            'subtitle' => $shipping->carrier_name,
            'fields' => [
                ['label' => 'Resi', 'value' => $shipping->waybill_number],
                ['label' => 'Kurir', 'value' => $shipping->carrier_name],
                ['label' => 'Status', 'value' => $shipping->status],
                ['label' => 'Pesanan', 'value' => $shipping->order?->order_number],
                ['label' => 'Update Terakhir', 'value' => optional($shipping->last_status_at)?->toDateTimeString()],
            ],
            'sections' => [],
        ]);
    }

    public function refreshStatus(ShippingService $shipping, ShippingRecord $shipping_record): RedirectResponse
    {
        $shipping->refreshStatus($shipping_record);

        return redirect()->back()->with('success', 'Status pengiriman disegarkan.');
    }
}
