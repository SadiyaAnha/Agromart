const pool = require('./db');
async function update() {
  try {
    console.log('Adding ListingID column...');
    await pool.query('ALTER TABLE PreOrderRequest ADD COLUMN ListingID INT');
    console.log('Added ListingID');
  } catch(e) { console.error('Error adding ListingID:', e.message); }
  try {
    console.log('Adding ProductID column...');
    await pool.query('ALTER TABLE PreOrderRequest ADD COLUMN ProductID INT');
    console.log('Added ProductID');
  } catch(e) { console.error('Error adding ProductID:', e.message); }
  process.exit();
}
update();
