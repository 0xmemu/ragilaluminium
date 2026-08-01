<?php

namespace App\Services\WhatsApp;

/**
 * Outbound WhatsApp channel. Callers go through WhatsAppManager / WhatsAppService.
 */
interface WhatsAppDriver
{
    public function name(): string;

    public function configured(): bool;

    /**
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed,
     *   chat_id?: ?string
     * }
     */
    public function sendText(string $phone, string $text): array;

    /**
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed,
     *   chat_id?: ?string
     * }
     */
    public function sendTemplate(string $phone, string $templateName, string $languageCode, array $variables, ?string $renderedBody = null): array;

    /**
     * Optional media. Drivers that do not support it return a failed result.
     *
     * @return array{
     *   successful: bool,
     *   provider_message_id: ?string,
     *   provider_session: ?string,
     *   status: string,
     *   error_reason: ?string,
     *   raw_payload: mixed,
     *   chat_id?: ?string
     * }
     */
    public function sendImage(string $phone, string $imageUrl, ?string $caption = null): array;

    /**
     * Resolve provider chat id for a phone (E.164 digits). Null if not on WhatsApp / unknown.
     */
    public function checkExists(string $phone): ?string;
}
