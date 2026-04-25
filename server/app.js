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

// User registration
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, phone, address, bio, shopName, userType } = req.body;
  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'Email already exists' });
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, phone, address, bio, shopName, userType) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, password, phone, address, bio, shopName, userType]
    );
    res.json({ id: result.insertId, name, email, userType, shopName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = users[0];
    res.json({ id: user.id, name: user.name, email: user.email, userType: user.userType, shopName: user.shopName });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all sellers
app.get('/api/sellers', async (req, res) => {
  try {
    const [sellers] = await pool.query('SELECT id, name, shopName, bio, address FROM users WHERE userType = ?', ['seller']);
    res.json(sellers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get shop items for a seller
app.get('/api/shops/:sellerId/items', async (req, res) => {
  const { sellerId } = req.params;
  try {
    const [items] = await pool.query('SELECT * FROM products WHERE sellerId = ?', [sellerId]);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add item to shop
app.post('/api/shops/:sellerId/items', async (req, res) => {
  const { sellerId } = req.params;
  const { name, category, price } = req.body;
  try {
    const [result] = await pool.query(
      'INSERT INTO products (sellerId, name, category, price) VALUES (?, ?, ?, ?)',
      [sellerId, name, category, price]
    );
    res.json({ id: result.insertId, sellerId, name, category, price });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove item from shop
app.delete('/api/shops/:sellerId/items/:itemId', async (req, res) => {
  const { sellerId, itemId } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = ? AND sellerId = ?', [itemId, sellerId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
