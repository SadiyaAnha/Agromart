const pool = require('./db');

(async () => {
  try {
    const dbName = process.env.DB_NAME || 'test'; // Ensure it's correct or use a query to find the DB name

    console.log('Finding foreign keys for ItemID...');
    const [rows] = await pool.query(`
      SELECT CONSTRAINT_NAME, TABLE_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND COLUMN_NAME = 'ItemID' 
        AND TABLE_NAME IN ('PreOrderListing', 'PreOrderRequest')
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    if (rows.length === 0) {
      console.log('No foreign keys found.');
    } else {
      for (let row of rows) {
        console.log(`Dropping FK ${row.CONSTRAINT_NAME} from ${row.TABLE_NAME}...`);
        await pool.query(`ALTER TABLE ${row.TABLE_NAME} DROP FOREIGN KEY ${row.CONSTRAINT_NAME}`);
      }
    }

    console.log('Dropping columns...');
    await pool.query('ALTER TABLE PreOrderListing DROP COLUMN ItemID').catch(e => console.log(e.message));
    await pool.query('ALTER TABLE PreOrderRequest DROP COLUMN ItemID').catch(e => console.log(e.message));
    
    console.log('Done! Columns successfully dropped.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
