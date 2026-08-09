<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use App\Support\ExportSafety;
use App\Support\InertiaAdmin;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActivityLogController extends Controller
{
    public function __construct(protected ActivityLogService $logs)
    {
    }

    public function index(Request $request): Response
    {
        $category = $this->logs->normalizeCategory((string) $request->input('category', 'all'));
        $q = trim((string) $request->input('q', ''));
        $sort = (string) $request->input('sort', 'newest');
        if (! in_array($sort, ['newest', 'oldest'], true)) {
            $sort = 'newest';
        }

        $paginator = $this->logs->paginate($request->merge([
            'category' => $category,
            'q' => $q,
            'sort' => $sort,
        ]));

        $tabs = collect($this->logs->categoryTabs())->map(fn (array $tab) => [
            'key' => $tab['key'],
            'label' => $tab['label'],
            'href' => route('admin.activity-logs.index', array_filter([
                'category' => $tab['key'] === 'all' ? null : $tab['key'],
                'q' => $q !== '' ? $q : null,
                'sort' => $sort !== 'newest' ? $sort : null,
            ])),
        ])->all();

        return Inertia::render('Admin/ActivityLogs/Index', [
            'title' => 'Log Aktivitas',
            'description' => 'Pantau jejak aktivitas sistem dan tindakan admin (order, import, WhatsApp, login).',
            'category' => $category,
            'tabs' => $tabs,
            'filters' => [
                'q' => $q,
                'sort' => $sort,
                'category' => $category,
            ],
            'sortOptions' => [
                ['value' => 'newest', 'label' => 'Terbaru'],
                ['value' => 'oldest', 'label' => 'Terlama'],
            ],
            'rows' => $this->logs->mapRows($paginator),
            'pagination' => InertiaAdmin::pagination($paginator),
            'exportUrl' => route('admin.activity-logs.export', array_filter([
                'category' => $category === 'all' ? null : $category,
                'q' => $q !== '' ? $q : null,
            ])),
            'total' => $paginator->total(),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $rows = $this->logs->exportRows($request);
        ExportSafety::assertCountWithinLimit($rows->count());
        $filename = 'log-aktivitas-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            ExportSafety::writeCsvRow($out, ['id', 'waktu', 'admin', 'kategori', 'aktivitas', 'event_type', 'entity_type', 'entity_id', 'status']);

            foreach ($rows as $log) {
                $status = $this->logs->statusFor($log);
                ExportSafety::writeCsvRow($out, [
                    $log->id,
                    optional($log->created_at)?->toDateTimeString(),
                    $this->logs->actorLabel($log),
                    $this->logs->categoryLabel($this->logs->categoryFor($log)),
                    $this->logs->describe($log),
                    $log->event_type,
                    $log->entity_type,
                    $log->entity_id,
                    $status['label'],
                ]);
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
