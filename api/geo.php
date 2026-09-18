<?php
/* ============================================================
   AMAZE API · /api/geo.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();

if (defined('AMAZE_GEO_DEBUG') && AMAZE_GEO_DEBUG && !empty($_GET['force'])) {
    $forced = strtoupper(s($_GET['force'], 2));
    if (preg_match('/^[A-Z]{2}$/', $forced)) {
        $_SESSION['geo_country'] = $forced;
        json_response(['ok' => true, 'country' => $forced, 'source' => 'forced']);
    }
}

if (!empty($_SESSION['geo_country']) && preg_match('/^[A-Z]{2}$/', $_SESSION['geo_country'])) {
    json_response(['ok' => true, 'country' => $_SESSION['geo_country'], 'source' => 'session']);
}

$ip = amaze_client_ip();

if (!empty($_SERVER['HTTP_CF_IPCOUNTRY'])) {
    $cc = strtoupper(substr($_SERVER['HTTP_CF_IPCOUNTRY'], 0, 2));
    if (preg_match('/^[A-Z]{2}$/', $cc) && $cc !== 'XX' && $cc !== 'T1') {
        $_SESSION['geo_country'] = $cc;
        json_response(['ok' => true, 'country' => $cc, 'source' => 'cloudflare']);
    }
}

if (amaze_is_private_ip($ip)) {
    $_SESSION['geo_country'] = 'US';
    json_response(['ok' => true, 'country' => 'US', 'source' => 'fallback-local']);
}

$country = amaze_lookup_country($ip);

if ($country === null) {
    $country = 'US';
    $source  = 'fallback';
} else {
    $source = 'api';
}

$_SESSION['geo_country'] = $country;
json_response(['ok' => true, 'country' => $country, 'source' => $source]);

function amaze_client_ip(): string {
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
        $_SERVER['HTTP_X_REAL_IP']        ?? null,
        $_SERVER['HTTP_X_FORWARDED_FOR']  ?? null,
        $_SERVER['REMOTE_ADDR']           ?? null,
    ];
    foreach ($candidates as $raw) {
        if (!$raw) continue;
        $first = trim(explode(',', $raw)[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return '0.0.0.0';
}

function amaze_is_private_ip(string $ip): bool {
    if (!filter_var($ip, FILTER_VALIDATE_IP)) return true;
    $public = filter_var($ip, FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
    return $public === false;
}

function amaze_lookup_country(string $ip): ?string {
    $pdo = null;
    try {
        $pdo  = db();
        $stmt = $pdo->prepare(
            'SELECT country FROM geo_cache
             WHERE ip = ? AND cached_at > (NOW() - INTERVAL 30 DAY)
             LIMIT 1'
        );
        $stmt->execute([$ip]);
        $row = $stmt->fetch();
        if ($row && preg_match('/^[A-Z]{2}$/', $row['country'])) {
            return $row['country'];
        }
    } catch (Throwable $e) {
        error_log('geo_cache read failed: ' . $e->getMessage());
    }

    $country = amaze_lookup_country_from_api($ip);
    if ($country === null) return null;

    if ($pdo !== null) {
        try {
            $pdo->prepare(
                'INSERT INTO geo_cache (ip, country, cached_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE country = VALUES(country), cached_at = NOW()'
            )->execute([$ip, $country]);
        } catch (Throwable $e) {
            error_log('geo_cache write failed: ' . $e->getMessage());
        }
    }
    return $country;
}

function amaze_lookup_country_from_api(string $ip): ?string {
    $endpoints = [
        "https://ip-api.com/json/{$ip}?fields=status,countryCode",
        "http://ip-api.com/json/{$ip}?fields=status,countryCode",
    ];

    if (defined('IPINFO_TOKEN') && IPINFO_TOKEN) {
        array_unshift($endpoints,
            "https://ipinfo.io/{$ip}/json?token=" . urlencode(IPINFO_TOKEN));
    }

    foreach ($endpoints as $url) {
        $result = amaze_http_get_json($url, 3);
        if (!is_array($result)) continue;

        if (isset($result['status']) && $result['status'] === 'success'
            && !empty($result['countryCode'])) {
            $cc = strtoupper(substr($result['countryCode'], 0, 2));
            if (preg_match('/^[A-Z]{2}$/', $cc)) return $cc;
        }

        if (!empty($result['country'])) {
            $cc = strtoupper(substr($result['country'], 0, 2));
            if (preg_match('/^[A-Z]{2}$/', $cc)) return $cc;
        }
    }
    return null;
}

function amaze_http_get_json(string $url, int $timeoutSeconds = 3): ?array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => $timeoutSeconds,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 2,
            CURLOPT_USERAGENT      => 'AMAZE/1.0',
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $raw = curl_exec($ch);
        $err = curl_errno($ch);
        curl_close($ch);
        if ($err || !is_string($raw)) return null;
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    if (!ini_get('allow_url_fopen')) return null;

    $ctx = stream_context_create([
        'http' => [
            'method'        => 'GET',
            'timeout'       => $timeoutSeconds,
            'user_agent'    => 'AMAZE/1.0',
            'ignore_errors' => true,
        ],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);

    $raw = @file_get_contents($url, false, $ctx);
    if (!is_string($raw) || $raw === '') return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}