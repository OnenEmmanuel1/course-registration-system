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
    const [[{ photoDataColumn }]] = await connection.query(
      `SELECT COUNT(*) AS photoDataColumn FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_photo_data'`
    );
    if (!photoDataColumn) await connection.query('ALTER TABLE users ADD COLUMN profile_photo_data MEDIUMTEXT NULL');

    const [[{ photoTypeColumn }]] = await connection.query(
      `SELECT COUNT(*) AS photoTypeColumn FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'profile_photo_type'`
    );
    if (!photoTypeColumn) await connection.query('ALTER TABLE users ADD COLUMN profile_photo_type VARCHAR(32) NULL');
    const [[{ facultyColumn }]] = await connection.query(
      `SELECT COUNT(*) AS facultyColumn FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'faculty'`
    );
    if (!facultyColumn) await connection.query("ALTER TABLE users ADD COLUMN faculty VARCHAR(100) NOT NULL DEFAULT '' AFTER role");
    console.log('✅ Schema created.');

    console.log('🌱 Running seed.sql...');
    await connection.query(seedSql);
    await connection.query(`UPDATE users u JOIN departments d ON d.name = u.department
      JOIN faculties f ON f.id = d.faculty_id SET u.faculty = f.name WHERE u.faculty = ''`);
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
