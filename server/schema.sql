-- Agromart MySQL Schema
CREATE DATABASE IF NOT EXISTS agromart;
USE agromart;

-- Admin Table (Only one admin allowed)
CREATE TABLE IF NOT EXISTS Admin (
  AdminID INT AUTO_INCREMENT PRIMARY KEY UNIQUE,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  Phone VARCHAR(30),
  Address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Shop Table
CREATE TABLE IF NOT EXISTS Shop (
  ShopID INT AUTO_INCREMENT PRIMARY KEY,
  ShopName VARCHAR(100) NOT NULL,
  Review FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Farmer Table
CREATE TABLE IF NOT EXISTS Farmer (
  UserFarmerID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  Phone VARCHAR(30),
  Address VARCHAR(255),
  Bio TEXT,
  ShopName VARCHAR(100),
  CouponCode VARCHAR(50),
  ShopID INT,
  AdminID INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ShopID) REFERENCES Shop(ShopID) ON DELETE SET NULL,
  FOREIGN KEY (AdminID) REFERENCES Admin(AdminID) ON DELETE SET NULL
);

-- Customer Table
CREATE TABLE IF NOT EXISTS Customer (
  UserCustomerID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  Phone VARCHAR(30),
  Address VARCHAR(255),
  AdminID INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (AdminID) REFERENCES Admin(AdminID) ON DELETE SET NULL
);

-- DeliveryMan Table
CREATE TABLE IF NOT EXISTS DeliveryMan (
  UserDeliveryManID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL,
  Email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  Phone VARCHAR(30),
  Address VARCHAR(255),
  VehicleNo VARCHAR(50),
  Review FLOAT DEFAULT 0,
  TotalDeliveries INT DEFAULT 0,
  AdminID INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (AdminID) REFERENCES Admin(AdminID) ON DELETE SET NULL
);

-- Product Catalog Table (master list of items)
CREATE TABLE IF NOT EXISTS ProductCatalog (
  ProductID INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(100) NOT NULL UNIQUE,
  Category VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items Table
CREATE TABLE IF NOT EXISTS Items (
  ItemID INT AUTO_INCREMENT PRIMARY KEY,
  ProductID INT,
  Name VARCHAR(100) NOT NULL,
  Price DECIMAL(10,2) NOT NULL,
  Stock INT DEFAULT 0,
  Category VARCHAR(50),
  Fruits BOOLEAN DEFAULT FALSE,
  Vegetables BOOLEAN DEFAULT FALSE,
  Grains BOOLEAN DEFAULT FALSE,
  Meat BOOLEAN DEFAULT FALSE,
  ShopID INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ShopID) REFERENCES Shop(ShopID) ON DELETE CASCADE,
  FOREIGN KEY (ProductID) REFERENCES ProductCatalog(ProductID) ON DELETE SET NULL
);

-- Seed default catalog items
INSERT IGNORE INTO ProductCatalog (Name, Category) VALUES
  ('Apple', 'Fruits'),
  ('Mango', 'Fruits'),
  ('Watermelon', 'Fruits'),
  ('Banana', 'Fruits'),
  ('Coconut', 'Fruits'),
  ('Carrot', 'Vegetables'),
  ('Potato', 'Vegetables'),
  ('Cabbage', 'Vegetables'),
  ('Rice', 'Grains'),
  ('Lentil', 'Grains'),
  ('Flour', 'Grains'),
  ('Chicken', 'Meat'),
  ('Beef', 'Meat');

-- PreOrder Listings Table (created by farmer)
CREATE TABLE IF NOT EXISTS PreOrderListing (
  ListingID INT AUTO_INCREMENT PRIMARY KEY,
  ShopID INT NOT NULL,
  ItemID INT,
  ProductID INT NOT NULL,
  Category VARCHAR(50) NOT NULL DEFAULT 'Uncategorized',
  Price DECIMAL(10,2) NOT NULL,
  MaxQuantity INT NOT NULL,
  AcceptedQuantity INT DEFAULT 0,
  DeliveryMonth VARCHAR(20),
  Active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_preorder_shop_product_active (ShopID, ProductID, Active),
  FOREIGN KEY (ShopID) REFERENCES Shop(ShopID) ON DELETE CASCADE,
  FOREIGN KEY (ProductID) REFERENCES ProductCatalog(ProductID) ON DELETE RESTRICT
);

-- Order Table
CREATE TABLE IF NOT EXISTS `Order` (
  OrderID INT AUTO_INCREMENT PRIMARY KEY,
  UserCustomerID INT NOT NULL,
  TotalAmount DECIMAL(10,2) NOT NULL,
  CouponCode VARCHAR(50),
  PaymentMethod VARCHAR(50),
  PaymentStatus VARCHAR(50) DEFAULT 'Pending', -- Pending, Completed, Failed
  OrderDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  InvoiceDate DATETIME,
  InvoiceID VARCHAR(100),
  Status VARCHAR(50) DEFAULT 'Pending', -- Pending, Processing, Shipped, Delivered
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserCustomerID) REFERENCES Customer(UserCustomerID) ON DELETE CASCADE
);

-- Order Items (relationship between Order and Items)
CREATE TABLE IF NOT EXISTS OrderItems (
  OrderItemID INT AUTO_INCREMENT PRIMARY KEY,
  OrderID INT NOT NULL,
  ItemID INT NOT NULL,
  Quantity INT NOT NULL,
  PricePerUnit DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (OrderID) REFERENCES `Order`(OrderID) ON DELETE CASCADE,
  FOREIGN KEY (ItemID) REFERENCES Items(ItemID) ON DELETE CASCADE
);

-- Delivery Table
CREATE TABLE IF NOT EXISTS Delivery (
  DeliveryID INT AUTO_INCREMENT PRIMARY KEY,
  OrderID INT NOT NULL,
  UserDeliveryManID INT,
  PickedUpTime DATETIME,
  Status VARCHAR(50) DEFAULT 'Pending', -- Pending, In Transit, Delivered
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (OrderID) REFERENCES `Order`(OrderID) ON DELETE CASCADE,
  FOREIGN KEY (UserDeliveryManID) REFERENCES DeliveryMan(UserDeliveryManID) ON DELETE SET NULL
);

-- PreOrderRequest Table
CREATE TABLE IF NOT EXISTS PreOrderRequest (
  PreOrderID INT AUTO_INCREMENT PRIMARY KEY,
  ListingID INT,
  UserFarmerID INT NOT NULL,
  UserCustomerID INT NOT NULL,
  ItemID INT,
  ProductID INT,
  ProposedPrice DECIMAL(10,2) NOT NULL,
  Quantity INT NOT NULL,
  DeliveryMonth VARCHAR(20),
  Status VARCHAR(50) DEFAULT 'Pending', -- Pending, Accepted, Rejected, Completed
  RequestDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ListingID) REFERENCES PreOrderListing(ListingID) ON DELETE SET NULL,
  FOREIGN KEY (UserFarmerID) REFERENCES Farmer(UserFarmerID) ON DELETE CASCADE,
  FOREIGN KEY (UserCustomerID) REFERENCES Customer(UserCustomerID) ON DELETE CASCADE,
  FOREIGN KEY (ProductID) REFERENCES ProductCatalog(ProductID) ON DELETE SET NULL
);

-- Farmer Review Table
CREATE TABLE IF NOT EXISTS FarmerReview (
  ReviewID INT AUTO_INCREMENT PRIMARY KEY,
  UserFarmerID INT NOT NULL,
  UserCustomerID INT NOT NULL,
  Rating INT NOT NULL CHECK(Rating >= 1 AND Rating <= 5),
  Comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserFarmerID) REFERENCES Farmer(UserFarmerID) ON DELETE CASCADE,
  FOREIGN KEY (UserCustomerID) REFERENCES Customer(UserCustomerID) ON DELETE CASCADE
);

-- Cleanup items + shop when farmer is deleted
DELIMITER $$
CREATE TRIGGER trg_farmer_delete
BEFORE DELETE ON Farmer
FOR EACH ROW
BEGIN
  DELETE FROM Items WHERE ShopID = OLD.ShopID;
  DELETE FROM Shop WHERE ShopID = OLD.ShopID;
END$$

-- Update Shop review average on new review
CREATE TRIGGER trg_review_insert
AFTER INSERT ON FarmerReview
FOR EACH ROW
BEGIN
  DECLARE shop_id INT;
  DECLARE avg_rating FLOAT;

  SELECT ShopID INTO shop_id FROM Farmer WHERE UserFarmerID = NEW.UserFarmerID;
  SELECT AVG(Rating) INTO avg_rating FROM FarmerReview WHERE UserFarmerID = NEW.UserFarmerID;
  
  IF shop_id IS NOT NULL THEN
    UPDATE Shop SET Review = avg_rating WHERE ShopID = shop_id;
  END IF;
END$$

DELIMITER ;
