<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\BankTransferInstructions;
use App\Support\BankTransferSettings;
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

        // Filter periode. Default '' (= Semua waktu) supaya perilaku halaman
        // tidak berubah sebelum admin memilih periode.
        $datePreset = trim((string) $request->input('date_preset', ''));
        $dateFrom = trim((string) $request->input('date_from', ''));
        $dateTo = trim((string) $request->input('date_to', ''));
        if (! in_array($datePreset, ['today', '3d', '7d', '30d', 'range'], true)) {
            $datePreset = '';
        }

        // Rentang berbasis created_at (tanggal transaksi dicatat). paid_at hanya
        // terisi pada sebagian baris, jadi tidak layak jadi dasar filter.
        $applyPeriod = function ($query) use ($datePreset, $dateFrom, $dateTo) {
            return $query
                ->when($datePreset === 'today', fn ($q) => $q->whereDate('created_at', now()->toDateString()))
                ->when($datePreset === '3d', fn ($q) => $q->where('created_at', '>=', now()->subDays(3)->startOfDay()))
                ->when($datePreset === '7d', fn ($q) => $q->where('created_at', '>=', now()->subDays(7)->startOfDay()))
                ->when($datePreset === '30d', fn ($q) => $q->where('created_at', '>=', now()->subDays(30)->startOfDay()))
                ->when($datePreset === 'range' && $dateFrom !== '', fn ($q) => $q->whereDate('created_at', '>=', $dateFrom))
                ->when($datePreset === 'range' && $dateTo !== '', fn ($q) => $q->whereDate('created_at', '<=', $dateTo));
        };

        // Agregasi Ringkasan Finansial Arus Kas. Mengikuti periode terpilih
        // supaya angka KPI, tab, dan tabel berbicara tentang himpunan data yang sama.
        $allPayments = $applyPeriod(Payment::query())->get(['payment_method', 'status', 'amount']);

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

        // Rekonsiliasi Pembayaran (P2-01, instruksi owner 2026-09-28). Semua
        // angka dibaca dari PENCATATAN WEBSITE (tabel payments dan tagihan
        // pesanan terkait), bukan mutasi rekening bank. Basis waktunya sama
        // dengan filter halaman ini. Status rekonsiliasi adalah label internal
        // yang dihitung dari catatan, bukan status dari API bank.
        $rekonsiliasiPayments = $applyPeriod(Payment::query())->get(['order_id', 'status', 'amount']);
        $tagihanOrder = (float) \App\Models\Order::query()
            ->whereIn('id', $rekonsiliasiPayments->pluck('order_id')->filter()->unique())
            ->sum('total_amount');
        $pembayaranTercatat = (float) $rekonsiliasiPayments->where('status', 'completed')->sum('amount');
        $refundTercatat = (float) $rekonsiliasiPayments->where('status', 'refunded')->sum('amount');
        $dibatalkanTercatat = (int) $rekonsiliasiPayments->where('status', 'cancelled')->count();
        $sisaTercatat = round($tagihanOrder - ($pembayaranTercatat - $refundTercatat), 2);

        $statusRekonsiliasi = match (true) {
            $refundTercatat > 0 && $pembayaranTercatat > 0 && $refundTercatat + 0.0001 >= $pembayaranTercatat => 'refunded_fully',
            $refundTercatat > 0 => 'refunded_partially',
            $tagihanOrder > 0 && $pembayaranTercatat + 0.0001 >= $tagihanOrder => 'paid',
            $pembayaranTercatat > 0 => 'partially_paid',
            default => 'unpaid',
        };
        $labelRekonsiliasi = [
            'unpaid' => 'Belum dibayar',
            'partially_paid' => 'Sebagian tercatat',
            'paid' => 'Lunas sesuai catatan',
            'refunded_partially' => 'Refund sebagian',
            'refunded_fully' => 'Refund penuh',
        ][$statusRekonsiliasi];

        $rekonsiliasi = [
            'total_tagihan' => round($tagihanOrder, 2),
            'pembayaran_tercatat' => round($pembayaranTercatat, 2),
            'refund_tercatat' => round($refundTercatat, 2),
            'sisa_tercatat' => $sisaTercatat,
            'status' => $statusRekonsiliasi,
            'status_label' => $labelRekonsiliasi,
            'payment_dibatalkan_count' => $dibatalkanTercatat,
            'disclaimer' => 'Rekonsiliasi ini berdasarkan pencatatan website dan verifikasi manual admin. Website tidak membaca mutasi rekening secara otomatis.',
            'catatan_verifikasi' => $dibatalkanTercatat > 0
                ? 'Terdapat '.$dibatalkanTercatat.' catatan pembayaran berstatus Dibatalkan pada periode ini. Verifikasi manual admin tetap diperlukan terhadap bukti transfer dan mutasi rekening.'
                : 'Verifikasi manual admin dilakukan terhadap bukti transfer dan mutasi rekening; catatan di sini hanya hasil pencatatan website.',
        ];

        // Query tabel pembayaran
        $paymentsQuery = $applyPeriod(
            Payment::query()
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
        )
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
            'bankTransfer' => BankTransferSettings::get(),
            'bankUpdateUrl' => route('admin.payments.bank-update'),
            'summary' => $summary,
            'rekonsiliasi' => $rekonsiliasi,
            'tabs' => $tabs,
            'activeStatus' => $status,
            'activeMethod' => $method,
            'searchQuery' => $q,
            'activeDatePreset' => $datePreset,
            'dateFrom' => $datePreset === 'range' ? $dateFrom : '',
            'dateTo' => $datePreset === 'range' ? $dateTo : '',
            'periodLabel' => $this->periodLabel($datePreset, $dateFrom, $dateTo),
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

    /**
     * Simpan detail rekening bank transfer (owner 2026-09-16). Dipakai pesan
     * WA payment_instructions & halaman konfirmasi order storefront.
     */
    public function updateBank(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:100'],
            'account_name' => ['required', 'string', 'max:191'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        BankTransferSettings::update($validated, (int) $request->user()->id);

        return redirect()
            ->route('admin.payments.index')
            ->with('success', 'Detail rekening bank transfer diperbarui.');
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
            'activeDatePreset' => '',
            'dateFrom' => '',
            'dateTo' => '',
            'periodLabel' => $this->periodLabel('', '', ''),
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

    /** Label periode aktif untuk ditampilkan di ringkasan KPI. */
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

    private function normalizeTransactionReference(Request $request): void
    {
        if (! $request->exists('transaction_reference')) {
            return;
        }

        $reference = trim((string) $request->input('transaction_reference'));
        $request->merge(['transaction_reference' => $reference !== '' ? $reference : null]);
    }
}
