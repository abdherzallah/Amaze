<?php
/* ============================================================
   AMAZE API · Configuration
   ============================================================ */

// ---- Database ----
define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', 'amaze');
define('DB_USER', 'root');
define('DB_PASS', '');

// ---- App ----
define('APP_NAME', 'AMAZE');
define('TAX_RATE', 0.08);
define('CURRENCY', 'USD');

// ---- Storage mode ----
define('STORAGE_MODE', 'mysql');

// ---- Session name ----
define('SESSION_NAME', 'amaze_session');

// ---- JSON response header ----
header('Content-Type: application/json; charset=utf-8');

// ---- Hide PHP errors from JSON ----
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// ---- CORS (adjust origins in production) ----
// Only allow same-origin by default. Uncomment + restrict if you need cross-origin.
/*
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = ['https://yourdomain.com'];
if (in_array($origin, $allowed, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
*/