<?php
/* ============================================================
   AMAZE API · Session bootstrap + CSRF helpers
   ============================================================ */
require_once __DIR__ . '/config.php';

function amaze_session_start(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $isHttps = (
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443')
    );

    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode',  '1');
    ini_set('session.cookie_httponly',  '1');
    ini_set('session.cookie_samesite',  'Lax');
    ini_set('session.cookie_secure',    $isHttps ? '1' : '0');

    amaze_set_cookie_params($isHttps);

    session_name(SESSION_NAME);
    session_start();

    $idleLimit = 30 * 60;
    if (!empty($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $idleLimit)) {
        amaze_destroy_and_restart($isHttps);
    }

    $absoluteLimit = 8 * 60 * 60;
    if (empty($_SESSION['created_at'])) {
        $_SESSION['created_at'] = time();
    } elseif (time() - $_SESSION['created_at'] > $absoluteLimit) {
        amaze_destroy_and_restart($isHttps);
    }

    if (empty($_SESSION['regenerated_at'])) {
        $_SESSION['regenerated_at'] = time();
    } elseif (time() - $_SESSION['regenerated_at'] > 15 * 60) {
        session_regenerate_id(true);
        $_SESSION['regenerated_at'] = time();
    }

    $_SESSION['last_activity'] = time();
}

function amaze_set_cookie_params(bool $isHttps): void {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function amaze_destroy_and_restart(bool $isHttps): void {
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(), '',
            time() - 42000,
            $params['path'], $params['domain'],
            $params['secure'], $params['httponly']
        );
    }

    session_destroy();
    amaze_set_cookie_params($isHttps);
    session_start();
    session_regenerate_id(true);

    $_SESSION['created_at']     = time();
    $_SESSION['regenerated_at'] = time();
    $_SESSION['last_activity']  = time();
}

function csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_verify(?string $token): void {
    if (empty($_SESSION['csrf_token']) || !is_string($token) || $token === '') {
        json_response(['ok' => false, 'error' => 'Missing CSRF token'], 403);
    }
    if (!hash_equals($_SESSION['csrf_token'], $token)) {
        json_response(['ok' => false, 'error' => 'Invalid CSRF token'], 403);
    }
}

function csrf_verify_request(array $body = []): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($body['csrf_token'] ?? null);
    csrf_verify($token);
}