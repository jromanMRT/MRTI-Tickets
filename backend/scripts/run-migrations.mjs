import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Antes este script sólo ejecutaba 001_init.sql, sin importar cuántas
// migraciones existieran (002-009 nunca corrían aquí; sólo se aplicaban de
// verdad en un contenedor Docker nuevo, vía docker-entrypoint-initdb.d). Un
// registro de migraciones aplicadas (schema_migrations) hace que "npm run
// migrate" recorra todos los archivos numerados en orden y sea seguro de
// repetir -- ya no vuelve a intentar 001_init.sql sobre una base que ya lo
// tiene, algo que además fallaría por sus CREATE INDEX no idempotentes.
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

async function run() {
  const databaseName = process.env.DATABASE_NAME || 'mrti_tickets';
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: Number(process.env.DATABASE_PORT || 3306),
    user: process.env.DATABASE_USER || 'root',
    password: process.env.DATABASE_PASSWORD || '',
    // Varias migraciones usan bloques PREPARE/EXECUTE/DEALLOCATE con más de
    // una sentencia por línea (para condicionar un ALTER a que la columna no
    // exista ya) -- dividir por saltos de línea las rompía. mysql2 con
    // multipleStatements ejecuta el archivo completo tal como lo parsearía
    // el cliente `mysql`, que es como ya se aplican estos mismos archivos
    // vía docker-entrypoint-initdb.d.
    multipleStatements: true,
  });
  try {
    // 001_init.sql crea la base de datos; antes de que exista no hay dónde
    // guardar el registro de migraciones aplicadas.
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${databaseName}\``);
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    const [applied] = await connection.query('SELECT name FROM schema_migrations');
    const done = new Set(applied.map((row) => row.name));

    const files = fs.readdirSync(migrationsDir)
      .filter((name) => /^\d+_.*\.sql$/.test(name))
      .sort();

    for (const file of files) {
      if (done.has(file)) continue;
      console.log(`Aplicando ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await connection.query(sql);
      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    }
    console.log('Migraciones al día.');
  } catch (err) {
    console.error('Migration error', err);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

run();
