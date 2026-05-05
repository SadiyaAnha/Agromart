-- Create Cart table with proper relationships
CREATE TABLE IF NOT EXISTS Cart (
  CartID INT AUTO_INCREMENT PRIMARY KEY,
  UserCustomerID INT NOT NULL,
  PreOrderRequestID INT,
  ItemID INT,
  Quantity INT NOT NULL DEFAULT 1,
  PricePerUnit DECIMAL(10,2),
  ShopID INT,
  AddedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Foreign Keys
  FOREIGN KEY (UserCustomerID) REFERENCES Customer(UserCustomerID) ON DELETE CASCADE,
  FOREIGN KEY (PreOrderRequestID) REFERENCES PreOrderRequest(PreOrderID) ON DELETE CASCADE,
  FOREIGN KEY (ItemID) REFERENCES Items(ItemID) ON DELETE CASCADE,
  FOREIGN KEY (ShopID) REFERENCES Shop(ShopID) ON DELETE SET NULL,
  
  -- Indexes for performance
  INDEX idx_cart_customer (UserCustomerID),
  INDEX idx_cart_request (PreOrderRequestID),
  INDEX idx_cart_item (ItemID)
);

-- Add AcceptedQuantity column to PreOrderListing to track reserved quantity
ALTER TABLE preorderlisting 
  ADD COLUMN IF NOT EXISTS AcceptedQuantity INT DEFAULT 0;

-- Add Status column to PreOrderListing (optional, for tracking)
ALTER TABLE preorderlisting 
  ADD COLUMN IF NOT EXISTS Status VARCHAR(50) DEFAULT 'Active';
