const mysql = require('mysql2/promise');
require('dotenv').config();
async function update() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agromart'
  });
  try {
    console.log('Dropping trigger if exists...');
    await pool.query('DROP TRIGGER IF EXISTS trg_review_insert');
    console.log('Creating trigger...');
    const query = `CREATE TRIGGER trg_review_insert
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
END`;
    await pool.query(query);
    console.log('Trigger created!');
    
    // Recalculate past reviews manually since the trigger wasn't running
    console.log('Recalculating existing reviews...');
    const [farmers] = await pool.query('SELECT DISTINCT UserFarmerID FROM FarmerReview');
    for (const row of farmers) {
      const fId = row.UserFarmerID;
      const [avgRows] = await pool.query('SELECT AVG(Rating) as avg_rating FROM FarmerReview WHERE UserFarmerID = ?', [fId]);
      const [shopRows] = await pool.query('SELECT ShopID FROM Farmer WHERE UserFarmerID = ?', [fId]);
      if (shopRows.length > 0 && avgRows.length > 0 && shopRows[0].ShopID) {
         await pool.query('UPDATE Shop SET Review = ? WHERE ShopID = ?', [avgRows[0].avg_rating, shopRows[0].ShopID]);
      }
    }
    console.log('Recalculation complete!');
  } catch(e) { console.error('Error:', e.message); }
  process.exit();
}
update();
