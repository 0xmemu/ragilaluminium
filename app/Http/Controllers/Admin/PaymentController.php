<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\PhoneNumber;
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
        $status = trim((string) $request->input('status', 'all'));
        $method = trim((string) $request->input('method', 'all'));
        $q = trim((string) $request->input('q', ''));

        // Agregasi Ringkasan Finansial Arus Kas (Seluruh data di luar filter)
        $allPayments = Payment::query()->get(['payment_method', 'status', 'amount']);

        $totalReceived = (float) $allPayments->where('status', 'completed')->sum('amount');
        $completedCount = $allPayments->where('status', 'completed')->count();

        $transferPaid = (float) $allPayments->where('status', 'completed')->where('payment_method', 'transfer')->sum('amount');
        $transferCount = $allPayments->where('status', 'completed')->where('payment_method', 'transfer')->count();

        $codPaid = (float) $allPayments->where('status', 'completed')->where('payment_method', 'cod')->sum('amount');
        $codCount = $allPayments->where('status', 'completed')->where('payment_method', 'cod')->count();

        $pendingAmount = (float) $allPayments->where('status', 'pending')->sum('amount');
        $pendingCount = $allPayments->where('status', 'pending')->count();

        $summary = [
            'total_received' => $totalReceived,
            'completed_count' => $completedCount,
            'transfer_paid' => $transferPaid,
            'transfer_count' => $transferCount,
            'cod_paid' => $codPaid,
            'cod_count' => $codCount,
            'pending_amount' => $pendingAmount,
            'pending_count' => $pendingCount,
        ];

        // Hitungan per Tab Status
        $tabs = [
            ['key' => 'all', 'label' => 'Semua', 'count' => $allPayments->count()],
            ['key' => 'completed', 'label' => 'Lunas', 'count' => $completedCount],
            ['key' => 'pending', 'label' => 'Menunggu', 'count' => $pendingCount],
            ['key' => 'refunded', 'label' => 'Refund', 'count' => $allPayments->where('status', 'refunded')->count()],
        ];

        // Query tabel pembayaran
        $paymentsQuery = Payment::query()
            ->with(['order' => fn ($query) => $query->select([
                'id', 'order_number', 'order_status', 'customer_name', 'customer_phone',
            ])])
            ->when($status !== '' && $status !== 'all', fn ($query) => $query->where('status', $status))
            ->when($method !== '' && $method !== 'all', fn ($query) => $query->where('payment_method', $method))
            ->when($q !== '', function ($query) use ($q) {
                $query->where(function ($sub) use ($q) {
                    $sub->where('transaction_reference', 'like', "%{$q}%")
                        ->orWhereHas('order', function ($orderSub) use ($q) {
                            $orderSub->where('order_number', 'like', "%{$q}%")
                                ->orWhere('customer_name', 'like', "%{$q}%")
                                ->orWhere('customer_phone', 'like', "%{$q}%");
                        });
                });
            })
            ->latest('id');

        $paginated = $paymentsQuery->paginate(15)->withQueryString();

        $mappedData = $paginated->getCollection()->map(function (Payment $p): array {
            $order = $p->order;
            $phone = $order?->customer_phone ?? '';
            $waUrl = null;
            if ($phone !== '') {
                $cleanPhone = PhoneNumber::normalize($phone) ?? preg_replace('/\D/', '', $phone);
                $waUrl = "https://wa.me/{$cleanPhone}";
            }

            $methodLabel = match ($p->payment_method) {
                'cod' => 'COD (Bayar di Tempat)',
                'transfer' => 'Transfer Bank',
                default => strtoupper($p->payment_method),
            };

            $statusLabel = match ($p->status) {
                'completed' => 'Lunas',
                'pending' => $p->payment_method === 'cod' ? 'Bayar saat tiba' : 'Menunggu verifikasi',
                'refunded' => 'Refund',
                'cancelled' => 'Dibatalkan',
                default => ucfirst($p->status),
            };

            return [
                'id' => $p->id,
                'order_id' => $p->order_id,
                'order_number' => $order?->order_number ?? '-',
                'order_status' => $order?->order_status ?? null,
                'customer_name' => $order?->customer_name ?? '-',
                'customer_phone' => $phone,
                'whatsapp_url' => $waUrl,
                'payment_method' => $p->payment_method,
                'payment_method_label' => $methodLabel,
                'status' => $p->status,
                'status_label' => $statusLabel,
                'amount' => (float) $p->amount,
                'transaction_reference' => $p->transaction_reference,
                'evidence_url' => $p->evidence_url,
                'paid_at' => optional($p->paid_at)?->toIso8601String(),
                'created_at' => optional($p->created_at)?->toIso8601String() ?? now()->toIso8601String(),
                'order_href' => $p->order_id ? route('admin.orders.show', $p->order_id) : '#',
            ];
        });

        return Inertia::render('Admin/Payments/Index', [
            'title' => 'Pembayaran',
            'description' => 'Rekonsiliasi transaksi pembayaran toko, verifikasi transfer bank, dan penerimaan COD.',
            'summary' => $summary,
            'tabs' => $tabs,
            'activeStatus' => $status,
            'activeMethod' => $method,
            'searchQuery' => $q,
            'payments' => [
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

    public function byOrder(Order $order): Response
    {
        $order->load(['payments' => fn ($q) => $q->latest('id')]);

        return Inertia::render('Admin/Payments/Index', [
            'title' => 'Pembayaran Pesanan '.$order->order_number,
            'description' => 'Riwayat transaksi pembayaran untuk pesanan '.$order->order_number,
            'summary' => [
                'total_received' => (float) $order->payments->where('status', 'completed')->sum('amount'),
                'completed_count' => $order->payments->where('status', 'completed')->count(),
                'transfer_paid' => (float) $order->payments->where('status', 'completed')->where('payment_method', 'transfer')->sum('amount'),
                'transfer_count' => $order->payments->where('status', 'completed')->where('payment_method', 'transfer')->count(),
                'cod_paid' => (float) $order->payments->where('status', 'completed')->where('payment_method', 'cod')->sum('amount'),
                'cod_count' => $order->payments->where('status', 'completed')->where('payment_method', 'cod')->count(),
                'pending_amount' => (float) $order->payments->where('status', 'pending')->sum('amount'),
                'pending_count' => $order->payments->where('status', 'pending')->count(),
            ],
            'tabs' => [
                ['key' => 'all', 'label' => 'Semua', 'count' => $order->payments->count()],
            ],
            'activeStatus' => 'all',
            'activeMethod' => 'all',
            'searchQuery' => '',
            'payments' => [
                'data' => $order->payments->map(fn (Payment $p) => [
                    'id' => $p->id,
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'order_status' => $order->order_status,
                    'customer_name' => $order->customer_name,
                    'customer_phone' => $order->customer_phone,
                    'whatsapp_url' => $order->whatsapp_url,
                    'payment_method' => $p->payment_method,
                    'payment_method_label' => match ($p->payment_method) {
                        'cod' => 'COD (Bayar di Tempat)',
                        'transfer' => 'Transfer Bank',
                        default => strtoupper($p->payment_method),
                    },
                    'status' => $p->status,
                    'status_label' => match ($p->status) {
                        'completed' => 'Lunas',
                        'pending' => $p->payment_method === 'cod' ? 'Bayar saat tiba' : 'Menunggu verifikasi',
                        'refunded' => 'Refund',
                        'cancelled' => 'Dibatalkan',
                        default => ucfirst($p->status),
                    },
                    'amount' => (float) $p->amount,
                    'transaction_reference' => $p->transaction_reference,
                    'evidence_url' => $p->evidence_url,
                    'paid_at' => optional($p->paid_at)?->toIso8601String(),
                    'created_at' => optional($p->created_at)?->toIso8601String() ?? now()->toIso8601String(),
                    'order_href' => route('admin.orders.show', $order->id),
                ])->all(),
                'links' => [],
                'from' => 1,
                'to' => $order->payments->count(),
                'total' => $order->payments->count(),
                'per_page' => 100,
                'current_page' => 1,
                'last_page' => 1,
            ],
        ]);
    }

    public function store(Request $request, Order $order): RedirectResponse
    {
        $this->normalizeTransactionReference($request);

        $validated = $request->validate([
            'payment_method' => ['required', 'in:cod,transfer,gateway'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'status' => ['required', 'in:pending,completed,cancelled,refunded'],
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
            'status' => ['required', 'in:pending,completed,cancelled,refunded'],
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
