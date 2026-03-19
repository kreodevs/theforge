
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://maxprime:maxprime@localhost:5432/maxprime',
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT id, name, "specContent" FROM "Project"');
  console.log('Projects found:', res.rows.length);
  res.rows.forEach(r => {
    console.log(`ID: ${r.id}, Name: ${r.name}, Spec Length: ${(r.specContent || '').length}`);
    if (r.specContent) {
       console.log(`Spec Start: ${r.specContent.slice(0, 20).replace(/\n/g, '\\n')}`);
    }
  });
  await client.end();
}

run().catch(console.error);
