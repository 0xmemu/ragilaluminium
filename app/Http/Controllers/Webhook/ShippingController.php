<?php

namespace App\Http\Controllers\Webhook;

use App\Http\Controllers\Controller;
use App\Models\ShippingRecord;
use App\Services\Shipping\JntCargoClient;
use App\Services\ShippingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ShippingController extends Controller
{
    public function __construct(
        protected ShippingService $shipping,
        protected JntCargoClient $jnt,
    ) {}

    /**
     * Push status dari J&T Cargo.
     * Kontrak: form field bizContent (JSON) + header digest. Verifikasi tanda
     * tangan, terapkan update idempoten, balas ACK format J&T.
     */
    public function handleJnt(Request $request): JsonResponse
    {
        $contentField = config('jnt.webhook.content_field');
        $rawJson = (string) $request->input($contentField, '');
        $signature = $request->header(config('jnt.webhook.signature_header'))
            ?? $request->input('digest');

        // Webhook tidak boleh fail-open saat secret belum dikonfigurasi.
        if (blank(config('jnt.webhook.private_key'))) {
            Log::channel('jnt')->error('JNT webhook rejected: signing key is not configured');

            return $this->ack(false, 'webhook not configured');
        }

        if (! $this->jnt->verifyWebhookSignature($rawJson, $signature)) {
            Log::channel('jnt')->warning('JNT webhook signature invalid', [
                'source_ip_ref' => $this->logReference($request->ip()),
                'has_signature' => (bool) $signature,
            ]);

            return $this->ack(false, 'invalid signature');
        }

        $payload = $rawJson !== '' ? json_decode($rawJson, true) : $request->all();
        if (! is_array($payload)) {
            return $this->ack(false, 'invalid payload');
        }

        $waybill = $payload['billCode'] ?? $payload['waybillNo'] ?? null;
        $txlogisticId = $payload['txlogisticId'] ?? $payload['customerOrderId'] ?? null;

        Log::channel('jnt')->info('JNT webhook received', [
            'waybill_ref' => $this->logReference($waybill),
            'customer_order_ref' => $this->logReference($txlogisticId),
            'detail_count' => is_array($payload['details'] ?? null) ? count($payload['details']) : 0,
        ]);

        // Push trajektori membawa details[]; ambil scan terbaru. Push status
        // order membawa scanType di root.
        $details = $payload['details'] ?? null;
        $scan = is_array($details) && ! empty($details) ? end($details) : $payload;

        $scanType = (string) ($scan['scanType'] ?? $scan['scanCode'] ?? '');
        $scanTypeCode = isset($scan['scanTypeCode']) ? (string) $scan['scanTypeCode'] : null;
        $desc = $scan['desc'] ?? $scan['remark'] ?? null;
        $occurredAt = $scan['scanTime'] ?? $scan['time'] ?? null;

        $record = null;
        if ($waybill) {
            $record = ShippingRecord::where('waybill_number', $waybill)->first();
        }
        if (! $record && $txlogisticId) {
            $record = ShippingRecord::whereHas('order', fn ($q) => $q->where('order_number', $txlogisticId))->first();
        }

        if (! $record) {
            // Balas sukses agar J&T tidak retry tak berujung utk resi tak dikenal.
            return $this->ack(true);
        }

        if ($scanType !== '' || $scanTypeCode !== null) {
            $this->shipping->applyCarrierUpdate($record, $scanType, $desc, null, $occurredAt, $scanTypeCode);
        }

        return $this->ack(true);
    }

    protected function logReference(?string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        return substr(hash('sha256', $value), 0, 12);
    }

    protected function ack(bool $success, ?string $message = null): JsonResponse
    {
        if ($success) {
            return response()->json([
                'code' => config('jnt.ack.code'),
                'msg' => config('jnt.ack.msg'),
                'data' => config('jnt.ack.data'),
            ]);
        }

        return response()->json([
            'code' => '0',
            'msg' => $message ?? 'failed',
        ], 200);
    }
}
