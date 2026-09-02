'use strict';

const fs = require('fs');
const path = require('path');
const mysql2 = require('mysql2/promise');
require('dotenv').config();

async function initDb() {
  console.log('🔄 Initializing UCRSystem Database...');

  const connection = await mysql2.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER     || 'ucrs_user',
    password: process.env.DB_PASSWORD != null ? process.env.DB_PASSWORD : 'ucrs_password',
    multipleStatements: true,
  });

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
    const seedSql   = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');

    console.log('📋 Running schema.sql...');
    await connection.query(schemaSql);
    console.log('✅ Schema created.');

    console.log('🌱 Running seed.sql...');
    await connection.query(seedSql);
    console.log('✅ Database seeded successfully with default test data (passwords: password123).');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  initDb();
}

module.exports = initDb;
