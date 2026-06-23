import fs from 'fs';
import path from 'path';
import { db } from '../config/db';

const runSeed = async () => {
  console.log('[SEED]: Starting database seeding...');
  try {
    const seedPath = path.join(__dirname, 'seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    await db.query(sql);
    console.log('[SEED]: Database seeded successfully.');
  } catch (error) {
    console.error('[SEED]: Error seeding database:', error);
    process.exit(1);
  } finally {
    await db.end();
    console.log('[SEED]: Database connection closed.');
  }
};

runSeed();
