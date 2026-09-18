<?php
/* ============================================================
   AMAZE API · Helpers (public entry point — includes rate limit)
   ============================================================ */
require_once __DIR__ . '/helpers_core.php';
require_once __DIR__ . '/ratelimit.php';

function require_admin(): void {
    amaze_session_start();

    if (empty($_SESSION['admin_id'])) {
        json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
    }

    $idleLimit = 30 * 60;
    if (!empty($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $idleLimit)) {
        $_SESSION = [];
        session_destroy();
        json_response(['ok' => false, 'error' => 'Session expired — please log in again'], 401);
    }
    $_SESSION['last_activity'] = time();
}