<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    public function index(Request $request): Response
    {
        $payments = Payment::with('order')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Pembayaran',
            'createHref' => null,
            'columns' => [
                ['key' => 'id', 'label' => 'ID'],
                ['key' => 'order_number', 'label' => 'Pesanan', 'hrefKey' => 'order_href'],
                ['key' => 'payment_method', 'label' => 'Metode'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'amount', 'label' => 'Jumlah', 'format' => 'idr'],
            ],
            'rows' => $payments->getCollection()->map(fn (Payment $p) => [
                'id' => $p->id,
                'order_number' => $p->order?->order_number ?? '-',
                'order_href' => $p->order_id ? route('admin.orders.show', $p->order_id) : '',
                'payment_method' => $p->payment_method,
                'status' => $p->status,
                'amount' => (float) $p->amount,
            ])->all(),
            'pagination' => InertiaAdmin::pagination($payments),
        ]);
    }

    public function byOrder(Order $order): Response
    {
        $order->load('payments');

        return Inertia::render('Admin/ResourceIndex', [
            'title' => 'Pembayaran · '.$order->order_number,
            'createHref' => null,
            'columns' => [
                ['key' => 'id', 'label' => 'ID'],
                ['key' => 'payment_method', 'label' => 'Metode'],
                ['key' => 'status', 'label' => 'Status'],
                ['key' => 'amount', 'label' => 'Jumlah', 'format' => 'idr'],
                ['key' => 'paid_at', 'label' => 'Dibayar'],
            ],
            'rows' => $order->payments->map(fn (Payment $p) => [
                'id' => $p->id,
                'payment_method' => $p->payment_method,
                'status' => $p->status,
                'amount' => (float) $p->amount,
                'paid_at' => optional($p->paid_at)?->toDateTimeString() ?? '-',
            ])->values()->all(),
            'pagination' => null,
        ]);
    }

    public function store(Request $request, Order $order): RedirectResponse
    {
        $this->normalizeTransactionReference($request);

        $validated = $request->validate([
            'payment_method' => ['required', 'in:cod,transfer,gateway'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'status' => ['required', 'in:pending,completed,failed,refunded'],
            'transaction_reference' => ['nullable', 'string', 'max:255', Rule::unique('payments', 'transaction_reference')],
            'evidence_url' => ['nullable', 'url'],
            'paid_at' => ['nullable', 'date'],
        ]);
        $validated['order_id'] = $order->id;
        $validated['created_by_user_id'] = $request->user()->id;
        $validated['updated_by_user_id'] = $request->user()->id;

        $payment = DB::transaction(function () use ($validated, $order, $request) {
            $payment = Payment::create($validated);

            if ($validated['status'] === 'completed') {
                $this->payments->markCompleted($order, $payment, $request->user()->id);
            } else {
                $this->payments->reconcile($order, $request->user()->id);
            }

            return $payment;
        });

        return redirect()->route('admin.orders.show', $order)
            ->with('success', 'Pembayaran dicatat.');
    }

    public function update(Request $request, Payment $payment): RedirectResponse
    {
        $this->normalizeTransactionReference($request);

        $validated = $request->validate([
            'status' => ['required', 'in:pending,completed,failed,refunded'],
            'transaction_reference' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('payments', 'transaction_reference')->ignore($payment->id),
            ],
            'evidence_url' => ['nullable', 'url'],
            'paid_at' => ['nullable', 'date'],
        ]);
        $validated['updated_by_user_id'] = $request->user()->id;

        DB::transaction(function () use ($validated, $payment, $request) {
            if ($validated['status'] === 'completed' && $payment->order) {
                $payment->fill([
                    'transaction_reference' => $validated['transaction_reference'] ?? $payment->transaction_reference,
                    'evidence_url' => $validated['evidence_url'] ?? $payment->evidence_url,
                    'paid_at' => $validated['paid_at'] ?? $payment->paid_at,
                    'updated_by_user_id' => $request->user()->id,
                ]);
                $payment->save();
                $this->payments->markCompleted($payment->order->fresh(), $payment->fresh(), $request->user()->id);

                return;
            }
            $payment->update($validated);
            $this->payments->reconcile($payment->order()->firstOrFail(), $request->user()->id);
        });

        return redirect()->route('admin.orders.show', $payment->order_id)
            ->with('success', 'Pembayaran diperbarui.');
    }

    private function normalizeTransactionReference(Request $request): void
    {
        if (! $request->exists('transaction_reference')) {
            return;
        }

        $reference = trim((string) $request->input('transaction_reference'));
        $request->merge(['transaction_reference' => $reference !== '' ? $reference : null]);
    }
}
