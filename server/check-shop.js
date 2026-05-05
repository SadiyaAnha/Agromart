const pool = require('./db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT * FROM Shop');
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
check();
