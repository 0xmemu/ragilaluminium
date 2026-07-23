# Skill: Stage 8 – WhatsApp Business Integration for Ragil Aluminium

This document defines how the Ragil Aluminium backend integrates with **WhatsApp Business** via an official API provider (Cloud API or BSP).  
All agents must treat this as the **canonical messaging contract**: do not implement ad‑hoc WhatsApp hacks (web scraping, unofficial clients) for production.

---

## 1. Integration Model & Roles

### 1.1 WhatsApp Business Platform

Ragil Aluminium uses the **WhatsApp Business Platform** via:

- Meta’s **Cloud API** directly, or  
- a Business Solution Provider (BSP) that exposes compatible HTTP APIs.

Core concepts:

- A **WhatsApp Business Account (WABA)** with verified phone number.  
- **Permanent access token** or API key for authenticating outbound requests.  
- **Webhook URL** on Ragil’s backend to receive inbound messages and status updates.[web:557][web:566][web:569]

### 1.2 Backend WhatsApp Module

The Laravel backend includes a **WhatsApp Module** that:

- Sends outbound messages (templates and free‑form permitted messages).  
- Receives inbound messages and events via a webhook route.  
- Logs all messages in `whatsapp_messages`.  
- Manages `whatsapp_templates` metadata.

This module is the **only** layer allowed to talk to WhatsApp APIs.

---

## 2. Environment & Configuration

### 2.1 .env Variables

Ragil Aluminium stores WhatsApp config in `.env`:

```env
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v20.0
WHATSAPP_API_TOKEN=your-permanent-token
WHATSAPP_BUSINESS_NUMBER_ID=your-phone-number-id
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token
WHATSAPP_WEBHOOK_ENDPOINT=/webhook/whatsapp
```

If using a BSP with a custom base URL:

```env
WHATSAPP_API_BASE_URL=https://api.your-bsp.com
WHATSAPP_API_TOKEN=your-bsp-token
```

### 2.2 Laravel Services Config

In `config/services.php`:

```php
'whatsapp' => [
    'base_url'     => env('WHATSAPP_API_BASE_URL'),
    'token'        => env('WHATSAPP_API_TOKEN'),
    'number_id'    => env('WHATSAPP_BUSINESS_NUMBER_ID'),
    'verify_token' => env('WHATSAPP_VERIFY_TOKEN'),
];
```

All WhatsApp communication reads from this config, not directly from `.env`.

### 2.3 Cara dapat token Meta (Cloud API — bukan QR)

**Runbook produksi / webhook / parkir setup:** [`docs/whatsapp-production-setup.md`](../docs/whatsapp-production-setup.md) (operasional; dokumen ini tetap kontrak Stage 8).

Tidak ada scan QR. Token diambil dari Meta for Developers / Business Settings, lalu disimpan sebagai `WHATSAPP_API_TOKEN`.

#### Temporary vs permanent

| Jenis | Di mana | Masa hidup | Untuk Ragil |
|-------|---------|------------|-------------|
| **Temporary** | App Dashboard → WhatsApp → API Setup → “Generate access token” | ~24 jam | Hanya uji `hello_world` |
| **Permanent (System User)** | Business Settings → System users → Generate token | Tidak kedaluwarsa sampai di-revoke | **Production / `.env`** |

Jangan isi `.env` dengan temporary token kecuali tes singkat.

#### A. App + Phone Number ID

1. Buka [Meta for Developers](https://developers.facebook.com/) → login akun dengan akses bisnis.
2. **Create App** → use case WhatsApp / “Connect with customers through WhatsApp”.
3. Pilih / buat **Business portfolio**.
4. App Dashboard → **WhatsApp** → **API Setup** (atau Use cases → Customize):
   - Salin **Phone number ID** → `WHATSAPP_BUSINESS_NUMBER_ID`.
   - Opsional: kirim template uji `hello_world` dengan temporary token.
5. Boleh pakai **test number** Meta dulu; nomor bisnis nyata + payment method di WhatsApp Manager untuk produksi.

Referensi: [Cloud API Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/).

#### B. Token permanen (System User)

1. [Business Settings](https://business.facebook.com/settings) → **Users** → **System users**.
2. **Add** system user (mis. `ragil-wa-api`), role **Admin** → Create.
3. **Assign assets**:
   - App Ragil → Full control / Manage app.
   - WhatsApp Business Account → Manage WhatsApp Business accounts.
4. **Generate token** → pilih app yang sama → permissions minimal:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
   - (disarankan) `business_management`
   - Expiration: **Never** jika tersedia.
5. **Copy token sekali** → simpan aman (tidak bisa dilihat lagi). Itu nilai `WHATSAPP_API_TOKEN`.

#### C. Webhook + `.env`

```env
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v21.0
WHATSAPP_API_TOKEN=EAAB...              # permanent System User token
WHATSAPP_BUSINESS_NUMBER_ID=1065...     # Phone number ID (bukan WABA ID)
WHATSAPP_VERIFY_TOKEN=string-acak-yang-kamu-buat
WHATSAPP_APP_SECRET=...                 # App Settings → Basic (opsional)
WHATSAPP_BUSINESS_PHONE=62812...        # display E.164 tanpa + (opsional)
WHATSAPP_LANGUAGE=id
```

**WABA ID** (WhatsApp Business Account ID) dipakai di Meta Manager/analytics — **tidak** diisi ke `WHATSAPP_BUSINESS_NUMBER_ID`.

Meta App → WhatsApp → Configuration → **Webhook**:

- Callback URL: `https://domain-publik/webhook/whatsapp` (lokal: tunnel/ngrok).
- Verify token = sama dengan `WHATSAPP_VERIFY_TOKEN`.
- Subscribe field pesan / status sesuai kontrak webhook Stage 8.
- Webhook **boleh ditunda** sampai ada HTTPS publik; outbound notifikasi order tidak menunggu webhook.

Cek admin: **WhatsApp Otomatis → Koneksi** (token + phone number ID terisi).

#### D. Template (wajib untuk notifikasi order)

Token saja tidak cukup. Di [WhatsApp Manager](https://business.facebook.com/wa/manage/home/) ajukan template transactional, lalu petakan `provider_template_name` ke `internal_key` di admin (`order_created`, `payment_confirmed`, dll.).

#### E. Produksi — urutan praktis (webhook ditunda)

Nomor uji Meta (`+1 555…`) sering `accepted` di API tanpa chat terlihat. Untuk toko nyata:

1. **Phone numbers** — daftar nomor bisnis Ragil + payment method Meta. Ganti `WHATSAPP_BUSINESS_NUMBER_ID` ke ID nomor baru (bukan WABA ID).
2. **System User token permanen** — ganti `WHATSAPP_API_TOKEN`.
3. **Template approved** — minimal dulu:

| Admin `internal_key` | Nama template Meta (disarankan) | Bahasa | Body vars (urutan = API Ragil) |
|----------------------|----------------------------------|--------|--------------------------------|
| `order_created` (COD) | `order_created_cod` | `id` | `{{1}}` nomor, `{{2}}` item, `{{3}}` total |
| `payment_instructions` (transfer) | `payment_instructions` | `id` | sama: `{{1}}` `{{2}}` `{{3}}` |
| `payment_confirmed` | `payment_confirmed` | `id` | `{{1}}` nomor order saja |

4. Di admin **WhatsApp Otomatis → Edit**: `provider_template_name` = nama Meta exact, `language_code` = `id`.
5. Uji checkout storefront → chat dari **nomor bisnis**, bukan +1 555.
6. **Webhook** — opsional sampai ada `https://domain/webhook/whatsapp`. Outbound order tidak menunggu webhook.

Contoh body Meta (3 variabel):

```text
Terima kasih telah berbelanja di Ragil Aluminium.

Pesanan {{1}} sedang kami proses.
Rincian: {{2}}
Total: {{3}}

Salam,
Ragil Aluminium
```

---

## 3. WhatsApp Templates & Message Types

### 3.1 Template Messages

WhatsApp Business requires **approved templates** for outbound messages initiated by the business, especially transactional ones.[web:562][web:565][web:568]

Common template categories:

- `order_created`
- `payment_instructions`
- `payment_confirmed`
- `order_shipped`
- `order_delivered`
- `order_issue_followup`

The backend stores template metadata in `whatsapp_templates`:

- Fields (example):
  - `id`
  - `template_name` (as registered in WABA/BSP)
  - `language` (e.g., `en`, `id`)
  - `category` (e.g., `TRANSACTIONAL`)
  - `body` / `header` / `footer` (optional, for reference)
  - `variables` (JSON structure indicating placeholders like `{order_id}`, `{total}`)

Template content itself is configured in Meta/BSP dashboard; system stores just enough metadata to map orders to template calls.

### 3.2 Free‑Form Messages

Inbound customer messages and certain outbound replies within a context window may be free‑form text. The backend:

- Logs all inbound message content in `whatsapp_messages`.  
- Uses free‑form outbound messages **only** when allowed (e.g., responding in an open session), otherwise uses templates.

---

## 4. WhatsApp Service – Sending Messages

### 4.1 Service Interface

The WhatsApp Module exposes a service class, e.g. `App\Services\WhatsAppService`, with methods:

- `sendTemplateMessage(string $phone, string $templateName, array $variables, ?int $orderId = null)`  
- `sendTextMessage(string $phone, string $text, ?int $orderId = null)`  

These methods:

1. Build the request payload according to Cloud API/BSP spec.[web:557][web:569]  
2. Send HTTP request to `WHATSAPP_API_BASE_URL` with `Authorization: Bearer <token>`.  
3. Log outbound message in `whatsapp_messages`.  
4. Handle API response and store status (`queued`, `sent`, `delivered`, `failed`).

### 4.2 Example Template Payload (Conceptual)

For Cloud API:

```json
POST /{WHATSAPP_BUSINESS_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_API_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "6281xxxxxxx",
  "type": "template",
  "template": {
    "name": "order_created",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "#12345" },
          { "type": "text", "text": "Ragil Aluminium Window Jungkit" },
          { "type": "text", "text": "Rp 1.500.000" }
        ]
      }
    ]
  }
}
```

The WhatsApp service builds such payloads using `whatsapp_templates` metadata and order data.

---

## 5. Webhook Endpoint – Receiving Messages & Events

### 5.1 Webhook URL Configuration

In the Meta or BSP dashboard:

- Configure webhook callback URL, e.g.:

  ```text
  https://ragil-backend.com/webhook/whatsapp
  ```

- Set the verification token to `WHATSAPP_VERIFY_TOKEN`.

Backend route:

```php
Route::match(['GET', 'POST'], '/webhook/whatsapp', [WhatsAppWebhookController::class, 'handle']);
```

### 5.2 Verification (GET)

On initial setup, WhatsApp sends a GET request to verify the webhook:

- Query parameters typically include:
  - `hub.mode`
  - `hub.challenge`
  - `hub.verify_token`

The backend:

- Checks that `hub.verify_token` matches `config('services.whatsapp.verify_token')`.  
- If valid, responds with `hub.challenge` (plain text).  
- If not valid, responds with 403.

This completes webhook verification.[web:556][web:563][web:566]

### 5.3 Handling POST Events

Inbound POSTs contain JSON payloads for:

- inbound messages (customer messages),  
- message status updates (sent, delivered, read).

Backend flow in `WhatsAppWebhookController@handle`:

1. Validate signature and/or token per provider spec.  
2. Parse events:
   - For inbound messages:
     - Extract sender phone number.
     - Extract message content and type.
     - Attempt to associate with an `order_id`:
       - via metadata in template (if conversation follows a triggered message), or
       - via keywords/order ID in message body, or
       - via mapping table (e.g., last order for that phone).
     - Store in `whatsapp_messages` as `direction = inbound`.
   - For delivery/read receipts:
     - Update existing `whatsapp_messages` records with status (delivered/read).

3. Trigger internal workflows when needed:
   - e.g., mark payment proof received,
   - flag new complaint on an order.

---

## 6. WhatsApp Data Model

### 6.1 `whatsapp_templates`

- `id`
- `template_name`
- `language`
- `category`
- `variables` (JSON: list of variable keys and expected order mapping)
- `created_at`, `updated_at`

Used by:

- Admin UI to manage which templates are available.  
- WhatsAppService to build outbound payloads.

### 6.2 `whatsapp_messages`

- `id`
- `order_id` (nullable; linked when context is known)
- `direction` – `outbound` or `inbound`
- `phone` – customer phone number
- `template_name` (nullable; set for outbound template messages)
- `content` – message body or summary
- `raw_payload` – JSON column storing raw API/webhook payload for audit
- `status` – `queued`, `sent`, `delivered`, `failed`, `received`, `read`
- `provider_message_id` – ID from WhatsApp/BSP (for correlating delivery updates)
- `created_at`, `updated_at`

This table is the **log of all WhatsApp traffic** relevant to Ragil’s orders.

---

## 7. Mapping Order Workflow to WhatsApp Templates

Stage 4 defines key events; Stage 8 maps them to templates.

### 7.1 Events & Templates

- `order_created`
  - Trigger:
    - after order is created with `order_status = pending_payment`.
  - Template:
    - `order_created` – includes order ID, items, total, and link/steps for payment.

- `payment_instructions`
  - Trigger:
    - part of order_created or separate follow‑up.
  - Template:
    - `payment_instructions` – bank details, amount, due time.

- `payment_confirmed`
  - Trigger:
    - after admin verifies payment and `payment_status = paid`.
  - Template:
    - `payment_confirmed` – confirmation plus expectation for processing times.

- `order_shipped`
  - Trigger:
    - after Shipping Module sets `shipping_status` to shipped and waybill is available.
  - Template:
    - `order_shipped` – carrier, tracking number, link.

- `order_delivered`
  - Trigger:
    - after Shipping Module sets `shipping_status` to delivered.
  - Template:
    - `order_delivered` – message asking customer to confirm or report issues.

- `order_issue_followup`
  - Trigger:
    - when `order_status` moves to `issue` or `return_in_process`.
  - Template:
    - `order_issue_followup` – explanation of next steps for complaint/return.

Each event is implemented via:

- Domain modules (Order, Payment, Shipping) emitting events.  
- WhatsApp Module subscribing to these events and calling `sendTemplateMessage`.

---

## 8. Security & Compliance Considerations

### 8.1 Authentication & Authorization

WhatsApp API requests:

- Must use `Authorization: Bearer <WHATSAPP_API_TOKEN>`.  
- Token must be kept in `.env` and config, never logged or exposed.

Webhook endpoint:

- Must validate:
  - verification token (`WHATSAPP_VERIFY_TOKEN`) on setup.  
  - optional signature headers if provider uses them.

### 8.2 Data Protection

- Store only necessary message content and phone numbers.  
- Ensure logs (`raw_payload`) do not leak sensitive tokens.  
- Comply with WhatsApp policies:
  - use templates for business‑initiated messages,  
  - respect customer opt‑in/opt‑out.

Opt‑in handling:

- At checkout or first contact, ask if customer wants WhatsApp notifications.  
- Store opt‑in flag per order/customer and only send messages if allowed.

---

## 9. Operational Practices

### 9.1 Template Management

Admin UI should allow:

- Viewing list of `whatsapp_templates`.  
- Matching internal template keys to WABA template names.  
- Marking templates as active/inactive.

Template creation/approval itself is done in Meta/BSP dashboard; backend only references them.

### 9.2 Error Handling & Retries

For outbound messages:

- If API response indicates transient failure:
  - message record `status = failed` with reason.  
  - optional retry job can be queued (with limits).
- If webhook payload is malformed:
  - log error; do not crash worker.

Monitoring:

- Metrics of outbound send success rate.  
- Number of inbound messages per day.  
- Correlation with order events.

---

## 10. Agent Checklist

Before implementing or modifying anything related to WhatsApp integration, agents must:

- [ ] Use the official WhatsApp Business API (Cloud API or BSP), authenticated via tokens stored in `.env` and `config/services.php`.  
- [ ] Implement all outbound messaging through the WhatsApp Module (service class + templates), not via ad‑hoc HTTP calls.  
- [ ] Configure a single webhook endpoint (`/webhook/whatsapp`) that handles verification and POST events securely.  
- [ ] Store message logs in `whatsapp_messages` with clear `direction`, `status`, `order_id` (when known), and `provider_message_id`.  
- [ ] Use approved templates for business‑initiated messages like order creation, payment confirmation, shipping, and delivery status.  
- [ ] Map Stage 4 workflow events (order, payment, shipping) to specific WhatsApp templates and trigger them via the WhatsApp Module.  
- [ ] Validate and secure webhook requests (verify token, optional signatures) and ensure inbound messages are linked to orders only through safe logic.  
- [ ] Respect customer opt‑in/opt‑out and WhatsApp messaging policies; do not spam or send unauthorized messages.  
- [ ] Avoid any unofficial integrations (web scraping, device automation) for production; only the Business API‑based integration is allowed.  
- [ ] Ensure logging and monitoring exist for WhatsApp traffic so issues (failed sends, webhook errors) can be detected and resolved quickly.

Any WhatsApp‑related implementation that bypasses this Stage 8 skill or uses unofficial/unsafe methods must be refactored before being accepted into the Ragil Aluminium system.
