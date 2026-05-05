const pool = require('./db');
async function test() {
  try {
    // Find a farmer
    const [farmers] = await pool.query('SELECT UserFarmerID, ShopID FROM Farmer LIMIT 1');
    if (farmers.length === 0) { console.log('No farmers'); return; }
    const farmerId = farmers[0].UserFarmerID;
    // Find a customer
    const [customers] = await pool.query('SELECT UserCustomerID FROM Customer LIMIT 1');
    if (customers.length === 0) { console.log('No customers'); return; }
    const customerId = customers[0].UserCustomerID;
    console.log('Inserting review for farmer', farmerId, 'by customer', customerId);
    const [res] = await pool.query('INSERT INTO FarmerReview (UserFarmerID, UserCustomerID, Rating, Comment) VALUES (?, ?, ?, ?)', [farmerId, customerId, 5, 'Test']);
    console.log('Success:', res);
  } catch (err) {
    console.error('ERROR:', err.message);
  } finally {
    process.exit();
  }
}
test();
