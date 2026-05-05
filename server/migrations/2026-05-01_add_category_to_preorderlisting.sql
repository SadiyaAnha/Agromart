-- Migration: add Category column to PreOrderListing and backfill from ProductCatalog or Items
USE agromart;

ALTER TABLE PreOrderListing
  ADD COLUMN IF NOT EXISTS Category VARCHAR(50) DEFAULT NULL;

-- Backfill Category from ProductCatalog when ProductID is present
UPDATE PreOrderListing p
JOIN ProductCatalog pc ON p.ProductID = pc.ProductID
SET p.Category = pc.Category
WHERE p.ProductID IS NOT NULL AND (p.Category IS NULL OR p.Category = '');

-- Backfill Category from Items when ItemID is present and ProductID missing
UPDATE PreOrderListing p
JOIN Items i ON p.ItemID = i.ItemID
SET p.Category = i.Category
WHERE (p.Category IS NULL OR p.Category = '') AND p.ItemID IS NOT NULL;
