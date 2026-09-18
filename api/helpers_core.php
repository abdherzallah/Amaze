<?php
/* ============================================================
   AMAZE API · Core helpers (no rate limit dependency)
   ============================================================ */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/session.php';
require_once __DIR__ . '/db.php';

function json_response($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function s($value, int $max = 500): string {
    return mb_substr(trim((string)$value), 0, $max);
}

function generate_id(string $prefix = 'id'): string {
    return $prefix . '-' . bin2hex(random_bytes(5));
}

function require_method(string $method): void {
    $actual = strtoupper(trim($_SERVER['REQUEST_METHOD'] ?? ''));
    if ($actual !== strtoupper($method)) {
        json_response([
            'ok'       => false,
            'error'    => 'Method not allowed',
            'expected' => strtoupper($method),
            'received' => $actual,
        ], 405);
    }
}

function security_log(string $event, array $context = []): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    error_log(sprintf(
        '[AMAZE SECURITY] %s | ip=%s | ua=%s | ctx=%s',
        $event,
        $ip,
        mb_substr($ua, 0, 120),
        json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    ));
}