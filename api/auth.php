<?php
/* ============================================================
   AMAZE API · /api/auth.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();

$action = $_GET['action'] ?? '';
$pdo    = db();

/* ============================================================
   LOGIN
   ============================================================ */
if ($action === 'login') {
    require_method('POST');

    $in = json_input();
    $username = s($in['username'] ?? '', 80);
    $password = (string)($in['password'] ?? '');

    if ($username === '' || $password === '') {
        json_response(['ok' => false, 'error' => 'Username and password are required'], 400);
    }

    $stmt = $pdo->prepare('
        SELECT id, username, password_hash, name
        FROM admins
        WHERE username = ?
        LIMIT 1
    ');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password_hash'])) {
        security_log('admin_login_failed', ['username' => $username]);
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }

    /* Fresh session ID */
    session_regenerate_id(true);

    /* Clear stale CSRF token from before login */
    unset($_SESSION['csrf_token']);

    $_SESSION['admin_id']   = (int)$admin['id'];
    $_SESSION['admin_name'] = $admin['name'];
    $_SESSION['admin_user'] = $admin['username'];

    /* Generate a fresh CSRF token */
    $token = csrf_token();

    try {
        $pdo->prepare('UPDATE admins SET last_login = NOW() WHERE id = ?')->execute([$admin['id']]);
    } catch (Throwable $e) {
        error_log('last_login update failed: ' . $e->getMessage());
    }

    security_log('admin_login_success', ['admin_id' => (int)$admin['id']]);

    json_response([
        'ok'         => true,
        'csrf_token' => $token,
        'admin'      => [
            'id'       => (int)$admin['id'],
            'name'     => $admin['name'],
            'username' => $admin['username'],
        ]
    ]);
}

/* ============================================================
   LOGOUT
   ============================================================ */
if ($action === 'logout') {
    security_log('admin_logout', ['admin_id' => $_SESSION['admin_id'] ?? null]);

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
    json_response(['ok' => true]);
}

/* ============================================================
   ME — always returns CSRF token when authenticated
   ============================================================ */
if ($action === 'me') {
    if (empty($_SESSION['admin_id'])) {
        json_response(['ok' => true, 'authenticated' => false]);
    }

    /* Ensure a CSRF token exists for this session (generates if missing) */
    $token = csrf_token();

    json_response([
        'ok'            => true,
        'authenticated' => true,
        'csrf_token'    => $token,
        'admin'         => [
            'id'       => $_SESSION['admin_id'],
            'name'     => $_SESSION['admin_name'],
            'username' => $_SESSION['admin_user'],
        ],
    ]);
}

json_response(['ok' => false, 'error' => 'Unknown action'], 400);