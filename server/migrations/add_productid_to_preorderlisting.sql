-- Migration: Add ProductID column to PreOrderListing table
-- This migration adds the ProductID column to support catalog-based preorders

ALTER TABLE PreOrderListing 
ADD COLUMN ProductID INT AFTER ItemID;

-- Add foreign key constraint
ALTER TABLE PreOrderListing 
ADD CONSTRAINT fk_preorder_product 
FOREIGN KEY (ProductID) REFERENCES ProductCatalog(ProductID) ON DELETE SET NULL;

-- Verify the migration
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'PreOrderListing' AND TABLE_SCHEMA = 'agromart'
ORDER BY ORDINAL_POSITION;
