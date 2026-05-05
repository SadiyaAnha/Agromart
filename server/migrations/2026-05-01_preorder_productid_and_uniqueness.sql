-- Ensure PreOrderListing supports catalog-based preorders and duplicate prevention.
-- Run this once on your agromart database.

ALTER TABLE PreOrderListing
ADD COLUMN IF NOT EXISTS ProductID INT NULL AFTER ItemID;

-- Optional backfill if some old rows were tied to Items only.
UPDATE PreOrderListing l
JOIN Items i ON l.ItemID = i.ItemID
SET l.ProductID = i.ProductID
WHERE l.ProductID IS NULL;

-- Remove malformed rows that still have no ProductID.
DELETE FROM PreOrderListing
WHERE ProductID IS NULL;

-- Keep one active listing per product per shop.
DELETE l1
FROM PreOrderListing l1
JOIN PreOrderListing l2
  ON l1.ShopID = l2.ShopID
 AND l1.ProductID = l2.ProductID
 AND l1.Active = TRUE
 AND l2.Active = TRUE
 AND l1.ListingID > l2.ListingID;

SET @fk_name := (
  SELECT kcu.CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
  WHERE kcu.TABLE_SCHEMA = DATABASE()
    AND kcu.TABLE_NAME = 'PreOrderListing'
    AND kcu.COLUMN_NAME = 'ProductID'
    AND kcu.REFERENCED_TABLE_NAME = 'ProductCatalog'
  LIMIT 1
);

SET @drop_fk_sql := IF(
  @fk_name IS NOT NULL,
  CONCAT('ALTER TABLE PreOrderListing DROP FOREIGN KEY ', @fk_name),
  'SELECT 1'
);
PREPARE stmt_drop_fk FROM @drop_fk_sql;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

ALTER TABLE PreOrderListing
MODIFY COLUMN ProductID INT NOT NULL;

ALTER TABLE PreOrderListing
ADD CONSTRAINT fk_preorderlisting_product
FOREIGN KEY (ProductID) REFERENCES ProductCatalog(ProductID) ON DELETE RESTRICT;

ALTER TABLE PreOrderListing
ADD UNIQUE INDEX uq_preorder_shop_product_active (ShopID, ProductID, Active);
