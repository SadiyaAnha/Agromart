-- Migration: add server-side Cart table to support auto-adding accepted preorders
USE agromart;

CREATE TABLE IF NOT EXISTS Cart (
  CartID INT AUTO_INCREMENT PRIMARY KEY,
  UserCustomerID INT NOT NULL,
  ItemID INT,
  ProductID INT,
  Quantity INT NOT NULL,
  PricePerUnit DECIMAL(10,2) NOT NULL,
  ShopID INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserCustomerID) REFERENCES Customer(UserCustomerID) ON DELETE CASCADE,
  FOREIGN KEY (ItemID) REFERENCES Items(ItemID) ON DELETE SET NULL,
  FOREIGN KEY (ProductID) REFERENCES ProductCatalog(ProductID) ON DELETE SET NULL,
  FOREIGN KEY (ShopID) REFERENCES Shop(ShopID) ON DELETE SET NULL
);

-- Optional index to find customer's cart quickly
CREATE INDEX IF NOT EXISTS idx_cart_user ON Cart(UserCustomerID);
