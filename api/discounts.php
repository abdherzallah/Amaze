<?php
/* ============================================================
   AMAZE API · /api/discounts.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();
$pdo    = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* Public validation */
if ($method === 'GET' && isset($_GET['code'])) {
    $code     = strtoupper(s($_GET['code'], 30));
    $subtotal = max(0, (float)($_GET['subtotal'] ?? 0));
    $phoneKey = preg_replace('/[\s\-\(\)\.]/', '', (string)($_GET['phone'] ?? ''));

    $stmt = $pdo->prepare('SELECT * FROM discount_codes WHERE code = ? LIMIT 1');
    $stmt->execute([$code]);
    $d = $stmt->fetch();

    if (!$d) json_response(['ok' => false, 'error' => 'Invalid discount code'], 404);
    if (!$d['is_active']) json_response(['ok' => false, 'error' => 'This code is no longer active'], 400);
    if ($d['expires_at'] && strtotime($d['expires_at']) < strtotime(date('Y-m-d'))) {
        json_response(['ok' => false, 'error' => 'This code has expired'], 400);
    }
    if ($d['max_uses'] && $d['uses_count'] >= $d['max_uses']) {
        json_response(['ok' => false, 'error' => 'This code has reached its usage limit'], 400);
    }

    if ($phoneKey) {
        $ustmt = $pdo->prepare('SELECT id FROM discount_uses WHERE discount_id = ? AND phone = ? LIMIT 1');
        $ustmt->execute([$d['id'], $phoneKey]);
        if ($ustmt->fetch()) json_response(['ok' => false, 'error' => 'You have already used this code'], 400);
    }

    $value  = (float)$d['discount_value'];
    $amount = ($d['discount_type'] === 'percent')
        ? round($subtotal * $value / 100, 2)
        : min($value, $subtotal);

    json_response([
        'ok'              => true,
        'code'            => $d['code'],
        'type'            => $d['discount_type'],
        'value'           => $value,
        'discount_amount' => $amount,
        'subtotal_after'  => round($subtotal - $amount, 2),
    ]);
}

require_admin();

if ($method === 'GET') {
    $rows = $pdo->query('SELECT * FROM discount_codes ORDER BY id DESC')->fetchAll();
    json_response(['ok' => true, 'discounts' => $rows]);
}

if ($method === 'POST') {
    $in = json_input();
    csrf_verify_request($in);

    $code   = strtoupper(s($in['code'] ?? '', 30));
    $type   = ($in['discount_type'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent';
    $value  = (float)($in['discount_value'] ?? 0);
    $max    = isset($in['max_uses']) && $in['max_uses'] !== '' ? (int)$in['max_uses'] : null;
    $exp    = !empty($in['expires_at']) ? s($in['expires_at'], 20) : null;
    $active = isset($in['is_active']) ? (int)(bool)$in['is_active'] : 1;

    if ($code === '')       json_response(['ok' => false, 'error' => 'Code is required'], 400);
    if ($value <= 0)        json_response(['ok' => false, 'error' => 'Value must be greater than 0'], 400);
    if ($type === 'percent' && $value > 100) {
        json_response(['ok' => false, 'error' => 'Percentage cannot exceed 100'], 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM discount_codes WHERE code = ? LIMIT 1');
    $stmt->execute([$code]);
    if ($stmt->fetch()) json_response(['ok' => false, 'error' => 'That code already exists'], 409);

    $ins = $pdo->prepare('
        INSERT INTO discount_codes (code, discount_type, discount_value, max_uses, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
    ');
    $ins->execute([$code, $type, $value, $max, $exp, $active]);

    security_log('discount_created', ['code' => $code, 'type' => $type, 'value' => $value]);

    json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    $in = json_input();
    csrf_verify_request($in);

    $fields = [];
    $values = [];

    if (isset($in['is_active']))      { $fields[] = 'is_active = ?';      $values[] = (int)(bool)$in['is_active']; }
    if (isset($in['discount_value'])) { $fields[] = 'discount_value = ?'; $values[] = (float)$in['discount_value']; }
    if (isset($in['max_uses']))       { $fields[] = 'max_uses = ?';       $values[] = $in['max_uses'] !== '' ? (int)$in['max_uses'] : null; }
    if (array_key_exists('expires_at', $in)) {
        $fields[] = 'expires_at = ?';
        $values[] = !empty($in['expires_at']) ? $in['expires_at'] : null;
    }

    if (!$fields) json_response(['ok' => false, 'error' => 'Nothing to update'], 400);

    $values[] = $id;
    $pdo->prepare('UPDATE discount_codes SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);

    security_log('discount_updated', ['id' => $id]);

    json_response(['ok' => true]);
}

if ($method === 'DELETE') {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    csrf_verify($token);

    $id = (int)($_GET['id'] ?? 0);
    $pdo->prepare('DELETE FROM discount_codes WHERE id = ?')->execute([$id]);

    security_log('discount_deleted', ['id' => $id]);

    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);