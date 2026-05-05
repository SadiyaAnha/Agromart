-- Migration: split Items.FruitsVegetables into separate Fruits and Vegetables columns
USE agromart;

ALTER TABLE Items
  ADD COLUMN IF NOT EXISTS Fruits BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS Vegetables BOOLEAN DEFAULT FALSE;

UPDATE Items
SET
  Fruits = CASE
    WHEN Category = 'Fruits' THEN TRUE
    ELSE Fruits
  END,
  Vegetables = CASE
    WHEN Category = 'Vegetables' THEN TRUE
    ELSE Vegetables
  END;

-- If the old combined column exists, you can drop it after confirming the app works.
-- ALTER TABLE Items DROP COLUMN FruitsVegetables;
