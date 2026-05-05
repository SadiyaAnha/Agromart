-- Update_schema.sql
-- Run this script in phpMyAdmin or your MySQL client

-- 1. Modify OrderItems to support preorders (ListingID)
ALTER TABLE OrderItems MODIFY ItemID INT NULL;
ALTER TABLE OrderItems ADD COLUMN ListingID INT NULL;
ALTER TABLE OrderItems ADD FOREIGN KEY (ListingID) REFERENCES PreOrderListing(ListingID) ON DELETE SET NULL;

-- 2. Drop unnecessary ItemID columns from preorder tables
ALTER TABLE PreOrderListing DROP COLUMN ItemID;
ALTER TABLE PreOrderRequest DROP COLUMN ItemID;
