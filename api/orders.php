<?php
/* ============================================================
   AMAZE API · /api/orders.php
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

amaze_session_start();
$pdo    = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $in = json_input();
    csrf_verify_request($in);

    $required = ['full_name', 'address', 'city', 'postal_code', 'country', 'phone', 'items'];
    foreach ($required as $field) {
        if (empty($in[$field])) json_response(['ok' => false, 'error' => "Missing: $field"], 400);
    }

    $country  = strtoupper(s($in['country'], 2));
    $currency = $country === 'SA' ? 'SAR' : 'USD';

    $items = $in['items'];
    if (!is_array($items) || count($items) === 0) {
        json_response(['ok' => false, 'error' => 'Cart is empty'], 400);
    }

    $ids = array_map(fn($i) => (int)($i['product_id'] ?? 0), $items);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT * FROM products WHERE id IN ($placeholders) AND is_active = 1");
    $stmt->execute($ids);
    $products = [];
    foreach ($stmt->fetchAll() as $p) $products[(int)$p['id']] = $p;

    $subtotal = 0.0;
    $bundleDiscount = 0.0;
    $resolvedItems = [];

    foreach ($items as $it) {
        $pid = (int)($it['product_id'] ?? 0);
        $qty = max(1, (int)($it['quantity'] ?? 1));
        if (!isset($products[$pid])) {
            json_response(['ok' => false, 'error' => "Product $pid not found"], 400);
        }
        $p = $products[$pid];

        $unitPrice   = $currency === 'SAR' ? (float)$p['price_sar'] : (float)$p['price_usd'];
        $bundleQty   = (int)$p['bundle_qty'];
        $bundlePrice = $currency === 'SAR' ? (float)$p['bundle_price_sar'] : (float)$p['bundle_price_usd'];

        $lineTotal = 0;
        if ($bundleQty > 1 && $bundlePrice > 0 && $qty >= $bundleQty) {
            $bundles   = intdiv($qty, $bundleQty);
            $remainder = $qty % $bundleQty;
            $lineTotal = ($bundles * $bundlePrice) + ($remainder * $unitPrice);
            $original  = $qty * $unitPrice;
            $bundleDiscount += ($original - $lineTotal);
        } else {
            $lineTotal = $qty * $unitPrice;
        }

        $subtotal += $lineTotal;
        $resolvedItems[] = [
            'product_id'   => $pid,
            'product_name' => $p['name'],
            'price'        => $unitPrice,
            'quantity'     => $qty,
            'line_total'   => round($lineTotal, 2),
        ];
    }

    $discountAmount = 0.0;
    $discountCode   = null;

    if (!empty($in['discount_code'])) {
        $code = strtoupper(s($in['discount_code'], 30));
        $dstmt = $pdo->prepare('SELECT * FROM discount_codes WHERE code = ? AND is_active = 1 LIMIT 1');
        $dstmt->execute([$code]);
        $d = $dstmt->fetch();

        if ($d) {
            $phoneKey = preg_replace('/[\s\-\(\)\.]/', '', (string)$in['phone']);
            $ustmt = $pdo->prepare('SELECT id FROM discount_uses WHERE discount_id = ? AND phone = ? LIMIT 1');
            $ustmt->execute([$d['id'], $phoneKey]);
            $alreadyUsed = $ustmt->fetch();

            $expired = $d['expires_at'] && strtotime($d['expires_at']) < time();
            $maxed   = $d['max_uses'] && $d['uses_count'] >= $d['max_uses'];

            if (!$expired && !$maxed && !$alreadyUsed) {
                $value = (float)$d['discount_value'];
                $discountAmount = $d['discount_type'] === 'percent'
                    ? round($subtotal * $value / 100, 2)
                    : min($value, $subtotal);
                $discountCode = $d['code'];
            }
        }
    }

    $discountedSubtotal = max(0, $subtotal - $discountAmount);
    $tax      = round($discountedSubtotal * TAX_RATE, 2);
    $shipping = 0.00;
    $total    = round($discountedSubtotal + $tax + $shipping, 2);

    $next = (int)$pdo->query('SELECT COALESCE(MAX(id), 0) + 1 FROM orders')->fetchColumn();
    $orderCode = 'AMZ-' . str_pad((string)$next, 3, '0', STR_PAD_LEFT);

    try {
        $pdo->beginTransaction();

        $ins = $pdo->prepare('
            INSERT INTO orders
              (order_code, user_id, country, currency, full_name, email, phone, address, city, postal_code,
               payment_method, discount_code, discount_amount, bundle_discount, subtotal, tax, shipping, total, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "completed")
        ');
        $ins->execute([
            $orderCode,
            $_SESSION['user_id'] ?? null,
            $country,
            $currency,
            s($in['full_name'], 150),
            s($in['email'] ?? 'guest@example.com', 150),
            s($in['phone'], 40),
            s($in['address'], 255),
            s($in['city'], 80),
            s($in['postal_code'], 20),
            s($in['payment_method'] ?? 'cod', 30),
            $discountCode,
            round($discountAmount, 2),
            round($bundleDiscount, 2),
            round($subtotal, 2),
            $tax, $shipping, $total
        ]);
        $orderId = (int)$pdo->lastInsertId();

        $insItem = $pdo->prepare('
            INSERT INTO order_items (order_id, product_id, product_name, price, quantity, line_total)
            VALUES (?, ?, ?, ?, ?, ?)
        ');
        foreach ($resolvedItems as $r) {
            $insItem->execute([
                $orderId, $r['product_id'], $r['product_name'],
                $r['price'], $r['quantity'], $r['line_total']
            ]);
        }

        if ($discountCode) {
            $dstmt = $pdo->prepare('SELECT id FROM discount_codes WHERE code = ?');
            $dstmt->execute([$discountCode]);
            $dRow = $dstmt->fetch();
            if ($dRow) {
                $pdo->prepare('UPDATE discount_codes SET uses_count = uses_count + 1 WHERE id = ?')
                    ->execute([$dRow['id']]);
                $pdo->prepare('INSERT INTO discount_uses (discount_id, phone, order_id) VALUES (?, ?, ?)')
                    ->execute([$dRow['id'], preg_replace('/[\s\-\(\)\.]/', '', $in['phone']), $orderId]);
            }
        }

        $pdo->commit();

        security_log('order_created', [
            'order_id' => $orderId, 'order_code' => $orderCode,
            'total' => $total, 'currency' => $currency,
        ]);

        json_response([
            'ok' => true,
            'order' => [
                'id' => $orderId,
                'order_code' => $orderCode,
                'currency' => $currency,
                'subtotal' => $subtotal,
                'discount_amount' => $discountAmount,
                'bundle_discount' => $bundleDiscount,
                'tax' => $tax,
                'total' => $total,
            ]
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Order creation failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'Order could not be created'], 500);
    }
}

require_admin();
$rows = $pdo->query('SELECT * FROM orders ORDER BY id DESC')->fetchAll();
json_response(['ok' => true, 'orders' => $rows]);