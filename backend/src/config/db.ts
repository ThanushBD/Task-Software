import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('Database connecting to:', process.env.DB_HOST); // Debug log

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false // Required for AWS RDS
  }
});

export { pool };