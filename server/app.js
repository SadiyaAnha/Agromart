const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Agromart API is running');
});

// ===== FARMER SIGNUP =====
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, phone, address, bio, shopName, userType } = req.body;
  try {
    // Check if email already exists
    let table = userType === 'seller' ? 'Farmer' : 'Customer';
    const [existing] = await pool.query(`SELECT * FROM ${table} WHERE email = ?`, [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });

    // Create shop if seller
    let shopId = null;
    if (userType === 'seller') {
      const [shopResult] = await pool.query('INSERT INTO Shop (ShopName) VALUES (?)', [shopName]);
      shopId = shopResult.insertId;
    }

    // Insert user
    if (userType === 'seller') {
      const [result] = await pool.query(
        'INSERT INTO Farmer (Name, email, password, phone, address, bio, ShopID, ShopName) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [name, email, password, phone, address, bio, shopId, shopName]
      );
      res.json({ id: result.insertId, name, email, userType, shopName, shopId, phone, address, bio });
    } else {
      const [result] = await pool.query(
        'INSERT INTO Customer (Name, email, password, phone, address) VALUES (?, ?, ?, ?, ?)',
        [name, email, password, phone, address]
      );
      res.json({ id: result.insertId, name, email, userType, phone, address });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== FARMER LOGIN =====
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // Check Farmer first (seller)
    const [farmers] = await pool.query(
      `SELECT f.*, s.ShopName AS ShopName
       FROM Farmer f
       LEFT JOIN Shop s ON f.ShopID = s.ShopID
       WHERE f.email = ? AND f.password = ?`,
      [email, password]
    );
    if (farmers.length > 0) {
      const farmer = farmers[0];
      return res.json({ 
        id: farmer.UserFarmerID, 
        name: farmer.Name, 
        email: farmer.Email, 
        userType: 'seller', 
        shopName: farmer.ShopName,
        shopId: farmer.ShopID,
        phone: farmer.Phone,
        address: farmer.Address,
        bio: farmer.Bio
      });
    }

    // Check Customer
    const [customers] = await pool.query('SELECT * FROM Customer WHERE email = ? AND password = ?', [email, password]);
    if (customers.length > 0) {
      const customer = customers[0];
      return res.json({ 
        id: customer.UserCustomerID, 
        name: customer.Name, 
        email: customer.Email, 
        userType: 'buyer',
        phone: customer.Phone,
        address: customer.Address
      });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET ALL FARMERS/SELLERS =====
app.get('/api/sellers', async (req, res) => {
  try {
    const [sellers] = await pool.query(
      `SELECT f.UserFarmerID as id, f.Name as name, COALESCE(f.ShopName, s.ShopName) as shopName,
              f.Bio as bio, f.Address as address, f.Phone as phone, f.CouponCode as couponCode,
              (SELECT AVG(Rating) FROM FarmerReview WHERE UserFarmerID = f.UserFarmerID) as reviewRating
       FROM Farmer f 
       LEFT JOIN Shop s ON f.ShopID = s.ShopID`
    );
    res.json(sellers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET FARMER PROFILE =====
app.get('/api/farmers/:farmerId', async (req, res) => {
  const { farmerId } = req.params;
  try {
    const [farmers] = await pool.query(
      `SELECT f.UserFarmerID as id, f.Name as name, f.Bio as bio, f.Phone as phone,
              COALESCE(f.ShopName, s.ShopName) as shopName, f.ShopID as shopId,
              f.CouponCode as couponCode, 
              (SELECT AVG(Rating) FROM FarmerReview WHERE UserFarmerID = f.UserFarmerID) as reviewRating,
              (SELECT COALESCE(SUM(oi.Quantity * oi.PricePerUnit), 0)
               FROM OrderItems oi
               JOIN Items i ON oi.ItemID = i.ItemID
               JOIN \`Order\` o ON oi.OrderID = o.OrderID
               WHERE i.ShopID = f.ShopID) as totalEarnings
       FROM Farmer f
       LEFT JOIN Shop s ON f.ShopID = s.ShopID
       WHERE f.UserFarmerID = ?`,
      [farmerId]
    );

    if (farmers.length === 0) return res.status(404).json({ error: 'Farmer not found' });
    res.json(farmers[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== UPDATE FARMER COUPON =====
app.put('/api/farmers/:farmerId/coupon', async (req, res) => {
  const { farmerId } = req.params;
  const { couponCode } = req.body;
  try {
    await pool.query('UPDATE Farmer SET CouponCode = ? WHERE UserFarmerID = ?', [couponCode || null, farmerId]);
    res.json({ success: true, couponCode: couponCode || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADD FARMER REVIEW =====
app.post('/api/farmers/:farmerId/reviews', async (req, res) => {
  const { farmerId } = req.params;
  const { customerId, rating, comment } = req.body;
  try {
    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    await pool.query(
      'INSERT INTO FarmerReview (UserFarmerID, UserCustomerID, Rating, Comment) VALUES (?, ?, ?, ?)',
      [farmerId, customerId, parsedRating, comment || null]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET FARMER REVIEWS =====
app.get('/api/farmers/:farmerId/reviews', async (req, res) => {
  const { farmerId } = req.params;
  try {
    const [reviews] = await pool.query(
      `SELECT r.ReviewID as id, r.Rating as rating, r.Comment as comment, r.created_at as createdAt,
              c.Name as customerName
       FROM FarmerReview r
       JOIN Customer c ON r.UserCustomerID = c.UserCustomerID
       WHERE r.UserFarmerID = ?
       ORDER BY r.created_at DESC`,
      [farmerId]
    );
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET SHOP ITEMS FOR A FARMER =====
app.get('/api/shops/:sellerId/items', async (req, res) => {
  const { sellerId } = req.params;
  console.log('=== /api/shops/:sellerId/items ===');
  console.log('sellerId received:', sellerId);
  
  try {
    // Get farmer with their ShopID
    const [farmer] = await pool.query(
      'SELECT UserFarmerID, ShopID FROM Farmer WHERE UserFarmerID = ?', 
      [Number(sellerId)]
    );
    
    console.log('Farmer query result:', farmer);
    
    if (!farmer || farmer.length === 0) {
      console.log('Farmer not found');
      return res.json([]);
    }
    
    const shopId = farmer[0].ShopID;
    console.log('ShopID:', shopId);
    
    if (!shopId) {
      console.log('Farmer has no ShopID, returning empty array');
      return res.json([]);
    }
    
    // Get items for this shop - only select columns that exist
    const [items] = await pool.query(
      `SELECT ItemID as id, Name as name, Price as price, Stock as stock, Category as category
       FROM Items
       WHERE ShopID = ? AND LOWER(TRIM(Name)) <> 'preorder item'`,
      [shopId]
    );
    
    console.log('Items found:', items ? items.length : 0);
    console.log('Items:', items);
    
    if (!items || items.length === 0) {
      return res.json([]);
    }
    
    res.json(items);
  } catch (err) {
    console.error('Error in /api/shops/:sellerId/items:', err.message);
    res.json([]);
  }
});

// ===== GET PRODUCT CATALOG =====
app.get('/api/catalog', async (req, res) => {
  try {
    const [items] = await pool.query(
      'SELECT ProductID as id, Name as name, Category as category FROM ProductCatalog ORDER BY Category, Name'
    );
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET ALL MARKETPLACE ITEMS =====
app.get('/api/items', async (req, res) => {
  try {
    const [items] = await pool.query(
      `SELECT i.ItemID as id, i.Name as name, i.Price as price, i.Stock as stock, i.Category as category,
              s.ShopName as shopName, s.ShopID as shopId, f.Name as farmerName,
              f.UserFarmerID as farmerId
       FROM Items i
       JOIN Shop s ON i.ShopID = s.ShopID
       LEFT JOIN Farmer f ON f.ShopID = s.ShopID
       WHERE LOWER(TRIM(i.Name)) <> 'preorder item'`
    );

    // Ensure category is set, fallback to 'Other' when missing
    const formattedItems = items.map(item => ({
      ...item,
      category: item.category || 'Other'
    }));

    res.json(formattedItems);
  } catch (err) {
    console.error('Error in /api/items:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===== GET SHOP COUPON =====
app.get('/api/shops/:shopId/coupon', async (req, res) => {
  const { shopId } = req.params;
  try {
    const [rows] = await pool.query('SELECT CouponCode as couponCode FROM Farmer WHERE ShopID = ?', [shopId]);
    if (rows.length === 0) return res.json({ couponCode: null });
    res.json({ couponCode: rows[0].couponCode || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ADD ITEM TO FARMER'S SHOP =====
app.post('/api/shops/:sellerId/items', async (req, res) => {
  const { sellerId } = req.params;
  const { name, category, price, stock, productId } = req.body;
  try {
    // Get farmer's shop
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    let resolvedName = name;
    let resolvedCategory = category;
    let resolvedProductId = productId || null;

    if (resolvedProductId) {
      const [catalogRows] = await pool.query(
        'SELECT ProductID, Name, Category FROM ProductCatalog WHERE ProductID = ?',
        [resolvedProductId]
      );
      if (catalogRows.length === 0) {
        return res.status(400).json({ error: 'Invalid catalog item.' });
      }
      resolvedName = catalogRows[0].Name;
      resolvedCategory = catalogRows[0].Category;
      resolvedProductId = catalogRows[0].ProductID;
    }

    // Map category string to boolean columns
    let fruits = false, vegetables = false, grains = false, meat = false;
    if (resolvedCategory === 'Fruits') {
      fruits = true;
    } else if (resolvedCategory === 'Vegetables') {
      vegetables = true;
    } else if (resolvedCategory === 'Grains') {
      grains = true;
    } else if (resolvedCategory === 'Meat') {
      meat = true;
    }

    const normalizedStock = Number.isFinite(Number(stock)) ? Number(stock) : 0;

    const [result] = await pool.query(
      'INSERT INTO Items (ProductID, Name, price, Stock, ShopID, Category, Fruits, Vegetables, Grains, Meat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [resolvedProductId, resolvedName, price, normalizedStock, farmer[0].ShopID, resolvedCategory, fruits, vegetables, grains, meat]
    );
    res.json({ 
      id: result.insertId, 
      name: resolvedName, 
      category: resolvedCategory,
      price, 
      stock: normalizedStock,
      shopId: farmer[0].ShopID,
      productId: resolvedProductId,
      fruits,
      vegetables,
      grains,
      meat
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== REMOVE ITEM FROM FARMER'S SHOP =====
app.delete('/api/shops/:sellerId/items/:itemId', async (req, res) => {
  const { sellerId, itemId } = req.params;
  try {
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    await pool.query('DELETE FROM Items WHERE ItemID = ? AND ShopID = ?', [itemId, farmer[0].ShopID]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== UPDATE ITEM FOR FARMER'S SHOP =====
app.put('/api/shops/:sellerId/items/:itemId', async (req, res) => {
  const { sellerId, itemId } = req.params;
  const { price, stock } = req.body;
  try {
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    const normalizedStock = Number.isFinite(Number(stock)) ? Number(stock) : 0;

    await pool.query(
      'UPDATE Items SET Price = ?, Stock = ? WHERE ItemID = ? AND ShopID = ?',
      [price, normalizedStock, itemId, farmer[0].ShopID]
    );

    if (normalizedStock <= 0) {
      await pool.query('DELETE FROM Items WHERE ItemID = ? AND ShopID = ?', [itemId, farmer[0].ShopID]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE ORDER =====
app.post('/api/orders', async (req, res) => {
  const { customerId, items, couponCode, paymentMethod } = req.body;
  try {
    if (!customerId) {
      return res.status(400).json({ error: 'Customer is required' });
    }

    const safeItems = Array.isArray(items) ? items : [];
    const itemIds = safeItems.map((item) => Number(item.itemId)).filter((id) => Number.isFinite(id));

    let dbItems = [];
    if (itemIds.length > 0) {
      const [rows] = await pool.query(
        `SELECT ItemID, Price, ShopID FROM Items WHERE ItemID IN (${itemIds.map(() => '?').join(',')})`,
        itemIds
      );
      dbItems = rows;
    }

    const [preorderCartRows] = await pool.query(
      `SELECT c.CartID, c.PreOrderRequestID, c.ItemID, c.Quantity, c.PricePerUnit,
              pr.ListingID, pr.Status as requestStatus, 
              l.ShopID as listingShopID, l.MaxQuantity
       FROM Cart c
       JOIN PreOrderRequest pr ON c.PreOrderRequestID = pr.PreOrderID
       LEFT JOIN PreOrderListing l ON pr.ListingID = l.ListingID
       WHERE c.UserCustomerID = ? AND c.PreOrderRequestID IS NOT NULL AND pr.Status = 'AwaitingCheckout'`,
      [customerId]
    );

    if (safeItems.length === 0 && preorderCartRows.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    const priceMap = new Map(dbItems.map((row) => [row.ItemID, Number(row.Price)]));
    const shopIds = new Set(dbItems.map((row) => row.ShopID).filter(Boolean));
    preorderCartRows.forEach((row) => {
      if (row.listingShopID) shopIds.add(row.listingShopID);
    });

    if (shopIds.size > 1) {
      return res.status(400).json({ error: 'Orders must be from one shop only' });
    }

    let subtotal = 0;

    const orderLines = safeItems.map((item) => {
      const itemId = Number(item.itemId);
      const quantity = Number(item.quantity) || 1;
      const price = priceMap.get(itemId);
      if (!price) {
        throw new Error('One or more items no longer exist');
      }
      subtotal += price * quantity;
      return { itemId, quantity, price };
    });

    const preorderOrderLines = preorderCartRows.map((row) => {
      const quantity = Number(row.Quantity) || 1;
      const price = Number(row.PricePerUnit || 0);
      subtotal += price * quantity;
      return {
        cartId: row.CartID,
        preOrderRequestId: row.PreOrderRequestID,
        listingId: row.ListingID,
        requestStatus: row.requestStatus,
        itemId: row.ItemID ||  null,
        quantity,
        price,
        maxQuantity: Number(row.MaxQuantity)
      };
    });

    const deliveryFee = 60;
    let totalAmount = subtotal + deliveryFee;
    let discountApplied = false;

    if (couponCode && shopIds.size === 1) {
      const shopId = Array.from(shopIds)[0];
      const [farmers] = await pool.query('SELECT CouponCode FROM Farmer WHERE ShopID = ?', [shopId]);
      const savedCoupon = farmers.length > 0 ? farmers[0].CouponCode : null;
      if (savedCoupon && savedCoupon.toLowerCase() === String(couponCode).trim().toLowerCase()) {
        totalAmount = Number((totalAmount * 0.9).toFixed(2));
        discountApplied = true;
      }
    }

    const [orderResult] = await pool.query(
      'INSERT INTO `Order` (UserCustomerID, TotalAmount, CouponCode, PaymentMethod, PaymentStatus, Status) VALUES (?, ?, ?, ?, ?, ?)',
      [customerId, totalAmount, couponCode || null, paymentMethod || null, 'Pending', 'Pending']
    );

    const orderId = orderResult.insertId;

    // Set InvoiceID = OrderID and InvoiceDate = created_at (now)
    await pool.query(
      'UPDATE `Order` SET InvoiceID = ?, InvoiceDate = NOW() WHERE OrderID = ?',
      [String(orderId), orderId]
    );

    // Process regular cart items
    for (const line of orderLines) {
      await pool.query(
        'INSERT INTO OrderItems (OrderID, ItemID, Quantity, PricePerUnit) VALUES (?, ?, ?, ?)',
        [orderId, line.itemId, line.quantity, line.price]
      );

      // Deduct stock for the item
      await pool.query(
        'UPDATE Items SET Stock = GREATEST(0, Stock - ?) WHERE ItemID = ?',
        [line.quantity, line.itemId]
      );

      // Delete if stock is 0
      await pool.query(
        'DELETE FROM Items WHERE ItemID = ? AND Stock <= 0',
        [line.itemId]
      );

      // Delete regular items from cart after checkout
      await pool.query(
        'DELETE FROM Cart WHERE UserCustomerID = ? AND ItemID = ? AND PreOrderRequestID IS NULL',
        [customerId, line.itemId]
      );
    }

    // Finalize preorder requests at checkout:
    // 1) Deduct listing quantity only when customer places order
    // 2) Insert order lines when ItemID is available
    // 3) Mark preorder requests completed
    // 4) Remove preorder rows from cart
    for (const line of preorderOrderLines) {
      if (String(line.requestStatus).toLowerCase() !== 'awaitingcheckout') {
        continue;
      }

      if (line.listingId) {
        const [updateResult] = await pool.query(
          `UPDATE PreOrderListing
           SET MaxQuantity = MaxQuantity - ?
           WHERE ListingID = ? AND MaxQuantity >= ?`,
          [line.quantity, line.listingId, line.quantity]
        );

        if (updateResult.affectedRows === 0) {
          return res.status(400).json({ error: 'Not enough preorder quantity available at checkout' });
        }

        // Delete if max quantity is 0
        await pool.query(
          'DELETE FROM PreOrderListing WHERE ListingID = ? AND MaxQuantity <= 0',
          [line.listingId]
        );
      }

      // Insert preorder into OrderItems using ListingID
      if (line.listingId) {
        await pool.query(
          'INSERT INTO OrderItems (OrderID, ItemID, ListingID, Quantity, PricePerUnit) VALUES (?, NULL, ?, ?, ?)',
          [orderId, line.listingId, line.quantity, line.price]
        );
      }

      await pool.query('UPDATE PreOrderRequest SET Status = ? WHERE PreOrderID = ?', ['Completed', line.preOrderRequestId]);
      await pool.query('DELETE FROM Cart WHERE CartID = ?', [line.cartId]);
    }

    res.json({ id: orderId, totalAmount, subtotal, deliveryFee, discountApplied });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PREORDER LISTINGS (FARMER) =====
app.get('/api/shops/:sellerId/preorder-listings', async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    const [listings] = await pool.query(
      `SELECT l.ListingID as id, l.ProductID as productId,
              COALESCE(pc.Name, i.Name) as itemName,
              COALESCE(l.Category, pc.Category, i.Category, i2.Category) as category,
              l.Price as price, l.MaxQuantity as maxQuantity,
              l.DeliveryMonth as deliveryMonth, l.Active as active
       FROM PreOrderListing l
       LEFT JOIN ProductCatalog pc ON l.ProductID = pc.ProductID
       LEFT JOIN Items i ON pc.Name = i.Name
       LEFT JOIN Items i2 ON i2.Name = pc.Name
       WHERE l.ShopID = ? AND l.Active = TRUE`,
      [farmer[0].ShopID]
    );

    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PUBLIC: GET ALL ACTIVE PREORDER LISTINGS =====
app.get('/api/preorder-listings', async (req, res) => {
  try {
    const [listings] = await pool.query(
      `SELECT l.ListingID as id, l.ShopID as shopId, l.ProductID as productId,
              COALESCE(pc.Name, i.Name) as itemName,
        COALESCE(l.Category, pc.Category, i.Category, i2.Category) as category,
              l.Price as price, l.MaxQuantity as maxQuantity, l.DeliveryMonth as deliveryMonth,
              f.UserFarmerID as farmerId, f.Name as farmerName, s.ShopName as shopName
       FROM PreOrderListing l
       LEFT JOIN ProductCatalog pc ON l.ProductID = pc.ProductID
       LEFT JOIN Items i ON pc.Name = i.Name
      LEFT JOIN Items i2 ON i2.Name = pc.Name
       LEFT JOIN Shop s ON l.ShopID = s.ShopID
       LEFT JOIN Farmer f ON s.ShopID = f.ShopID
       WHERE l.Active = TRUE
       ORDER BY l.created_at DESC`
    );
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/shops/:sellerId/preorder-listings', async (req, res) => {
  const { sellerId } = req.params;
  const { price, maxQuantity, deliveryMonth, productId } = req.body;
  try {
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    let resolvedProductId = Number.isFinite(Number(productId)) && Number(productId) > 0 ? Number(productId) : null;
    if (!resolvedProductId) {
      return res.status(400).json({ error: 'Product selection is required' });
    }

    const [catalogRows] = await pool.query(
      'SELECT ProductID, Name, Category FROM ProductCatalog WHERE ProductID = ?',
      [resolvedProductId]
    );
    if (catalogRows.length === 0) return res.status(404).json({ error: 'Catalog item not found' });

    const [existingListing] = await pool.query(
      'SELECT ListingID FROM PreOrderListing WHERE ShopID = ? AND ProductID = ? AND Active = TRUE LIMIT 1',
      [farmer[0].ShopID, resolvedProductId]
    );
    if (existingListing.length > 0) {
      return res.status(409).json({ error: 'This product already has an active preorder listing.' });
    }

    // category set from catalog
    let resolvedCategory = catalogRows[0].Category || null;

    if (!resolvedCategory) {
      const [itemFallback] = await pool.query(
        'SELECT Category FROM Items WHERE LOWER(Name) = LOWER(?) LIMIT 1',
        [catalogRows[0].Name]
      );
      if (itemFallback.length > 0) {
        resolvedCategory = itemFallback[0].Category || null;
      }
    }

    const [result] = await pool.query(
      'INSERT INTO PreOrderListing (ShopID, ProductID, Category, Price, MaxQuantity, DeliveryMonth, Active) VALUES (?, ?, ?, ?, ?, ?, TRUE)',
      [farmer[0].ShopID, resolvedProductId, resolvedCategory || 'Uncategorized', price, maxQuantity, deliveryMonth || null]
    );

    res.json({
      id: result.insertId,
      itemId: null,
      productId: resolvedProductId,
      itemName: catalogRows[0].Name,
      category: resolvedCategory,
      price,
      maxQuantity,
      deliveryMonth,
      active: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PREORDER REQUESTS (CUSTOMER) =====
app.post('/api/preorder-requests', async (req, res) => {
  const { sellerId, customerId, listingId, proposedPrice, quantity, deliveryMonth, productId } = req.body;
  try {
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    const [listing] = await pool.query(
      'SELECT ListingID, MaxQuantity, Price, DeliveryMonth, ProductID FROM PreOrderListing WHERE ListingID = ? AND ShopID = ? AND Active = TRUE',
      [listingId, farmer[0].ShopID]
    );
    if (listing.length === 0) return res.status(404).json({ error: 'Listing not available' });

    if (Number(quantity) > Number(listing[0].MaxQuantity)) {
      return res.status(400).json({ error: 'Requested quantity exceeds available preorder amount' });
    }

    // Treat proposedPrice as the TOTAL the customer is willing to pay for the quantity.
    // Validate that the total is within +/- 100 of (listing.Price * quantity)
    const expectedTotal = Number(listing[0].Price) * Number(quantity);
    const totalDelta = Math.abs(Number(proposedPrice) - expectedTotal);
    if (!Number.isFinite(totalDelta) || totalDelta > 100) {
      return res.status(400).json({ error: 'Proposed total must be within 100 of the listed total price' });
    }

    const [result] = await pool.query(
      `INSERT INTO PreOrderRequest (UserFarmerID, UserCustomerID, ListingID, ProductID, ProposedPrice, Quantity, DeliveryMonth)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        sellerId,
        customerId,
        listing[0].ListingID || null,
        listing[0].ProductID || null,
        proposedPrice,
        quantity,
        deliveryMonth || listing[0].DeliveryMonth || null
      ]
    );

    res.json({ id: result.insertId, status: 'Pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== PREORDER REQUESTS (FARMER VIEW + UPDATE) =====
app.get('/api/shops/:sellerId/preorder-requests', async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [requests] = await pool.query(
      `SELECT r.PreOrderID as id,
              COALESCE(i.Name, pc.Name) as itemName,
              r.Quantity as quantity, r.ProposedPrice as proposedPrice,
              r.DeliveryMonth as deliveryMonth, r.Status as status, c.Name as customerName
       FROM PreOrderRequest r
       LEFT JOIN PreOrderListing l ON r.ListingID = l.ListingID
       LEFT JOIN ProductCatalog pc ON COALESCE(r.ProductID, l.ProductID) = pc.ProductID
       LEFT JOIN Items i ON i.Name = pc.Name
       JOIN Customer c ON r.UserCustomerID = c.UserCustomerID
       WHERE r.UserFarmerID = ? AND r.Status <> 'Archived'
       ORDER BY r.RequestDate DESC`,
      [sellerId]
    );

    const normalizedRequests = requests.map((row) => ({
      ...row,
      productId: null,
      itemName: row.itemName || 'Unnamed Item'
    }));

    res.json(normalizedRequests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/shops/:sellerId/preorder-requests/:requestId', async (req, res) => {
  const { sellerId, requestId } = req.params;
  const { status } = req.body;
  try {
    const [request] = await pool.query(
      'SELECT PreOrderID FROM PreOrderRequest WHERE PreOrderID = ? AND UserFarmerID = ?',
      [requestId, sellerId]
    );
    if (request.length === 0) return res.status(404).json({ error: 'Preorder request not found' });

    const normalizedStatus = String(status).toLowerCase();

    // Fetch full request details for logic below
    const [reqRows] = await pool.query('SELECT * FROM PreOrderRequest WHERE PreOrderID = ?', [requestId]);
    if (reqRows.length === 0) return res.status(404).json({ error: 'Request not found' });
    
    const r = reqRows[0];
    const customerId = r.UserCustomerID;
    const quantity = Number(r.Quantity) || 1;

    // Update request status
    await pool.query('UPDATE PreOrderRequest SET Status = ? WHERE PreOrderID = ?', [status, requestId]);

    if (normalizedStatus === 'accepted') {
      // ACCEPT: Add to cart but DO NOT deduct from listing quantity yet
      const proposedTotal = Number(r.ProposedPrice) || 0;
      const pricePerUnit = quantity > 0 ? Number((proposedTotal / quantity).toFixed(2)) : 0;

      // Keep preorder items out of inventory; only add the preorder item to cart.
      let shopId = null;
      if (r.ListingID) {
        const [listingLookup] = await pool.query(
          'SELECT ShopID FROM PreOrderListing WHERE ListingID = ? LIMIT 1',
          [r.ListingID]
        );
        shopId = listingLookup.length > 0 ? listingLookup[0].ShopID : null;
      }

      // Enforce single-shop cart per customer for preorders too
      if (shopId) {
        const [existingCart] = await pool.query('SELECT ShopID FROM Cart WHERE UserCustomerID = ? LIMIT 1', [customerId]);
        if (existingCart.length > 0 && existingCart[0].ShopID && String(existingCart[0].ShopID) !== String(shopId)) {
          // Clear old cart completely because it's from a different shop
          await pool.query('DELETE FROM Cart WHERE UserCustomerID = ?', [customerId]);
        }
      }

      // Add to Cart with PreOrderRequestID link
      await pool.query(
        'INSERT INTO Cart (UserCustomerID, PreOrderRequestID, ItemID, Quantity, PricePerUnit, ShopID) VALUES (?, ?, NULL, ?, ?, ?)',
        [customerId, requestId, quantity, pricePerUnit, shopId]
      );

      // Move request to checkout-pending state after farmer accepts.
      await pool.query('UPDATE PreOrderRequest SET Status = ? WHERE PreOrderID = ?', ['AwaitingCheckout', requestId]);

      res.json({ success: true, message: 'Request accepted and added to customer cart' });

    } else if (normalizedStatus === 'declined') {
      // DECLINE: Just mark as declined, no cart entry created
      res.json({ success: true, message: 'Request declined' });

    } else {
      res.json({ success: true, message: `Request status updated to ${status}` });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== REMOVE FROM CART (restore preorder quantity) =====
app.delete('/api/cart/:cartId', async (req, res) => {
  const { cartId } = req.params;
  try {
    // Get cart item details including linked preorder request
    const [cartRows] = await pool.query(
      'SELECT CartID, PreOrderRequestID, Quantity FROM Cart WHERE CartID = ?',
      [cartId]
    );
    if (cartRows.length === 0) return res.status(404).json({ error: 'Cart item not found' });

    const cartItem = cartRows[0];

    // If this is a preorder, cancel request when removed from cart before checkout.
    // Quantity is deducted only during checkout, so there is nothing to restore here.
    if (cartItem.PreOrderRequestID) {
      await pool.query(
        'UPDATE PreOrderRequest SET Status = ? WHERE PreOrderID = ?',
        ['Cancelled', cartItem.PreOrderRequestID]
      );
    }

    // Remove from cart
    await pool.query('DELETE FROM Cart WHERE CartID = ?', [cartId]);

    res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CART ENDPOINTS =====
app.get('/api/cart/:customerId', async (req, res) => {
  const { customerId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT c.CartID as id, c.UserCustomerID, c.PreOrderRequestID, c.ItemID as itemId, c.Quantity as quantity, c.PricePerUnit as pricePerUnit, c.ShopID,
              i.Name as itemName, i.Category, i.Stock as itemStock,
              pr.UserFarmerID as farmerId, pr.DeliveryMonth
       FROM Cart c
       LEFT JOIN Items i ON c.ItemID = i.ItemID
       LEFT JOIN PreOrderRequest pr ON c.PreOrderRequestID = pr.PreOrderID
       WHERE c.UserCustomerID = ?
       ORDER BY c.AddedDate DESC`,
      [customerId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cart/:customerId/add', async (req, res) => {
  const { customerId } = req.params;
  const { itemId, preOrderRequestId, quantity, pricePerUnit } = req.body;
  try {
    const qty = Number(quantity) || 1;
    const price = Number(pricePerUnit) || 0;

    if (!itemId) {
      return res.status(400).json({ error: 'ItemID is required' });
    }

    // Check if item already in cart (for manual adds, not preorders)
    if (!preOrderRequestId) {
      const [existing] = await pool.query(
        'SELECT CartID, Quantity FROM Cart WHERE UserCustomerID = ? AND ItemID = ? AND PreOrderRequestID IS NULL LIMIT 1',
        [customerId, itemId]
      );
      if (existing.length > 0) {
        const newQty = Number(existing[0].Quantity) + qty;
        await pool.query('UPDATE Cart SET Quantity = ? WHERE CartID = ?', [newQty, existing[0].CartID]);
        return res.json({ success: true, cartId: existing[0].CartID });
      }
    }

    // Get shop info
    const [itemRows] = await pool.query('SELECT ShopID FROM Items WHERE ItemID = ?', [itemId]);
    const shopId = itemRows.length > 0 ? itemRows[0].ShopID : null;

    // Enforce single-shop cart per customer
    if (shopId) {
      const [existingCart] = await pool.query('SELECT ShopID FROM Cart WHERE UserCustomerID = ? LIMIT 1', [customerId]);
      if (existingCart.length > 0 && existingCart[0].ShopID && existingCart[0].ShopID !== shopId) {
        // Clear old cart completely because it's from a different shop
        await pool.query('DELETE FROM Cart WHERE UserCustomerID = ?', [customerId]);
      }
    }

    // Add to cart
    const [result] = await pool.query(
      'INSERT INTO Cart (UserCustomerID, PreOrderRequestID, ItemID, Quantity, PricePerUnit, ShopID) VALUES (?, ?, ?, ?, ?, ?)',
      [customerId, preOrderRequestId || null, itemId, qty, price, shopId]
    );

    res.json({ success: true, cartId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cart/:cartId', async (req, res) => {
  const { cartId } = req.params;
  const { quantity } = req.body;
  try {
    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
    const qty = Number(quantity);
    await pool.query('UPDATE Cart SET Quantity = ? WHERE CartID = ?', [qty, cartId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== REMOVE PREORDER LISTING =====
app.delete('/api/shops/:sellerId/preorder-listings/:listingId', async (req, res) => {
  const { sellerId, listingId } = req.params;
  try {
    const [farmer] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [sellerId]);
    if (farmer.length === 0) return res.status(404).json({ error: 'Farmer not found' });

    await pool.query('DELETE FROM PreOrderListing WHERE ListingID = ? AND ShopID = ?', [listingId, farmer[0].ShopID]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-migrate OrderItems for preorders
(async () => {
  try {
    await pool.query('ALTER TABLE OrderItems MODIFY ItemID INT NULL');
    // For MySQL < 8.0, ADD COLUMN IF NOT EXISTS might not be supported directly,
    // so we catch the error if the column already exists.
    try {
      await pool.query('ALTER TABLE OrderItems ADD COLUMN ListingID INT NULL');
      console.log('Added ListingID column to OrderItems.');
    } catch (colErr) {
      // Ignore error if column already exists
    }
    console.log('Database schema patched for OrderItems.');
  } catch (err) {
    console.error('Migration notice:', err.message);
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
