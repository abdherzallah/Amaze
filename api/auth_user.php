<?php
/* ============================================================
   AMAZE API · /api/auth_user.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();

$action = $_GET['action'] ?? '';
$pdo    = db();

/* REGISTER */
if ($action === 'register') {
    require_method('POST');

    $bucketKey = rate_limit_key('user_register');
    rate_limit($bucketKey, 3, 3600);

    $in      = json_input();
    $name    = s($in['name'] ?? '', 150);
    $email   = filter_var($in['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $pass    = (string)($in['password'] ?? '');
    $country = strtoupper(s($in['country'] ?? 'US', 2));

    if (strlen($name) < 2) json_response(['ok' => false, 'error' => 'Name must be at least 2 characters'], 400);
    if (!$email)           json_response(['ok' => false, 'error' => 'Invalid email address'], 400);
    if (strlen($pass) < 6) json_response(['ok' => false, 'error' => 'Password must be at least 6 characters'], 400);

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    if ($stmt->fetch()) json_response(['ok' => false, 'error' => 'Email already registered'], 409);

    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $ins  = $pdo->prepare('INSERT INTO users (name, email, password_hash, country) VALUES (?, ?, ?, ?)');
    $ins->execute([$name, $email, $hash, $country]);
    $userId = (int)$pdo->lastInsertId();

    session_regenerate_id(true);
    unset($_SESSION['csrf_token']);
    $_SESSION['user_id']    = $userId;
    $_SESSION['user_name']  = $name;
    $_SESSION['user_email'] = $email;
    $_SESSION['country']    = $country;

    security_log('user_register', ['user_id' => $userId]);

    json_response([
        'ok'   => true,
        'user' => ['id' => $userId, 'name' => $name, 'email' => $email, 'country' => $country]
    ]);
}

/* LOGIN */
if ($action === 'login') {
    require_method('POST');

    $bucketKey = rate_limit_key('user_login');
    rate_limit($bucketKey, 5, 900);

    $in    = json_input();
    $email = filter_var($in['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $pass  = (string)($in['password'] ?? '');

    if (!$email || $pass === '') json_response(['ok' => false, 'error' => 'Email and password are required'], 400);

    $stmt = $pdo->prepare('SELECT id, name, email, password_hash, country FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($pass, $user['password_hash'])) {
        security_log('user_login_failed', ['email' => $email]);
        json_response(['ok' => false, 'error' => 'Invalid email or password'], 401);
    }

    rate_limit_clear($bucketKey);

    session_regenerate_id(true);
    unset($_SESSION['csrf_token']);
    $_SESSION['user_id']    = (int)$user['id'];
    $_SESSION['user_name']  = $user['name'];
    $_SESSION['user_email'] = $user['email'];
    $_SESSION['country']    = $user['country'];

    security_log('user_login_success', ['user_id' => (int)$user['id']]);

    json_response([
        'ok'   => true,
        'user' => [
            'id'      => (int)$user['id'],
            'name'    => $user['name'],
            'email'   => $user['email'],
            'country' => $user['country'],
        ]
    ]);
}

/* LOGOUT */
if ($action === 'logout') {
    security_log('user_logout', ['user_id' => $_SESSION['user_id'] ?? null]);

    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    json_response(['ok' => true]);
}

/* ME — always returns CSRF token, even for guests */
if ($action === 'me') {
    $token = csrf_token();

    if (empty($_SESSION['user_id'])) {
        json_response([
            'ok'            => true,
            'authenticated' => false,
            'csrf_token'    => $token
        ]);
    }
    json_response([
        'ok'            => true,
        'authenticated' => true,
        'csrf_token'    => $token,
        'user'          => [
            'id'      => $_SESSION['user_id'],
            'name'    => $_SESSION['user_name'],
            'email'   => $_SESSION['user_email'],
            'country' => $_SESSION['country'] ?? 'US',
        ]
    ]);
}

json_response(['ok' => false, 'error' => 'Unknown action'], 400);