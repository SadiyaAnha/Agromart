-- Migration: remove the old combined Items.FruitsVegetables column after splitting into Fruits and Vegetables
USE agromart;

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Items'
    AND COLUMN_NAME = 'FruitsVegetables'
);

SET @sql := IF(@column_exists > 0,
  'ALTER TABLE Items DROP COLUMN FruitsVegetables',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
