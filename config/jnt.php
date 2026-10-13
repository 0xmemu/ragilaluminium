<?php

/*
|--------------------------------------------------------------------------
| J&T Cargo Open Platform — Integration Contract (spesifikasi resmi)
|--------------------------------------------------------------------------
|
| Dokumen resmi: https://open.jtcargo.co.id/#/apiDoc
|
| Kontrak transport (dikonfirmasi dari doc):
|   - HTTP POST, Content-Type: application/x-www-form-urlencoded
|   - Form field: bizContent = JSON string data bisnis
|   - Header: apiAccount (Number), timestamp (epoch ms), digest (signature)
|   - HEADER digest  = Base64( MD5( bizContent + privateKey ) )
|   - INNER  digest  = Base64( MD5( customerCode + cipher + privateKey ) )
|       cipher = STRTOUPPER( MD5( plainPassword + 'jadada236t2' ) )
|     (inner digest dikirim DI DALAM bizContent, hanya utk interface order/tarif)
|
| Sandbox WAJIB joint-debugging tiap interface, sukses >= 3x sebelum ajukan
| environment formal. Gunakan: `php artisan jnt:joint-debug`.
|
*/

return [

    'enabled' => (bool) env('JNT_ENABLED', false),

    // 'sandbox' (joint-debugging) | 'production' (formal environment)
    'environment' => env('JNT_ENV', 'sandbox'),

    // Host saja (tanpa path). Path lengkap ada di 'endpoints'.
    'base_url' => [
        'sandbox' => rtrim(env('JNT_SANDBOX_BASE_URL', 'https://demoopenapi.jtcargo.co.id'), '/'),
        'production' => rtrim(env('JNT_PRODUCTION_BASE_URL', 'https://openapi.jtcargo.co.id'), '/'),
    ],

    'credentials' => [
        'api_account' => env('JNT_API_ACCOUNT'),
        'private_key' => env('JNT_PRIVATE_KEY'),
        'customer_code' => env('JNT_CUSTOMER_CODE'),        // mis. J0086024191
        'customer_password' => env('JNT_CUSTOMER_PASSWORD'), // plain text password
        // Salt tetap untuk cipher password (dari doc resmi J&T).
        'password_salt' => env('JNT_PASSWORD_SALT', 'jadada236t2'),
    ],

    'webhook' => [
        'private_key' => env('JNT_WEBHOOK_PRIVATE_KEY') ?: env('JNT_PRIVATE_KEY'),
        'signature_header' => env('JNT_WEBHOOK_SIGNATURE_HEADER', 'digest'),
        'content_field' => env('JNT_WEBHOOK_CONTENT_FIELD', 'bizContent'),
    ],

    /*
    | Path endpoint lengkap. Doc J&T Cargo ID memakai prefix /webopenplatformapi.
    | Trace dikonfirmasi: /webopenplatformapi/api/logistics/trace. Endpoint lain
    | mengikuti pola sama; override via .env jika console memberi path berbeda.
    */
    'endpoints' => [
        'order_create' => env('JNT_EP_ORDER_CREATE', '/webopenplatformapi/api/order/addOrder'),
        'order_get' => env('JNT_EP_ORDER_GET', '/webopenplatformapi/api/order/getOrders'),
        'order_cancel' => env('JNT_EP_ORDER_CANCEL', '/webopenplatformapi/api/order/cancelOrder'),
        'tariff' => env('JNT_EP_TARIFF', '/webopenplatformapi/api/agingCost/get'),
        'dimensional_tariff' => env('JNT_EP_DIMENSIONAL_TARIFF', '/webopenplatformapi/api/spmComCost/getComCost'),
        'track' => env('JNT_EP_TRACK', '/webopenplatformapi/api/logistics/trace'),
        'track_subscribe' => env('JNT_EP_TRACK_SUBSCRIBE', '/webopenplatformapi/api/trace/subscribe'),
        'dispatch_code' => env('JNT_EP_DISPATCH_CODE', '/webopenplatformapi/api/order/getDispatchCode'),
        'address' => env('JNT_EP_ADDRESS', '/webopenplatformapi/api/order/getAddress'),
        'batch_billcode' => env('JNT_EP_BATCH_BILLCODE', '/webopenplatformapi/api/billCode/getBatchBillCode'),
    ],

    'headers' => [
        'api_account' => env('JNT_HEADER_API_ACCOUNT', 'apiAccount'),
        'timestamp' => env('JNT_HEADER_TIMESTAMP', 'timestamp'),
        'digest' => env('JNT_HEADER_DIGEST', 'digest'),
    ],

    'content_field' => env('JNT_CONTENT_FIELD', 'bizContent'),

    'http' => [
        'timeout' => (int) env('JNT_HTTP_TIMEOUT', 30),
        'connect_timeout' => (int) env('JNT_HTTP_CONNECT_TIMEOUT', 10),
        'retries' => (int) env('JNT_HTTP_RETRIES', 2),
        'retry_sleep_ms' => (int) env('JNT_HTTP_RETRY_SLEEP', 500),
    ],

    /*
    | Default bizContent create-order (addOrder). Nilai mengikuti doc:
    |  - orderType: 1 individual, 2 monthly settlement (contract/customerCode)
    |  - serviceType: 01 door-to-door pickup, 02 store delivery
    |  - deliveryType: 101 delivery
    |  - expressType: mis. FTAIR
    |  - payType: PP_PM (monthly), CC_CASH (cod), PP_CASH (prepaid)
    |  - goodsType (main list): bm000001..bm000011. Aluminium ~ bm000010
    |    (bahan bangunan) / bm000006 (furnitur). Sesuaikan dgn akun.
    */
    'defaults' => [
        // expressType/goodsType/paymentType disamakan dengan contoh resmi doc
        // agingCost/get (2026-08-21): FTAIR mengembalikan freight 0 untuk akun
        // ini — FT (produk darat) yang valid.
        'express_type' => env('JNT_EXPRESS_TYPE', 'FT'),
        'order_type' => env('JNT_ORDER_TYPE', '2'),
        'service_type' => env('JNT_SERVICE_TYPE', '01'),
        'delivery_type' => env('JNT_DELIVERY_TYPE', '101'),
        'pay_type' => env('JNT_PAY_TYPE', 'PP_PM'),
        'pay_type_cod' => env('JNT_PAY_TYPE_COD', 'CC_CASH'),
        'goods_type' => env('JNT_GOODS_TYPE', 'bm000005'),
        // paymentType utk agingCost/get: 1 cash by post, 2 monthly, 3 cod
        'payment_type' => (int) env('JNT_PAYMENT_TYPE', 1),
        'price_currency' => env('JNT_PRICE_CURRENCY', 'IDR'),
        // Asuransi pengiriman (opsional, pilihan pembeli). Ada DUA angka
        // yang berbeda dan tidak boleh dicampur:
        //
        //   offerFee              = NILAI BARANG yang diasuransikan
        //                           (dokumen J&T: 保价金额, IDR). Ini angka
        //                           milik kami (subtotal keranjang).
        //   estimateInsuranceCost = BIAYA asuransi. 100% angka J&T, dibaca
        //                           apa adanya; TIDAK ADA rumus tarif
        //                           asuransi di sistem ini (tanpa persen,
        //                           tanpa floor, tanpa nilai tetap).
        //
        // Karena itu TIDAK boleh ada config 'insurance_rate', 'insurance_fee',
        // 'offer_fee', atau sejenisnya. Bila J&T tidak mengirim biayanya,
        // asuransi cukup tidak ditawarkan (biaya 0) — dilarang dihitung sendiri.
        'insurance_enabled' => (bool) env('JNT_INSURANCE_ENABLED', true),
    ],

    'sender' => [
        'name' => env('JNT_SENDER_NAME', 'Ragil Aluminium'),
        'company' => env('JNT_SENDER_COMPANY', 'Ragil Aluminium'),
        'phone' => env('JNT_SENDER_PHONE'),
        'mobile' => env('JNT_SENDER_MOBILE'),
        'country_code' => env('JNT_SENDER_COUNTRY', 'IDN'), // three-char!
        'prov' => env('JNT_SENDER_PROV'),
        'city' => env('JNT_SENDER_CITY'),
        'area' => env('JNT_SENDER_AREA'),
        'town' => env('JNT_SENDER_TOWN'),
        'address' => env('JNT_SENDER_ADDRESS'),
        'postcode' => env('JNT_SENDER_POSTCODE'),
    ],

    /*
    | Pemetaan status J&T -> status internal.
    | Kunci = kode mentah (order 100-105 ATAU trace scanType 1/3/4/5/10/11/12/13).
    | Internal: pending_pickup | in_process | in_transit | delivered | returned | cancelled
    */
    'status_map' => [
        // Order-level status (getOrders / order status push) — docs open.jtcargo.co.id
        // 100 not dispatched | 101 outlets dispatched | 102 salesperson dispatched
        // 103 picked up | 104 cancelled | 105 pickupFail
        '100' => 'tracking_pending', // belum ada penjemputan (resi sudah terbit)
        '101' => 'tracking_pending', // sudah di-dispatch ke outlet
        '102' => 'tracking_pending', // salesperson di-dispatch
        '103' => 'picked_up',        // paket dijemput kurir
        '104' => 'cancelled',        // dibatalkan
        '105' => 'exception',        // pickupFail
        // Trace scanType (logistics/trace + trajectory push)
        '1' => 'picked_up',          // 1 pengambilan paket (express mail collection)
        '3' => 'in_transit',         // 3 scan kirim (outgoing)
        '4' => 'in_transit',         // 4 scan paket sampai (incoming)
        '5' => 'in_transit',         // 5 scan keluar gudang (outbound)
        '10' => 'delivered',         // 10 tanda terima (refine via scanTypeCode 100/101)
        '11' => 'exception',         // 11 scan paket bermasalah (problem)
        '12' => 'returned',          // 12 scan retur
        '13' => 'exception',         // 13 pick up failed
        // Fallback teks (order status push memakai teks)
        'picked up' => 'picked_up',
        'pickup and collecting' => 'picked_up',
        'deployed salesperson' => 'tracking_pending',
        'delivered' => 'delivered',
        'returned' => 'returned',
        'return initiated' => 'returned',
        'cancelled' => 'cancelled',
        'pickupfail' => 'exception',
        // Label teks Indonesia dari trace J&T (fallback bila scanCode absen)
        'pengambilan paket' => 'picked_up',
        'scan kirim' => 'in_transit',
        'scan sampai' => 'in_transit',
    ],

    // scanTypeCode (hanya membedakan tipe tanda tangan pada scanType=10).
    'sign_type_code_map' => [
        '100' => 'delivered', // Delivered Sign
        '101' => 'returned',  // Return Sign
    ],

    // ACK yang diharapkan J&T saat kita menerima push (code "1"/success).
    'ack' => [
        'code' => env('JNT_ACK_CODE', '1'),
        'msg' => env('JNT_ACK_MSG', 'success'),
        'data' => env('JNT_ACK_DATA', 'SUCCESS'),
    ],
];
