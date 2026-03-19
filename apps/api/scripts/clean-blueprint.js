
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://maxprime:maxprime@localhost:5432/maxprime',
});

async function run() {
  await client.connect();
  console.log('Connected to DB');

  const projectId = '09b6b0ff-828d-47e4-a5d9-8372ddb1a9f3';
  const res = await client.query('SELECT "blueprintContent" FROM "Project" WHERE id = $1', [projectId]);
  
  if (res.rows.length === 0) {
    console.log('Project not found');
    await client.end();
    return;
  }

  const raw = res.rows[0].blueprintContent || '';
  console.log('Current content start:', raw.slice(0, 50).replace(/\n/g, '\\n'));

  const cleaned = raw
    .replace(/^\s*```(?:markdown)?\s*/i, "")
    .replace(/^\s*```\s*/, "")
    .replace(/\s*```\s*$/, "");

  if (raw !== cleaned) {
    await client.query('UPDATE "Project" SET "blueprintContent" = $1 WHERE id = $2', [cleaned, projectId]);
    console.log('Content cleaned and saved.');
    console.log('New content start:', cleaned.slice(0, 50).replace(/\n/g, '\\n'));
  } else {
    console.log('Content was already clean.');
  }

  await client.end();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
