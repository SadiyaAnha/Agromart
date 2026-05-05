const pool = require('./db');
async function test() {
  try {
    const [rows] = await pool.query('DESCRIBE FarmerReview');
    console.log(rows);
  } catch (err) {
    console.error(err.message);
  } finally {
    process.exit();
  }
}
test();
