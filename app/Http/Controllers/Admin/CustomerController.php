<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\CustomerService;
use App\Support\InertiaAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerController extends Controller
{
    public function __construct(protected CustomerService $customers)
    {
    }

    public function index(Request $request): Response
    {
        $this->customers->syncMissingFromOrders();

        $search = trim((string) $request->input('q', ''));
        $sort = (string) $request->input('sort', 'newest');

        $query = Customer::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('default_city', 'like', "%{$search}%")
                        ->orWhere('default_province', 'like', "%{$search}%");
                });
            });

        $query = match ($sort) {
            'name' => $query->orderBy('name'),
            'oldest' => $query->orderBy('id'),
            default => $query->latest('id'),
        };

        $paginator = $query->paginate(20)->withQueryString();

        $rows = $paginator->getCollection()->values()->map(function (Customer $customer, int $index) use ($paginator) {
            $metrics = $this->customers->metricsFor($customer);
            $location = collect([
                $customer->default_address_line1,
                $customer->default_city,
                $customer->default_province,
            ])->filter()->implode(', ');

            return [
                'id' => $customer->id,
                'code' => $this->customers->publicCode($customer),
                'no' => ($paginator->firstItem() ?? 1) + $index,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'location' => $location !== '' ? $location : '—',
                'order_count' => $metrics['order_count'],
                'total_spent' => $metrics['total_spent'],
                'status' => $metrics['status'],
                'fraud' => $metrics['fraud'],
                'whatsapp_url' => 'https://wa.me/'.preg_replace('/\D+/', '', $customer->phone),
                'href' => route('admin.customers.show', $customer),
                'edit_href' => route('admin.customers.edit', $customer),
            ];
        })->all();

        return Inertia::render('Admin/Customers/Index', [
            'title' => 'Kelola Pelanggan',
            'description' => 'Pantau, ubah, dan analisis basis data pelanggan Anda. Akses pemetaan alamat lengkap dalam satu antarmuka.',
            'filters' => [
                'q' => $search,
                'sort' => $sort,
            ],
            'sortOptions' => [
                ['value' => 'newest', 'label' => 'Terbaru'],
                ['value' => 'oldest', 'label' => 'Terlama'],
                ['value' => 'name', 'label' => 'Nama A–Z'],
            ],
            'rows' => $rows,
            'pagination' => InertiaAdmin::pagination($paginator),
            'summary' => $this->customers->summaryStats(),
            'exportUrl' => route('admin.customers.export', array_filter([
                'q' => $search ?: null,
                'sort' => $sort !== 'newest' ? $sort : null,
            ])),
        ]);
    }

    public function show(Customer $customer): Response
    {
        return $this->edit($customer);
    }

    public function edit(Customer $customer): Response
    {
        $metrics = $this->customers->metricsFor($customer);

        return Inertia::render('Admin/Customers/Edit', [
            'title' => 'Detail Customer',
            'description' => 'Ubah data pelanggan dan tinjau riwayat pesanan.',
            'customer' => [
                'id' => $customer->id,
                'code' => $this->customers->publicCode($customer),
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'default_address_line1' => $customer->default_address_line1,
                'default_address_line2' => $customer->default_address_line2,
                'default_city' => $customer->default_city,
                'default_province' => $customer->default_province,
                'default_postal_code' => $customer->default_postal_code,
                'default_country' => $customer->default_country ?? 'Indonesia',
            ],
            'metrics' => $metrics,
            'orders' => $this->customers->orderRows($customer)->all(),
            'submitUrl' => route('admin.customers.update', $customer),
            'backUrl' => route('admin.customers.index'),
            'whatsappUrl' => 'https://wa.me/'.preg_replace('/\D+/', '', $customer->phone),
        ]);
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:191'],
            'email' => ['nullable', 'email', 'max:191'],
            'default_address_line1' => ['nullable', 'string', 'max:255'],
            'default_address_line2' => ['nullable', 'string', 'max:255'],
            'default_city' => ['nullable', 'string', 'max:191'],
            'default_province' => ['nullable', 'string', 'max:191'],
            'default_postal_code' => ['nullable', 'string', 'max:32'],
            'default_country' => ['nullable', 'string', 'max:191'],
        ]);

        $customer->update($validated);

        return redirect()
            ->route('admin.customers.edit', $customer)
            ->with('success', 'Data pelanggan disimpan.');
    }

    public function export(Request $request): StreamedResponse
    {
        $this->customers->syncMissingFromOrders();

        $search = trim((string) $request->input('q', ''));
        $query = Customer::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%");
                });
            })
            ->latest('id');

        return response()->streamDownload(function () use ($query) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Kode', 'Nama', 'Telepon', 'Email', 'Alamat', 'Kota', 'Provinsi',
                'Jumlah Order', 'Total Belanja', 'Status', 'Fraud Score', 'Fraud Label',
            ]);

            $query->chunk(100, function ($chunk) use ($out) {
                foreach ($chunk as $customer) {
                    $metrics = $this->customers->metricsFor($customer);
                    fputcsv($out, [
                        $this->customers->publicCode($customer),
                        $customer->name,
                        $customer->phone,
                        $customer->email,
                        $customer->default_address_line1,
                        $customer->default_city,
                        $customer->default_province,
                        $metrics['order_count'],
                        $metrics['total_spent'],
                        $metrics['status']['label'],
                        $metrics['fraud']['score'],
                        $metrics['fraud']['label'],
                    ]);
                }
            });

            fclose($out);
        }, 'pelanggan-'.now()->format('Ymd').'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
