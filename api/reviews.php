<?php
/* ============================================================
   AMAZE API · /api/reviews.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();
$pdo    = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* POST — submit a new review (public, rate-limited) */
if ($method === 'POST') {
    $bucketKey = rate_limit_key('review_submit');
    rate_limit($bucketKey, 5, 3600);

    $in = json_input();

    $name     = s($in['userName'] ?? '', 60);
    $location = s($in['location'] ?? '', 60);
    $rating   = max(1, min(5, (int)($in['rating'] ?? 5)));
    $text     = s($in['text'] ?? '', 600);

    if (strlen($name) < 2) json_response(['ok' => false, 'error' => 'Name must be at least 2 characters'], 400);
    if (strlen($text) < 10) json_response(['ok' => false, 'error' => 'Review must be at least 10 characters'], 400);

    $ins = $pdo->prepare('
        INSERT INTO reviews (user_name, location, rating, text, status)
        VALUES (?, ?, ?, ?, "pending")
    ');
    $ins->execute([$name, $location ?: 'Worldwide', $rating, $text]);

    security_log('review_submitted', ['review_id' => (int)$pdo->lastInsertId()]);

    json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
}

/* GET — public: approved reviews; admin (?all=1): all */
if ($method === 'GET') {
    $isAdmin = !empty($_SESSION['admin_id']);
    $wantAll = isset($_GET['all']) && $_GET['all'] === '1';

    if ($isAdmin && $wantAll) {
        $rows = $pdo->query('SELECT * FROM reviews ORDER BY id DESC')->fetchAll();
    } else {
        $stmt = $pdo->prepare('SELECT * FROM reviews WHERE status = "approved" ORDER BY id DESC');
        $stmt->execute();
        $rows = $stmt->fetchAll();
    }
    json_response(['ok' => true, 'reviews' => $rows]);
}

/* PUT — update status (admin) */
if ($method === 'PUT') {
    require_admin();
    $id = (int)($_GET['id'] ?? 0);
    $in = json_input();
    csrf_verify_request($in);
    $status = s($in['status'] ?? '', 20);

    if ($id <= 0) json_response(['ok' => false, 'error' => 'Missing review id'], 400);
    if (!in_array($status, ['approved', 'rejected', 'pending'], true)) {
        json_response(['ok' => false, 'error' => 'Invalid status'], 400);
    }

    $pdo->prepare('UPDATE reviews SET status = ? WHERE id = ?')->execute([$status, $id]);
    security_log('review_status_changed', ['review_id' => $id, 'status' => $status]);
    json_response(['ok' => true]);
}

/* DELETE — remove a review (admin) */
if ($method === 'DELETE') {
    require_admin();
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    csrf_verify($token);

    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) json_response(['ok' => false, 'error' => 'Missing review id'], 400);

    $pdo->prepare('DELETE FROM reviews WHERE id = ?')->execute([$id]);
    security_log('review_deleted', ['review_id' => $id]);
    json_response(['ok' => true]);
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);