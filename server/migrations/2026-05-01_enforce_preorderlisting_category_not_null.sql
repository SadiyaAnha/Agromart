-- Migration: enforce non-null category for PreOrderListing and auto-fill it
USE agromart;

-- Backfill existing rows from the strongest available source.
UPDATE PreOrderListing p
SET p.Category = COALESCE(
  NULLIF(p.Category, ''),
  (SELECT pc.Category FROM ProductCatalog pc WHERE pc.ProductID = p.ProductID LIMIT 1),
  (SELECT i.Category FROM Items i WHERE i.ItemID = p.ItemID LIMIT 1),
  (SELECT i2.Category
     FROM ProductCatalog pc
     JOIN Items i2 ON LOWER(i2.Name) = LOWER(pc.Name)
    WHERE pc.ProductID = p.ProductID
    ORDER BY i2.ItemID DESC
    LIMIT 1),
  'Uncategorized'
)
WHERE p.Category IS NULL OR p.Category = '';

-- Make sure the column cannot stay null going forward.
ALTER TABLE PreOrderListing
  MODIFY COLUMN Category VARCHAR(50) NOT NULL DEFAULT 'Uncategorized';

DELIMITER $$
DROP TRIGGER IF EXISTS trg_preorderlisting_category_before_insert$$
CREATE TRIGGER trg_preorderlisting_category_before_insert
BEFORE INSERT ON PreOrderListing
FOR EACH ROW
BEGIN
  DECLARE resolved_category VARCHAR(50) DEFAULT NULL;

  IF NEW.Category IS NOT NULL AND NEW.Category <> '' THEN
    SET resolved_category = NEW.Category;
  ELSE
    IF NEW.ProductID IS NOT NULL THEN
      SELECT pc.Category
        INTO resolved_category
        FROM ProductCatalog pc
       WHERE pc.ProductID = NEW.ProductID
       LIMIT 1;
    END IF;

    IF (resolved_category IS NULL OR resolved_category = '') AND NEW.ItemID IS NOT NULL THEN
      SELECT i.Category
        INTO resolved_category
        FROM Items i
       WHERE i.ItemID = NEW.ItemID
       LIMIT 1;
    END IF;

    IF (resolved_category IS NULL OR resolved_category = '') AND NEW.ProductID IS NOT NULL THEN
      SELECT i2.Category
        INTO resolved_category
        FROM ProductCatalog pc
        JOIN Items i2 ON LOWER(i2.Name) = LOWER(pc.Name)
       WHERE pc.ProductID = NEW.ProductID
       ORDER BY i2.ItemID DESC
       LIMIT 1;
    END IF;

    SET NEW.Category = COALESCE(NULLIF(resolved_category, ''), 'Uncategorized');
  END IF;
END$$
DELIMITER ;

DELIMITER $$
DROP TRIGGER IF EXISTS trg_preorderlisting_category_before_update$$
CREATE TRIGGER trg_preorderlisting_category_before_update
BEFORE UPDATE ON PreOrderListing
FOR EACH ROW
BEGIN
  DECLARE resolved_category VARCHAR(50) DEFAULT NULL;

  IF NEW.Category IS NOT NULL AND NEW.Category <> '' THEN
    SET resolved_category = NEW.Category;
  ELSE
    IF NEW.ProductID IS NOT NULL THEN
      SELECT pc.Category
        INTO resolved_category
        FROM ProductCatalog pc
       WHERE pc.ProductID = NEW.ProductID
       LIMIT 1;
    END IF;

    IF (resolved_category IS NULL OR resolved_category = '') AND NEW.ItemID IS NOT NULL THEN
      SELECT i.Category
        INTO resolved_category
        FROM Items i
       WHERE i.ItemID = NEW.ItemID
       LIMIT 1;
    END IF;

    IF (resolved_category IS NULL OR resolved_category = '') AND NEW.ProductID IS NOT NULL THEN
      SELECT i2.Category
        INTO resolved_category
        FROM ProductCatalog pc
        JOIN Items i2 ON LOWER(i2.Name) = LOWER(pc.Name)
       WHERE pc.ProductID = NEW.ProductID
       ORDER BY i2.ItemID DESC
       LIMIT 1;
    END IF;

    SET NEW.Category = COALESCE(NULLIF(resolved_category, ''), 'Uncategorized');
  END IF;
END$$
DELIMITER ;
