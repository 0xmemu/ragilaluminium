<?php

namespace App\Services\WhatsApp;

use InvalidArgumentException;

class WhatsAppManager
{
    public function __construct(
        protected MetaDriver $meta,
        protected WahaDriver $waha,
    ) {}

    public function driver(?string $name = null): WhatsAppDriver
    {
        $name = $this->normalize($name ?? $this->defaultDriver());

        return match ($name) {
            'waha' => $this->waha,
            'meta' => $this->meta,
            default => throw new InvalidArgumentException("Unknown WhatsApp driver [{$name}]"),
        };
    }

    public function defaultDriver(): string
    {
        return $this->normalize((string) config('services.whatsapp.driver', 'meta'));
    }

    public function meta(): MetaDriver
    {
        return $this->meta;
    }

    public function waha(): WahaDriver
    {
        return $this->waha;
    }

    public function normalize(string $name): string
    {
        $name = strtolower(trim($name));

        return $name === 'waha' ? 'waha' : 'meta';
    }
}
