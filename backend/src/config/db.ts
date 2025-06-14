import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('Database connecting to:', process.env.DB_HOST); // Debug log

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;