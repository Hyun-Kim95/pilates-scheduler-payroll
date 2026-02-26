import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pilates_scheduler',
});

async function seedAdmin() {
  const password_hash = await bcrypt.hash('admin123', 10);
  await pool.execute(
    `INSERT INTO users (email, password_hash, role, instructor_id) 
     VALUES (?, ?, 'admin', NULL) 
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['admin@pilates.local', password_hash]
  );
  console.log('Admin user ready: admin@pilates.local / admin123');
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
