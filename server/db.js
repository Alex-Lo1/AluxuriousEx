const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const { types } = require('pg');
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1083, (value) => value.slice(0, 5));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

async function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = { pool, migrate };
