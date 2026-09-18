<?php
/* ============================================================
   AMAZE API · /api/products.php
   GET   — public: list active products (with stock)
   POST  — admin:  create new product
   PUT   — admin:  update stock / price / active
   ============================================================ */
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

$pdo    = db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ============================================================
   GET — public product list
   ============================================================ */
if ($method === 'GET') {
    $country  = strtoupper(s($_GET['country'] ?? 'US', 2));
    $currency = $country === 'SA' ? 'SAR' : 'USD';

    $stmt = $pdo->query('
        SELECT p.*, COALESCE(i.stock, 0) AS stock
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.is_active = 1
        ORDER BY p.id ASC
    ');
    $products = $stmt->fetchAll();

    foreach ($products as &$p) {
        $p['currency']      = $currency;
        $p['price_display'] = $currency === 'SAR' ? (float)$p['price_sar'] : (float)$p['price_usd'];
        $p['bundle_qty']    = (int)$p['bundle_qty'];
        $p['bundle_price']  = $currency === 'SAR' ? (float)$p['bundle_price_sar'] : (float)$p['bundle_price_usd'];
        $p['bundle_active'] = $p['bundle_qty'] > 1 && $p['bundle_price'] > 0;
    }
    unset($p);

    json_response([
        'ok'       => true,
        'currency' => $currency,
        'country'  => $country,
        'products' => $products,
    ]);
}

/* ============================================================
   Admin + CSRF
   ============================================================ */
require_admin();

/* POST — create product */
if ($method === 'POST') {
    $in = json_input();
    csrf_verify_request($in);

    $name   = s($in['name'] ?? '', 150);
    $sku    = strtoupper(s($in['sku'] ?? '', 30));
    $stock  = max(0, (int)($in['stock'] ?? 0));
    $priceU = max(0, (float)($in['price_usd'] ?? 0));
    $priceS = max(0, (float)($in['price_sar'] ?? 0));
    $image  = s($in['image'] ?? '', 255);
    $desc   = s($in['description'] ?? '', 1000);

    if ($name === '') json_response(['ok' => false, 'error' => 'Name is required'], 400);
    if ($sku === '')  json_response(['ok' => false, 'error' => 'SKU is required'], 400);

    try {
        $pdo->beginTransaction();

        $ins = $pdo->prepare('
            INSERT INTO products (name, description, image, price_usd, price_sar, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        ');
        $ins->execute([$name, $desc, $image, $priceU, $priceS]);
        $productId = (int)$pdo->lastInsertId();

        $pdo->prepare('INSERT INTO inventory (product_id, stock) VALUES (?, ?)')
            ->execute([$productId, $stock]);

        $pdo->commit();

        security_log('product_created', ['product_id' => $productId, 'sku' => $sku]);

        json_response([
            'ok'      => true,
            'product' => [
                'id'    => $productId,
                'name'  => $name,
                'sku'   => $sku,
                'stock' => $stock,
            ]
        ], 201);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Product creation failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'Could not create product'], 500);
    }
}

/* PUT — update product / stock */
if ($method === 'PUT') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) json_response(['ok' => false, 'error' => 'Missing product id'], 400);

    $in = json_input();
    csrf_verify_request($in);

    $chk = $pdo->prepare('SELECT id FROM products WHERE id = ? LIMIT 1');
    $chk->execute([$id]);
    if (!$chk->fetch()) json_response(['ok' => false, 'error' => 'Product not found'], 404);

    try {
        $pdo->beginTransaction();

        $fields = [];
        $values = [];

        if (isset($in['price_usd']))        { $fields[] = 'price_usd = ?';        $values[] = max(0, (float)$in['price_usd']); }
        if (isset($in['price_sar']))        { $fields[] = 'price_sar = ?';        $values[] = max(0, (float)$in['price_sar']); }
        if (isset($in['bundle_qty']))       { $fields[] = 'bundle_qty = ?';       $values[] = max(1, (int)$in['bundle_qty']); }
        if (isset($in['bundle_price_usd'])) { $fields[] = 'bundle_price_usd = ?'; $values[] = max(0, (float)$in['bundle_price_usd']); }
        if (isset($in['bundle_price_sar'])) { $fields[] = 'bundle_price_sar = ?'; $values[] = max(0, (float)$in['bundle_price_sar']); }
        if (isset($in['is_active']))        { $fields[] = 'is_active = ?';        $values[] = (int)(bool)$in['is_active']; }

        if ($fields) {
            $values[] = $id;
            $pdo->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?')
                ->execute($values);
        }

        if (isset($in['stock'])) {
            $newStock = max(0, (int)$in['stock']);
            $upsert = $pdo->prepare('
                INSERT INTO inventory (product_id, stock)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE stock = VALUES(stock)
            ');
            $upsert->execute([$id, $newStock]);
        }

        $pdo->commit();

        security_log('product_updated', ['product_id' => $id]);

        $q = $pdo->prepare('SELECT p.*, COALESCE(i.stock, 0) AS stock
                            FROM products p
                            LEFT JOIN inventory i ON i.product_id = p.id
                            WHERE p.id = ? LIMIT 1');
        $q->execute([$id]);
        json_response(['ok' => true, 'product' => $q->fetch()]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        error_log('Product update failed: ' . $e->getMessage());
        json_response(['ok' => false, 'error' => 'Could not update product'], 500);
    }
}

json_response(['ok' => false, 'error' => 'Method not allowed'], 405);