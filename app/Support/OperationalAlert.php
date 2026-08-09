<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

class OperationalAlert
{
    /**
     * @param  array<string, bool|float|int|string|null>  $context
     */
    public function critical(string $event, array $context): void
    {
        $this->write('critical', $event, $context);
    }

    /**
     * @param  array<string, bool|float|int|string|null>  $context
     */
    public function warning(string $event, array $context): void
    {
        $this->write('warning', $event, $context);
    }

    /**
     * @param  array<string, bool|float|int|string|null>  $context
     */
    private function write(string $level, string $event, array $context): void
    {
        $channel = (string) config('operations.alert_log_channel', 'stack');

        try {
            Log::channel($channel)->log($level, $event, $context);
        } catch (Throwable $exception) {
            Log::error('operational_alert_delivery_failed', [
                'alert_event' => $event,
                'channel' => $channel,
                'exception_class' => $exception::class,
            ]);
        }
    }
}
