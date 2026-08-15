<?php

namespace App\Http\Controllers;

use App\Models\CmsTestimonial;
use App\Models\Order;
use App\Models\OrderItem;
use App\Services\ActivityLogService;
use App\Support\PhoneNumber;
use App\Support\TestimonialPageSettings;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerReviewController extends Controller
{
    /**
     * Customer reviews are guest-owned: the order number and checkout phone
     * together are the ownership proof. No customer account is required.
     */
    public function store(Request $request, string $order_number): JsonResponse
    {
        $validated = $this->validated($request);
        $phone = PhoneNumber::normalize((string) $validated['customer_phone']);
        $order = $this->ownedOrder($order_number, $phone);
        $this->ensureEligible($order);
        $productId = $this->productId($order, $validated['product_id'] ?? null);

        $review = DB::transaction(function () use ($order, $validated, $productId) {
            $lockedOrder = Order::query()->lockForUpdate()->findOrFail($order->id);

            if (CmsTestimonial::query()->where('order_id', $lockedOrder->id)->exists()) {
                throw ValidationException::withMessages(['order' => 'Pesanan ini sudah memiliki ulasan.']);
            }

            $review = CmsTestimonial::create([
                'cms_page_id' => TestimonialPageSettings::pageId(),
                'product_id' => $productId,
                'order_id' => $lockedOrder->id,
                'author_type' => 'customer',
                'moderation_status' => 'pending',
                'verified_at' => now(),
                'customer_name' => $lockedOrder->customer_name,
                'message' => trim((string) $validated['message']),
                'rating' => (int) $validated['rating'],
                'source' => 'website',
                'media_items' => $validated['media_items'] ?? [],
                'published' => false,
                'sort_order' => 0,
            ]);

            ActivityLogService::record(
                'cms.testimonial_customer_created',
                'cms_testimonial',
                $review->id,
                ['order_id' => $lockedOrder->id, 'product_id' => $productId, 'verified_purchase' => true],
                null,
                'customer',
                null,
                ['moderation_status' => 'pending', 'rating' => $review->rating],
                'customer_review',
                Order::class,
                (string) $lockedOrder->id,
            );

            return $review;
        });

        return response()->json([
            'message' => 'Ulasan berhasil dikirim dan menunggu moderasi.',
            'review' => $this->reviewPayload($review),
        ], 201);
    }

    public function update(Request $request, string $order_number, CmsTestimonial $testimonial): JsonResponse
    {
        $validated = $this->validated($request, false);
        $phone = PhoneNumber::normalize((string) $validated['customer_phone']);
        $order = $this->ownedOrder($order_number, $phone);
        $this->ensureEligible($order);

        if ((int) $testimonial->order_id !== (int) $order->id || ! $testimonial->isCustomerAuthored()) {
            abort(403, 'Ulasan ini tidak dapat diedit oleh pelanggan.');
        }

        $before = [
            'message' => $testimonial->message,
            'rating' => $testimonial->rating,
            'media_items' => $testimonial->mediaPayload(),
            'moderation_status' => $testimonial->moderation_status,
        ];

        $testimonial->update([
            'message' => trim((string) $validated['message']),
            'rating' => (int) $validated['rating'],
            'media_items' => $validated['media_items'] ?? [],
            'moderation_status' => 'pending',
            'published' => false,
        ]);

        ActivityLogService::record(
            'cms.testimonial_customer_updated',
            'cms_testimonial',
            $testimonial->id,
            ['order_id' => $order->id, 'verified_purchase' => $testimonial->verified_at !== null],
            null,
            'customer',
            $before,
            ['message' => $testimonial->message, 'rating' => $testimonial->rating, 'moderation_status' => 'pending'],
            'customer_review_edit',
            Order::class,
            (string) $order->id,
        );

        return response()->json([
            'message' => 'Ulasan diperbarui dan menunggu moderasi ulang.',
            'review' => $this->reviewPayload($testimonial->fresh()),
        ]);
    }

    /**
     * @return array<string,mixed>
     */
    private function validated(Request $request, bool $withProduct = true): array
    {
        $rules = [
            'customer_phone' => ['required', 'string', 'max:40'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'message' => ['required', 'string', 'min:3', 'max:5000'],
            'media_items' => ['nullable', 'array', 'max:10'],
            'media_items.*' => ['array'],
            'media_items.*.type' => ['required_with:media_items.*', 'in:image,video'],
            'media_items.*.url' => ['required_with:media_items.*', 'url', 'max:2048'],
        ];

        if ($withProduct) {
            $rules['product_id'] = ['nullable', 'integer'];
        }

        return $request->validate($rules);
    }

    private function ownedOrder(string $orderNumber, ?string $phone): Order
    {
        $order = Order::query()->where('order_number', $orderNumber)->first();

        if (! $order || ! $phone || ! hash_equals((string) PhoneNumber::normalize($order->customer_phone), $phone)) {
            abort(404, 'Pesanan tidak ditemukan.');
        }

        return $order;
    }

    private function ensureEligible(Order $order): void
    {
        if (! in_array($order->order_status, ['delivered', 'completed'], true)) {
            abort(422, 'Ulasan hanya tersedia setelah pesanan diterima.');
        }
    }

    private function productId(Order $order, mixed $productId): ?int
    {
        $itemQuery = OrderItem::query()->where('order_id', $order->id);
        $itemCount = (clone $itemQuery)->count();

        if ($productId !== null && ! $itemQuery->where('product_id', (int) $productId)->exists()) {
            throw ValidationException::withMessages(['product_id' => 'Produk tidak termasuk dalam pesanan ini.']);
        }

        if ($productId !== null) {
            return (int) $productId;
        }

        if ($itemCount === 1) {
            return (int) $itemQuery->value('product_id') ?: null;
        }

        if ($itemCount > 1) {
            throw ValidationException::withMessages(['product_id' => 'Pilih produk yang ingin diberi ulasan.']);
        }

        return null;
    }

    /**
     * Do not echo customer content as published; this is only a submission receipt.
     *
     * @return array<string,mixed>
     */
    private function reviewPayload(CmsTestimonial $review): array
    {
        return [
            'id' => $review->id,
            'order_id' => $review->order_id,
            'product_id' => $review->product_id,
            'rating' => $review->rating,
            'moderation_status' => $review->moderation_status,
            'verified_purchase' => $review->verified_at !== null,
        ];
    }
}
