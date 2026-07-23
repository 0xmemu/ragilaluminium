<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Support\PhoneNumber;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CustomerService
{
    public const REVENUE_STATUSES = StorePerformanceService::REVENUE_STATUSES;

    /**
     * @param  array{
     *   name: string,
     *   phone: string,
     *   email?: string|null,
     *   address_line1?: string|null,
     *   address_line2?: string|null,
     *   city?: string|null,
     *   province?: string|null,
     *   postal_code?: string|null,
     *   country?: string|null
     * }  $data
     */
    public function upsertFromCheckout(array $data): Customer
    {
        $phone = PhoneNumber::normalize($data['phone']) ?? $data['phone'];

        $customer = Customer::query()->firstOrNew(['phone' => $phone]);
        $customer->name = $data['name'] ?: ($customer->name ?: 'Pelanggan');
        if (array_key_exists('email', $data) && filled($data['email'])) {
            $customer->email = $data['email'];
        }
        if (! empty($data['address_line1'])) {
            $customer->default_address_line1 = $data['address_line1'];
            $customer->default_address_line2 = $data['address_line2'] ?? null;
            $customer->default_city = $data['city'] ?? null;
            $customer->default_province = $data['province'] ?? null;
            $customer->default_postal_code = $data['postal_code'] ?? null;
            $customer->default_country = $data['country'] ?? 'Indonesia';
        }
        $customer->save();

        return $customer;
    }

    /**
     * Backfill customers dari snapshot order yang belum punya baris customers.
     */
    public function syncMissingFromOrders(int $limit = 500): int
    {
        $existing = Customer::query()->pluck('phone')->all();
        $existingFlip = array_fill_keys($existing, true);

        $rows = Order::query()
            ->select([
                'customer_phone',
                DB::raw('MAX(id) as latest_id'),
            ])
            ->whereNotNull('customer_phone')
            ->where('customer_phone', '!=', '')
            ->groupBy('customer_phone')
            ->orderByDesc('latest_id')
            ->limit($limit)
            ->get();

        $created = 0;
        foreach ($rows as $row) {
            $phone = PhoneNumber::normalize($row->customer_phone) ?? $row->customer_phone;
            if (isset($existingFlip[$phone]) || isset($existingFlip[$row->customer_phone])) {
                continue;
            }

            $order = Order::query()->find($row->latest_id);
            if (! $order) {
                continue;
            }

            $this->upsertFromCheckout([
                'name' => $order->customer_name,
                'phone' => $phone,
                'email' => $order->customer_email,
                'address_line1' => $order->shipping_address_line1,
                'address_line2' => $order->shipping_address_line2,
                'city' => $order->shipping_city,
                'province' => $order->shipping_province,
                'postal_code' => $order->shipping_postal_code,
                'country' => $order->shipping_country,
            ]);
            $existingFlip[$phone] = true;
            $created++;
        }

        // Link unlinked orders by phone.
        Customer::query()->chunkById(100, function ($customers) {
            foreach ($customers as $customer) {
                Order::query()
                    ->whereNull('customer_id')
                    ->where('customer_phone', $customer->phone)
                    ->update(['customer_id' => $customer->id]);
            }
        });

        return $created;
    }

    public function publicCode(Customer $customer): string
    {
        return 'CUS-'.str_pad((string) $customer->id, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Skor risiko 0–100 (lebih tinggi = lebih berisiko). Diturunkan dari riwayat order — bukan kolom DB.
     *
     * @return array{score: int, label: string, tone: string}
     */
    public function fraudAssessment(Customer $customer): array
    {
        $orders = Order::query()->where('customer_phone', $customer->phone)->get([
            'order_status', 'shipping_city', 'created_at',
        ]);

        if ($orders->isEmpty()) {
            return ['score' => 0, 'label' => 'RISIKO RENDAH', 'tone' => 'success'];
        }

        $score = 5;
        $cancelled = $orders->where('order_status', 'cancelled')->count();
        $returns = $orders->whereIn('order_status', ['return_in_process', 'issue'])->count();
        $cities = $orders->pluck('shipping_city')->filter()->unique()->count();

        $score += min(40, $cancelled * 15);
        $score += min(40, $returns * 20);
        if ($cities >= 3) {
            $score += 15;
        } elseif ($cities === 2) {
            $score += 8;
        }

        $score = min(100, $score);

        return match (true) {
            $score >= 60 => ['score' => $score, 'label' => 'RISIKO TINGGI', 'tone' => 'danger'],
            $score >= 30 => ['score' => $score, 'label' => 'RISIKO SEDANG', 'tone' => 'warning'],
            default => ['score' => $score, 'label' => 'RISIKO RENDAH', 'tone' => 'success'],
        };
    }

    /**
     * @return array{key: string, label: string}
     */
    public function statusFor(Customer $customer, int $orderCount, ?\Carbon\Carbon $lastOrderAt): array
    {
        if ($orderCount === 0) {
            return ['key' => 'baru', 'label' => 'Baru'];
        }

        if ($lastOrderAt && $lastOrderAt->gte(now()->subDays(90))) {
            return ['key' => 'aktif', 'label' => 'Aktif'];
        }

        return ['key' => 'tidak_aktif', 'label' => 'Tidak aktif'];
    }

    /**
     * @return array<string, mixed>
     */
    public function metricsFor(Customer $customer): array
    {
        $orders = Order::query()->where('customer_phone', $customer->phone);
        $orderCount = (clone $orders)->count();
        $totalSpent = (float) (clone $orders)->whereIn('order_status', self::REVENUE_STATUSES)->sum('total_amount');
        $lastOrderAt = (clone $orders)->max('created_at');
        $lastAt = $lastOrderAt ? \Carbon\Carbon::parse($lastOrderAt) : null;
        $fraud = $this->fraudAssessment($customer);
        $status = $this->statusFor($customer, $orderCount, $lastAt);
        $nameVariants = (clone $orders)->distinct()->pluck('customer_name')->filter()->unique()->values();
        $addressVariants = (clone $orders)
            ->select(['shipping_address_line1', 'shipping_city'])
            ->get()
            ->map(fn ($o) => trim(($o->shipping_address_line1 ?? '').'|'.($o->shipping_city ?? '')))
            ->filter()
            ->unique()
            ->values();

        return [
            'order_count' => $orderCount,
            'total_spent' => round($totalSpent, 2),
            'last_order_at' => $lastAt?->toIso8601String(),
            'status' => $status,
            'fraud' => $fraud,
            'name_variants' => $nameVariants->all(),
            'address_variant_count' => $addressVariants->count(),
            'duplicate_warning' => $nameVariants->count() > 1 || $addressVariants->count() > 1
                ? sprintf(
                    'Peringatan Duplikat: Terdeteksi %d Nama & %d Alamat',
                    max(1, $nameVariants->count()),
                    max(1, $addressVariants->count())
                )
                : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function summaryStats(): array
    {
        $total = Customer::query()->count();
        $prevMonth = Customer::query()
            ->where('created_at', '<', now()->startOfMonth())
            ->count();
        $thisMonthNew = Customer::query()
            ->where('created_at', '>=', now()->startOfMonth())
            ->count();
        $growth = $prevMonth > 0
            ? round(($thisMonthNew / max(1, $prevMonth)) * 100, 1)
            : ($thisMonthNew > 0 ? 100.0 : 0.0);

        $topProvince = Customer::query()
            ->select('default_province', DB::raw('COUNT(*) as total'))
            ->whereNotNull('default_province')
            ->where('default_province', '!=', '')
            ->groupBy('default_province')
            ->orderByDesc('total')
            ->first();

        $multiAddress = Order::query()
            ->select(['customer_phone', 'shipping_address_line1', 'shipping_city'])
            ->whereNotNull('customer_phone')
            ->get()
            ->groupBy('customer_phone')
            ->filter(function ($group) {
                return $group
                    ->map(fn ($order) => trim(($order->shipping_address_line1 ?? '').'|'.($order->shipping_city ?? '')))
                    ->filter()
                    ->unique()
                    ->count() > 1;
            })
            ->count();

        $scores = Customer::query()->limit(200)->get()->map(fn (Customer $c) => $this->fraudAssessment($c)['score']);
        $avgFraud = $scores->isEmpty() ? 0.0 : round((float) $scores->avg(), 0);

        return [
            'top_province' => [
                'name' => $topProvince?->default_province ?? '—',
                'share_percent' => $total > 0 && $topProvince
                    ? round(((int) $topProvince->total / $total) * 100)
                    : 0,
            ],
            'total_customers' => $total,
            'growth_percent' => $growth,
            'multi_address_customers' => $multiAddress,
            'avg_fraud_score' => (int) $avgFraud,
            'avg_fraud_label' => $avgFraud >= 60 ? 'Berisiko' : ($avgFraud >= 30 ? 'Waspada' : 'Aman'),
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function orderRows(Customer $customer, int $limit = 20): Collection
    {
        return Order::query()
            ->where('customer_phone', $customer->phone)
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'order_status' => $order->order_status,
                'payment_status' => $order->payment_status,
                'total_amount' => (float) $order->total_amount,
                'created_at' => optional($order->created_at)?->toIso8601String(),
                'href' => route('admin.orders.show', $order),
            ]);
    }
}
