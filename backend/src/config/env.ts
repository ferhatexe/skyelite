import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DB_TYPE: process.env.DB_TYPE || 'sqlite', // 'postgres' or 'sqlite'
  SQLITE_PATH: process.env.SQLITE_PATH || path.join(__dirname, '../../database.sqlite'),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kuryetakip',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_kuryetakip_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

// Validate critical variables
const requiredEnvs = ['JWT_SECRET'];
if (env.NODE_ENV === 'production' && env.DB_TYPE === 'postgres') {
  requiredEnvs.push('DATABASE_URL');
}

for (const key of requiredEnvs) {
  if (!process.env[key]) {
    console.warn(`[WARNING]: Environment variable ${key} is not set. Using fallback value.`);
  }
}
