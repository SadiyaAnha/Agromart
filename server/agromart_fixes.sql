-- ============================================================
-- AGROMART DATABASE FIXES
-- Run this entire script in phpMyAdmin > SQL tab
-- ============================================================

USE agromart;

-- ============================================================
-- STEP 1: CREATE Cart table (was missing from original schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS Cart (
  CartID INT AUTO_INCREMENT PRIMARY KEY,
  UserCustomerID INT NOT NULL,
  PreOrderRequestID INT DEFAULT NULL,
  ItemID INT DEFAULT NULL,
  Quantity INT NOT NULL DEFAULT 1,
  PricePerUnit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  ShopID INT DEFAULT NULL,
  AddedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserCustomerID) REFERENCES Customer(UserCustomerID) ON DELETE CASCADE,
  FOREIGN KEY (PreOrderRequestID) REFERENCES PreOrderRequest(PreOrderID) ON DELETE CASCADE,
  FOREIGN KEY (ItemID) REFERENCES Items(ItemID) ON DELETE SET NULL,
  FOREIGN KEY (ShopID) REFERENCES Shop(ShopID) ON DELETE SET NULL
);

-- ============================================================
-- STEP 2: Ensure PreOrderRequest has ListingID column
-- ============================================================
-- Add ListingID if it does not already exist
ALTER TABLE PreOrderRequest
  ADD COLUMN IF NOT EXISTS ListingID INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ItemID INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ProductID INT DEFAULT NULL;

-- Add foreign key for ListingID if not already present (safe via IF NOT EXISTS workaround)
-- (MySQL 8.0+ supports ADD CONSTRAINT IF NOT EXISTS but older versions don't; use try/catch in app)
-- You can skip the FK if you get an error — the column is more important.
ALTER TABLE PreOrderRequest
  MODIFY COLUMN ListingID INT DEFAULT NULL;

-- ============================================================
-- STEP 3: Fix Items table columns
-- Some databases have `FruitsVegetables` instead of `Fruits` and `Vegetables`
-- ============================================================
ALTER TABLE Items DROP COLUMN IF EXISTS FruitsVegetables;
ALTER TABLE Items ADD COLUMN IF NOT EXISTS Fruits BOOLEAN DEFAULT FALSE;
ALTER TABLE Items ADD COLUMN IF NOT EXISTS Vegetables BOOLEAN DEFAULT FALSE;

-- ============================================================
-- STEP 4: Fix Order table — InvoiceID should default to OrderID
-- and InvoiceDate should be set automatically
-- ============================================================
-- Make sure InvoiceID column exists and allow it to be auto-set
ALTER TABLE `Order`
  MODIFY COLUMN InvoiceID VARCHAR(100) DEFAULT NULL,
  MODIFY COLUMN InvoiceDate DATETIME DEFAULT NULL;

-- ============================================================
-- STEP 5: Fix existing orders that have NULL InvoiceID/InvoiceDate
-- ============================================================
UPDATE `Order`
SET
  InvoiceID = CAST(OrderID AS CHAR),
  InvoiceDate = created_at
WHERE InvoiceID IS NULL OR InvoiceDate IS NULL;

-- ============================================================
-- STEP 6: Remove AdminID column from Farmer and Customer tables
-- (Drop FK first, then column)
-- ============================================================

-- Remove AdminID foreign key from Farmer
SET @fk_farmer = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'agromart'
    AND TABLE_NAME = 'Farmer'
    AND COLUMN_NAME = 'AdminID'
    AND REFERENCED_TABLE_NAME = 'Admin'
  LIMIT 1
);

SET @sql_farmer = IF(@fk_farmer IS NOT NULL,
  CONCAT('ALTER TABLE Farmer DROP FOREIGN KEY ', @fk_farmer),
  'SELECT 1'
);
PREPARE stmt FROM @sql_farmer;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE Farmer DROP COLUMN IF EXISTS AdminID;

-- Remove AdminID foreign key from Customer
SET @fk_customer = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'agromart'
    AND TABLE_NAME = 'Customer'
    AND COLUMN_NAME = 'AdminID'
    AND REFERENCED_TABLE_NAME = 'Admin'
  LIMIT 1
);

SET @sql_customer = IF(@fk_customer IS NOT NULL,
  CONCAT('ALTER TABLE Customer DROP FOREIGN KEY ', @fk_customer),
  'SELECT 1'
);
PREPARE stmt FROM @sql_customer;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE Customer DROP COLUMN IF EXISTS AdminID;

-- Remove AdminID foreign key from DeliveryMan (before dropping table)
SET @fk_dlv = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'agromart'
    AND TABLE_NAME = 'DeliveryMan'
    AND COLUMN_NAME = 'AdminID'
    AND REFERENCED_TABLE_NAME = 'Admin'
  LIMIT 1
);

SET @sql_dlv = IF(@fk_dlv IS NOT NULL,
  CONCAT('ALTER TABLE DeliveryMan DROP FOREIGN KEY ', @fk_dlv),
  'SELECT 1'
);
PREPARE stmt FROM @sql_dlv;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
-- STEP 7: Drop Delivery, DeliveryMan, Admin tables
-- ============================================================

-- Drop Delivery first (references DeliveryMan and Order)
DROP TABLE IF EXISTS Delivery;

-- Drop DeliveryMan next
DROP TABLE IF EXISTS DeliveryMan;

-- Drop Admin last (no more FKs pointing to it)
DROP TABLE IF EXISTS Admin;

-- ============================================================
-- STEP 8: Clear phantom cart rows (regular items with no PreOrderRequestID)
-- These were added erroneously on login by the old client code.
-- ============================================================
DELETE FROM Cart WHERE PreOrderRequestID IS NULL;

-- ============================================================
-- VERIFICATION QUERIES (optional — run to confirm)
-- ============================================================
-- SELECT * FROM Cart LIMIT 5;
-- SELECT * FROM PreOrderRequest LIMIT 5;
-- SHOW COLUMNS FROM Farmer;
-- SHOW COLUMNS FROM Customer;
-- SHOW TABLES;
