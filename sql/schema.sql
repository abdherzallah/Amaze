CREATE DATABASE IF NOT EXISTS amaze
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE amaze;

CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  last_login    DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  country       CHAR(2) DEFAULT 'US',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(150) NOT NULL,
  description       TEXT,
  image             VARCHAR(255),
  price_usd         DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_sar         DECIMAL(10,2) NOT NULL DEFAULT 0,
  bundle_qty        INT NOT NULL DEFAULT 1,
  bundle_price_usd  DECIMAL(10,2) NOT NULL DEFAULT 0,
  bundle_price_sar  DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory (
  product_id INT PRIMARY KEY,
  stock      INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  order_code       VARCHAR(20) NOT NULL UNIQUE,
  user_id          INT NULL,
  country          CHAR(2) NOT NULL,
  currency         CHAR(3) NOT NULL,
  full_name        VARCHAR(150) NOT NULL,
  email            VARCHAR(150),
  phone            VARCHAR(40),
  address          VARCHAR(255),
  city             VARCHAR(80),
  postal_code      VARCHAR(20),
  payment_method   VARCHAR(30),
  discount_code    VARCHAR(30) NULL,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  bundle_discount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax              DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'completed',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT NOT NULL,
  product_id   INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  quantity     INT NOT NULL,
  line_total   DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS discount_codes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(30) NOT NULL UNIQUE,
  discount_type  ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_uses       INT NULL,
  uses_count     INT NOT NULL DEFAULT 0,
  expires_at     DATE NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS discount_uses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  discount_id INT NOT NULL,
  phone       VARCHAR(40) NOT NULL,
  order_id    INT NOT NULL,
  used_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_discount_phone (discount_id, phone),
  FOREIGN KEY (discount_id) REFERENCES discount_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id)    REFERENCES orders(id)          ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_name  VARCHAR(60) NOT NULL,
  location   VARCHAR(60) DEFAULT 'Worldwide',
  rating     TINYINT NOT NULL DEFAULT 5,
  text       VARCHAR(600) NOT NULL,
  status     ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS geo_cache (
  ip        VARCHAR(45) PRIMARY KEY,
  country   CHAR(2) NOT NULL,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cached (cached_at)
) ENGINE=InnoDB;

-- Seed data
INSERT INTO products (name, description, image, price_usd, price_sar, bundle_qty, bundle_price_usd, bundle_price_sar)
VALUES ('Radiant Glow Serum', 'Vitamin C + Hyaluronic Acid', 'images-video/amaze.jpeg',
        48.00, 180.00, 3, 120.00, 450.00);

INSERT INTO inventory (product_id, stock) VALUES (1, 100);