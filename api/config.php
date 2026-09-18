<?php
/* ============================================================
   AMAZE API · Configuration
   ============================================================ */

define('DB_HOST', '127.0.0.1');
define('DB_PORT', 3306);
define('DB_NAME', 'amaze');
define('DB_USER', 'root');
define('DB_PASS', '');

define('APP_NAME', 'AMAZE');
define('TAX_RATE', 0.08);
define('CURRENCY', 'USD');

define('STORAGE_MODE', 'mysql');
define('SESSION_NAME', 'amaze_session');

define('AMAZE_GEO_DEBUG', false);

header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);