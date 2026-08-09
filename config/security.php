<?php

$trustedProxies = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env('TRUSTED_PROXIES', '127.0.0.1,::1')),
)));

return [
    'force_https' => (bool) env('FORCE_HTTPS', false),
    'trusted_proxies' => $trustedProxies,
];
