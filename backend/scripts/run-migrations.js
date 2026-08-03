import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = fs.readFileSync(new URL('../migrations/001_init.sql', import.meta.url), 'utf8');
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || ''
  });
  try {
    const statements = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      // eslint-disable-next-line no-console
      console.log('Executing statement...');
      await connection.query(stmt);
    }
    // eslint-disable-next-line no-console
    console.log('Migrations executed');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Migration error', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();
