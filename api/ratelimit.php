<?php
/* ============================================================
   AMAZE API · Rate Limiting
   ============================================================ */
require_once __DIR__ . '/helpers_core.php';

function rate_limit(string $key, int $maxAttempts = 5, int $windowSecs = 900): void {
    $pdo = db();
    $now = time();

    try {
        if (random_int(1, 100) === 1) {
            $pdo->prepare('DELETE FROM rate_limits WHERE expires_at < ?')->execute([$now]);
        }

        $stmt = $pdo->prepare('SELECT id, hits, expires_at FROM rate_limits WHERE bucket = ? LIMIT 1');
        $stmt->execute([$key]);
        $row = $stmt->fetch();

        if (!$row) {
            $pdo->prepare('INSERT INTO rate_limits (bucket, hits, expires_at) VALUES (?, 1, ?)')
                ->execute([$key, $now + $windowSecs]);
            return;
        }

        if ((int)$row['expires_at'] < $now) {
            $pdo->prepare('UPDATE rate_limits SET hits = 1, expires_at = ? WHERE id = ?')
                ->execute([$now + $windowSecs, $row['id']]);
            return;
        }

        if ((int)$row['hits'] >= $maxAttempts) {
            $retryAfter = max(1, (int)$row['expires_at'] - $now);
            header('Retry-After: ' . $retryAfter);
            json_response([
                'ok'          => false,
                'error'       => 'Too many attempts. Please try again later.',
                'retry_after' => $retryAfter
            ], 429);
        }

        $pdo->prepare('UPDATE rate_limits SET hits = hits + 1 WHERE id = ?')
            ->execute([$row['id']]);
    } catch (Throwable $e) {
        error_log('Rate limit error: ' . $e->getMessage());
    }
}

function rate_limit_clear(string $key): void {
    try {
        $pdo = db();
        $pdo->prepare('DELETE FROM rate_limits WHERE bucket = ?')->execute([$key]);
    } catch (Throwable $e) {
        error_log('Rate limit clear error: ' . $e->getMessage());
    }
}

function rate_limit_key(string $prefix): string {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP']
        ?? $_SERVER['HTTP_X_REAL_IP']
        ?? ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '')
        ?? ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $ip = trim(explode(',', $ip)[0]);
    return $prefix . ':' . $ip;
}