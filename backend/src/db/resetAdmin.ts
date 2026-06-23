import bcrypt from 'bcryptjs';
import { db } from '../config/db';

const resetAdminPassword = async () => {
  console.log('[RESET]: Resetting admin password to Admin123!...');
  try {
    const hash = await bcrypt.hash('Admin123!', 10);
    
    // Check if admin exists
    const adminCheck = await db.query('SELECT id FROM admins WHERE email = $1', ['admin@kuryetakip.com']);
    
    if (adminCheck.rows.length === 0) {
      // Insert if not exists
      await db.query(
        'INSERT INTO admins (email, password_hash) VALUES ($1, $2)',
        ['admin@kuryetakip.com', hash]
      );
      console.log('[RESET]: Admin user created with email: admin@kuryetakip.com / password: Admin123!');
    } else {
      // Update if exists
      await db.query(
        'UPDATE admins SET password_hash = $1 WHERE email = $2',
        [hash, 'admin@kuryetakip.com']
      );
      console.log('[RESET]: Admin password updated successfully to Admin123!');
    }
  } catch (error) {
    console.error('[RESET]: Error resetting admin password:', error);
  } finally {
    await db.end();
  }
};

resetAdminPassword();
