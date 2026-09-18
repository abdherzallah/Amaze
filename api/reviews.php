<?php
/* ============================================================
   AMAZE API · /api/reviews.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();
$pdo    = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $in = json_input();
    $name     = s($in['userName'] ?? '', 60);
    $location = s($in['location'] ?? '', 60);
    $rating   = max(1, min(5, (int)($in['rating'] ?? 5)));
    $text     = s($in['text'] ?? '', 600);

    if (strlen($name) < 2) json_response(['ok' => false, 'error' => 'Name must be at least 2 characters'], 400);
    if (strlen($text) < 10) json_response(['ok' => false, 'error' => 'Review must be at least 10 characters'], 400);

    $ins = $pdo->prepare('INSERT INTO reviews (user_name, location, rating, text, status) VALUES (?, ?, ?, ?, "pending")');
    $ins->execute([$name, $location ?: 'Worldwide', $rating, $text]);
    json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    require_admin();
    $id = (int)($_GET['id'] ?? 0);
    $in = json_input();
    $status = s($in['status'] ?? '', 20);

    if (!in_array($status, ['approved', 'rejected', 'pending'], true)) {
        json_response(['ok' => false, 'error' => 'Invalid status'], 400);
    }

    $pdo->prepare('UPDATE reviews SET status = ? WHERE id = ?')->execute([$status, $id]);
    json_response(['ok' => true]);
}

if ($method === 'DELETE') {
    require_admin();
    $id = (int)