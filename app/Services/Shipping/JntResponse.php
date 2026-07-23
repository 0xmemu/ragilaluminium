<?php

namespace App\Services\Shipping;

/**
 * Nilai balik terstruktur dari JntCargoClient — memisahkan sukses transport
 * (HTTP) dari sukses bisnis (kode J&T), plus akses helper ke field penting.
 */
class JntResponse
{
    public function __construct(
        public bool $ok,
        public int $httpStatus,
        public array $data,
        public string $requestId,
        public int $elapsedMs,
    ) {
    }

    /** Ambil nilai dari body dengan dot-notation, mencoba beberapa lokasi umum J&T. */
    public function get(string $key, mixed $default = null): mixed
    {
        return data_get($this->data, "data.{$key}", data_get($this->data, $key, $default));
    }

    /**
     * Nomor resi / waybill. Pada addOrder, billCode dikembalikan sebagai
     * List<String> — ambil elemen pertama. Fallback ke waybillNo.
     */
    public function billCode(): ?string
    {
        $code = $this->get('billCode') ?? $this->get('waybillNo');

        if (is_array($code)) {
            return $code[0] ?? null;
        }

        return $code !== null ? (string) $code : null;
    }

    public function message(): ?string
    {
        return data_get($this->data, 'msg')
            ?? data_get($this->data, 'message')
            ?? data_get($this->data, 'error');
    }

    public function failed(): bool
    {
        return ! $this->ok;
    }
}
