<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\CustomerService;
use App\Support\ExportSafety;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\CustomerExport;
use App\Support\InertiaAdmin;
use App\Support\LikeSearch;
use Carbon\Carbon;
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

        // Filter periode (permintaan owner 2026-09-28). Default '' (= Semua
        // waktu) supaya tampilan halaman tidak berubah sebelum admin memilih
        // periode. Artinya: daftar dibatasi ke pelanggan yang BERBELANJA pada
        // periode itu, dan angka Pesanan/Total Belanja per baris dihitung
        // dalam periode yang sama. Basis tanggalnya created_at pesanan
        // (tanggal pesanan dicatat), seragam dengan halaman Pesanan dan
        // Pembayaran.
        $datePreset = trim((string) $request->input('date_preset', ''));
        $dateFrom = trim((string) $request->input('date_from', ''));
        $dateTo = trim((string) $request->input('date_to', ''));
        if (! in_array($datePreset, ['today', '3d', '7d', '30d', 'range'], true)) {
            $datePreset = '';
        }
        [$periodFrom, $periodTo] = $this->periodRange($datePreset, $dateFrom, $dateTo);

        $query = Customer::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    LikeSearch::whereLike($inner, 'name', $search);
                    LikeSearch::orWhereLike($inner, 'phone', $search);
                    LikeSearch::orWhereLike($inner, 'default_address_line1', $search);
                    LikeSearch::orWhereLike($inner, 'default_city', $search);
                    LikeSearch::orWhereLike($inner, 'default_province', $search);
                });
            })
            ->when(
                $periodFrom !== null || $periodTo !== null,
                // Pelanggan tanpa pesanan pada periode itu tidak tampil, jadi
                // daftar menjawab "siapa yang berbelanja pada periode ini".
                fn ($q) => $q->whereIn('phone', $this->customers->phonesWithOrdersIn($periodFrom, $periodTo))
            );

        $query = match ($sort) {
            'name' => $query->orderBy('name'),
            'oldest' => $query->orderBy('id'),
            default => $query->latest('id'),
        };

        // Paginasi 10 item per halaman (tampil saat pelanggan > 10)
        $paginator = $query->paginate(10)->withQueryString();

        $rows = $paginator->getCollection()->values()->map(function (Customer $customer, int $index) use ($paginator, $periodFrom, $periodTo) {
            $metrics = $this->customers->metricsFor($customer, $periodFrom, $periodTo);
            $address = collect([
                $customer->default_address_line1,
                $customer->default_address_line2,
                $customer->default_city,
                $customer->default_province,
            ])->filter()->implode(', ');

            return [
                'id' => $customer->id,
                'code' => $this->customers->publicCode($customer),
                'no' => ($paginator->firstItem() ?? 1) + $index,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'address' => $address !== '' ? $address : '-',
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
                ['value' => 'name', 'label' => 'Nama A-Z'],
            ],
            'activeDatePreset' => $datePreset,
            'dateFrom' => $datePreset === 'range' ? $dateFrom : '',
            'dateTo' => $datePreset === 'range' ? $dateTo : '',
            'periodLabel' => $this->periodLabel($datePreset, $dateFrom, $dateTo),
            'rows' => $rows,
            'pagination' => InertiaAdmin::pagination($paginator),
            // Kartu ringkasan ikut periode supaya angka kartu dan tabel di
            // halaman yang sama tidak saling bertentangan.
            'summary' => $this->customers->summaryStats($periodFrom, $periodTo),
            'exportUrl' => route('admin.customers.export', array_filter([
                'q' => $search ?: null,
                'sort' => $sort !== 'newest' ? $sort : null,
                'date_preset' => $datePreset ?: null,
                'date_from' => $datePreset === 'range' && $dateFrom !== '' ? $dateFrom : null,
                'date_to' => $datePreset === 'range' && $dateTo !== '' ? $dateTo : null,
            ])),
        ]);
    }

    /**
     * Rentang waktu filter periode, sepasang batas inklusif.
     *
     * Preset memakai jam laporan saat ini sebagai batas atas; preset 'range'
     * boleh hanya berisi salah satu batas (hanya mulai atau hanya sampai),
     * dan tanpa keduanya berarti tanpa pembatasan waktu.
     *
     * @return array{0: ?Carbon, 1: ?Carbon}
     */
    private function periodRange(string $preset, string $from, string $to): array
    {
        $awalHariIni = now()->startOfDay();

        return match ($preset) {
            'today' => [$awalHariIni, now()],
            '3d' => [$awalHariIni->copy()->subDays(3), now()],
            '7d' => [$awalHariIni->copy()->subDays(7), now()],
            '30d' => [$awalHariIni->copy()->subDays(30), now()],
            'range' => [
                $from !== '' ? Carbon::parse($from)->startOfDay() : null,
                $to !== '' ? Carbon::parse($to)->endOfDay() : null,
            ],
            default => [null, null],
        };
    }

    /** Label periode untuk chip filter aktif dan judul berkas ekspor. */
    private function periodLabel(string $preset, string $from, string $to): string
    {
        return match ($preset) {
            'today' => 'Hari ini',
            '3d' => '3 hari terakhir',
            '7d' => '7 hari terakhir',
            '30d' => '30 hari terakhir',
            'range' => trim(
                ($from !== '' ? Carbon::parse($from)->translatedFormat('j M Y') : 'awal')
                .' - '.
                ($to !== '' ? Carbon::parse($to)->translatedFormat('j M Y') : 'sekarang')
            ),
            default => 'Semua waktu',
        };
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
            'default_address_line1' => ['nullable', 'string', 'max:255'],
            'default_address_line2' => ['nullable', 'string', 'max:255'],
            'default_city' => ['nullable', 'string', 'max:191'],
            'default_province' => ['nullable', 'string', 'max:191'],
            'default_postal_code' => ['nullable', 'string', 'max:32'],
            'default_country' => ['nullable', 'string', 'max:191'],
        ]);

        $customer->update($validated);

        // Simpan sukses = keluar dari form ke daftar customer.
        return redirect()
            ->route('admin.customers.index')
            ->with('success', 'Data pelanggan '.$customer->name.' disimpan.');
    }

    public function export(Request $request): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $this->customers->syncMissingFromOrders();

        $search = trim((string) $request->input('q', ''));

        // Ekspor mengikuti apa yang tampil di layar: pencarian dan periode yang
        // sama, dengan angka per baris dihitung pada periode yang sama pula.
        $datePreset = trim((string) $request->input('date_preset', ''));
        $dateFrom = trim((string) $request->input('date_from', ''));
        $dateTo = trim((string) $request->input('date_to', ''));
        if (! in_array($datePreset, ['today', '3d', '7d', '30d', 'range'], true)) {
            $datePreset = '';
        }
        [$periodFrom, $periodTo] = $this->periodRange($datePreset, $dateFrom, $dateTo);

        $query = Customer::query()
            ->when($search !== '', function ($q) use ($search) {
                $q->where(function ($inner) use ($search) {
                    LikeSearch::whereLike($inner, 'name', $search);
                    LikeSearch::orWhereLike($inner, 'phone', $search);
                    LikeSearch::orWhereLike($inner, 'default_address_line1', $search);
                    LikeSearch::orWhereLike($inner, 'default_city', $search);
                    LikeSearch::orWhereLike($inner, 'default_province', $search);
                });
            })
            ->when(
                $periodFrom !== null || $periodTo !== null,
                fn ($q) => $q->whereIn('phone', $this->customers->phonesWithOrdersIn($periodFrom, $periodTo))
            )
            ->latest('id');

        ExportSafety::assertQueryWithinLimit($query);

        // Periode ditulis di NAMA BERKAS supaya berkas yang tersimpan tidak
        // dibaca sebagai laporan seumur hidup. Judul sheet tidak dipakai untuk
        // ini karena Excel membatasi 31 karakter.
        $ekspor = new CustomerExport($query, $periodFrom, $periodTo);
        $namaPeriode = match (true) {
            $datePreset !== '' && $datePreset !== 'range' => '-'.$datePreset,
            $datePreset === 'range' => trim(
                '-'.($dateFrom !== '' ? Carbon::parse($dateFrom)->format('Ymd') : 'awal')
                .'-'.($dateTo !== '' ? Carbon::parse($dateTo)->format('Ymd') : 'kini')
            ),
            default => '',
        };

        return Excel::download($ekspor, 'pelanggan-'.now()->format('Ymd').$namaPeriode.'.xlsx');

    }
}
