<?php

namespace App\Services\WhatsApp;

use Illuminate\Support\Facades\Http;

class MetaDriver implements WhatsAppDriver
{
    public function name(): string
    {
        return 'meta';
    }

    public function configured(): bool
    {
        return filled(config('services.whatsapp.meta.token'))
            && filled(config('services.whatsapp.meta.number_id'));
    }

    public function sendText(string $phone, string $text): array
    {
        return $this->sendPayload([
            'messaging_product' => 'whatsapp',
            'to' => $phone,
            'type' => 'text',
            'text' => ['body' => $this->sanitize($text)],
        ]);
    }

    public function sendTemplate(string $phone, string $templateName, string $languageCode, array $variables, ?string $renderedBody = null): array
    {
        $parameters = collect($variables)
            ->map(fn ($v) => ['type' => 'text', 'text' => $this->sanitize((string) $v)])
            ->values()
            ->all();

        return $this->sendPayload([
            'messaging_product' => 'whatsapp',
            'to' => $phone,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $languageCode],
                'components' => [[
                    'type' => 'body',
                    'parameters' => $parameters,
                ]],
            ],
        ]);
    }

    public function sendImage(string $phone, string $imageUrl, ?string $caption = null): array
    {
        $image = ['link' => $imageUrl];
        if ($caption !== null && $caption !== '') {
            $image['caption'] = $this->sanitize($caption);
        }

        return $this->sendPayload([
            'messaging_product' => 'whatsapp',
            'to' => $phone,
            'type' => 'image',
            'image' => $image,
        ]);
    }

    public function checkExists(string $phone): ?string
    {
        // Meta Cloud API does not expose a public check-exists equivalent here.
        return $phone;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed
     * }
     */
    protected function sendPayload(array $payload): array
    {
        try {
            $response = Http::withToken((string) config('services.whatsapp.meta.token'))
                ->timeout((int) config('services.whatsapp.meta.timeout', 15))
                ->retry(2, 500, throw: false)
                ->post($this->endpoint(), $payload);

            return [
                'successful' => $response->successful(),
                'provider_message_id' => $response->json('messages.0.id'),
                'provider_session' => null,
                'status' => $response->successful() ? 'sent' : 'failed',
                'error_reason' => $response->successful() ? null : $response->body(),
                'raw_payload' => $response->json() ?: ['body' => $response->body()],
            ];
        } catch (\Throwable $e) {
            return [
                'successful' => false,
                'provider_message_id' => null,
                'provider_session' => null,
                'status' => 'failed',
                'error_reason' => $e->getMessage(),
                'raw_payload' => null,
            ];
        }
    }

    protected function sanitize(string $value): string
    {
        $value = str_replace(["\r\n", "\r", "\n", "\t"], ' ', $value);
        $value = preg_replace('/ {5,}/', '    ', $value) ?? $value;
        $value = trim($value);

        return $value !== '' ? $value : '-';
    }

    protected function endpoint(): string
    {
        return rtrim((string) config('services.whatsapp.meta.base_url'), '/')
            .'/'.config('services.whatsapp.meta.number_id').'/messages';
    }
}
