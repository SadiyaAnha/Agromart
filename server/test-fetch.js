async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/farmers/2/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: 1, rating: 5, comment: 'hoilaaaa' })
    });
    const data = await res.json();
    console.log(res.status, data);
  } catch (err) {
    console.error(err);
  }
}
run();
