const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function run() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    // Split queries. Note: splitting by ; might break triggers with delimiters.
    // Since we just need to add the table and trigger, let's just run those explicitly.
    const query1 = `
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
    `;
    const query2 = `
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
      END;
    `;
    console.log('Running query 1...');
    await pool.query(query1);
    console.log('Running query 2...');
    try {
       await pool.query('DROP TRIGGER IF EXISTS trg_review_insert');
       await pool.query(query2);
    } catch(e) { console.error('Error with trigger:', e.message); }
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
