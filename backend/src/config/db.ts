import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import { env } from './env';

let pgPool: Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

// Initialize Database connection based on DB_TYPE
if (env.DB_TYPE === 'postgres') {
  console.log('[DB]: Using PostgreSQL Connection Pool');
  pgPool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });

  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client', err);
  });
} else {
  console.log(`[DB]: Using SQLite database at ${env.SQLITE_PATH}`);
  sqliteDb = new sqlite3.Database(env.SQLITE_PATH, (err) => {
    if (err) {
      console.error('Failed to open SQLite database:', err.message);
    } else {
      initializeSqliteSchema();
    }
  });
}

// Function to automatically initialize SQLite Schema & Admin Seed
function initializeSqliteSchema() {
  if (!sqliteDb) return;

  sqliteDb.serialize(() => {
    // 1. Create Admins
    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // 2. Create Couriers
    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS couriers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        device_id TEXT UNIQUE NOT NULL,
        device_info TEXT,
        status TEXT DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // 3. Create Locations
    sqliteDb!.run(`
      CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courier_id INTEGER NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL NOT NULL,
        speed REAL,
        heading REAL,
        timestamp TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `);

    // 4. Create Indexes
    sqliteDb!.run(`CREATE INDEX IF NOT EXISTS idx_locations_courier_id_timestamp ON locations (courier_id, timestamp DESC)`);
    sqliteDb!.run(`CREATE INDEX IF NOT EXISTS idx_couriers_device_id ON couriers (device_id)`);

    // 5. Seed default admin if table is empty
    sqliteDb!.get('SELECT count(*) as count FROM admins', (err, row: any) => {
      if (err) {
        console.error('Error counting admins:', err);
        return;
      }
      if (row.count === 0) {
        console.log('[DB/SQLite Seed]: Seeding default admin user (admin@kuryetakip.com / Admin123!)');
        sqliteDb!.run(
          'INSERT INTO admins (email, password_hash) VALUES (?, ?)',
          ['admin@kuryetakip.com', '$2a$10$sbY2VNUiSP2BCe7y4tg.DuChmLlsgE1adCW4CyzgscVZvJBwOuyQ.']
        );
      }
    });
  });
}

export const db = {
  /**
   * Execute a query on the active database (Postgres or SQLite)
   * @param text SQL query text
   * @param params Query parameters
   */
  query: async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
      let rows: any[] = [];
      
      if (env.DB_TYPE === 'postgres' && pgPool) {
        const res = await pgPool.query(text, params);
        rows = res.rows;
      } else if (sqliteDb) {
        // Replace PostgreSQL parameter tokens ($1, $2) with SQLite tokens (?, ?)
        let sqliteText = text;
        const sqliteParams = params || [];
        
        // Convert $1, $2, etc. to ?
        sqliteText = sqliteText.replace(/\$\d+/g, '?');

        rows = await new Promise<any[]>((resolve, reject) => {
          sqliteDb!.all(sqliteText, sqliteParams, (err, resultRows) => {
            if (err) {
              reject(err);
            } else {
              resolve(resultRows || []);
            }
          });
        });
      }

      const duration = Date.now() - start;
      if (env.NODE_ENV === 'development') {
        console.log(`[DB Query - ${env.DB_TYPE.toUpperCase()}]:`, { 
          text, 
          duration: `${duration}ms`, 
          rows: rows.length 
        });
      }
      
      return { rows, rowCount: rows.length };
    } catch (error) {
      console.error('[DB Query Error]:', { text, error });
      throw error;
    }
  },

  /**
   * Get a client (only valid for PostgreSQL pool transactions)
   */
  getClient: async () => {
    if (env.DB_TYPE === 'postgres' && pgPool) {
      return await pgPool.connect();
    }
    throw new Error('Transactions using getClient are not supported on SQLite fallback.');
  },

  /**
   * Close the active database connection
   */
  end: async () => {
    if (pgPool) {
      await pgPool.end();
    }
    if (sqliteDb) {
      await new Promise<void>((resolve, reject) => {
        sqliteDb!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }
};
